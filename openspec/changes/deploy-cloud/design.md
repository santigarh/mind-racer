# Design

## Context

Ver proposal.md (Why). Estado actual relevante (revisado en el código):

- `apps/server/src/server.ts` crea un `WebSocketServer({ port })` independiente: no responde HTTP, así que no hay chequeo de salud posible.
- `apps/server` corre con `tsx` e importa el código TypeScript de `@mind-racer/engine` y `@mind-racer/protocol` (sus `exports` apuntan a `src/*.ts`); su script `build` solo verifica tipos.
- `apps/web/src/net/NetClient.ts`: sin `VITE_SERVER_URL` usa `ws(s)://<hostname>:8787`. Solo muestra "Conectando con el servidor…" cuando el estado es `reconnecting`, no durante el primer intento, que es justo el que espera mientras Render despierta. Además, un socket que no abre ni cierra queda colgado sin reintentar.
- No se valida el `Origin` de las conexiones ni se limita la creación de salas por IP.
- El repo no tiene remoto. Los 5 commits tienen como autor el correo personal. No hay `LICENSE` ni `.github/`.
- `gh` está autenticado como `santigarh` (id 35776908).
- `packageManager` es `pnpm@12.10.1` y Node local es 22.

## Goals / Non-Goals

**Goals:**
- Publicar el juego con costo cero: la web siempre disponible y el multijugador disponible tras, como máximo, un minuto de espera.
- Despliegue automático desde GitHub, sin pasos manuales en el panel salvo crear cuentas, conectar el repo y definir variables.
- Que `pnpm dev` y el juego en la red local sigan funcionando igual.

**Non-Goals:**
- Servidor siempre encendido, varias instancias, persistencia de salas, dominio propio, métricas o alertas.

## Decisions

### D1. HTTP + WebSocket en un solo puerto
`http.createServer` atiende `GET /health` (200 con `{"status":"ok","rooms":n}`) y responde 404 a lo demás. El `WebSocketServer` pasa a modo `noServer` y se engancha al evento `upgrade` del servidor HTTP. En ese punto se valida el `Origin` contra `ALLOWED_ORIGINS` y se rechaza con 403 antes de aceptar el socket.
- *Alternativa:* `verifyClient` de `ws`. Funciona, pero el manejo de `upgrade` deja en un solo lugar el origen, la IP y la respuesta HTTP, y es la vía recomendada por `ws`.

### D2. Límite de salas por IP
`RoomManager` recibe la IP del cliente al conectarse (`connect(conn, { ip })`) y lleva un registro de creaciones por IP en una ventana deslizante de 10 minutos, con un máximo de 5. Al superarlo responde `error` con el código existente `rate-limited` y el texto de la spec.
- La IP sale de `X-Forwarded-For` contando `TRUST_PROXY_HOPS` desde la derecha, o de `socket.remoteAddress` si la variable no está. En Render se configura `TRUST_PROXY_HOPS=1`. Se cuenta desde la derecha porque los valores de la izquierda los puede inventar el cliente.
- El registro se limpia en cada `tick` para no crecer sin límite.

### D3. Build de producción con esbuild
Nuevo script `build:prod` en `apps/server`: esbuild empaqueta `src/main.ts` con `engine`, `protocol` y `zod` en `dist/main.js` (`platform=node`, `format=esm`, `target=node22`). `ws` y sus dependencias nativas opcionales (`bufferutil`, `utf-8-validate`) quedan como externas. El arranque es `node apps/server/dist/main.js`.
- Por qué: no hay que instalar `tsx` en producción, arranca en milisegundos (importa en cada despertar del plan gratis) y no cambia cómo exportan los paquetes del monorepo.
- *Alternativa:* `tsx src/main.ts` en producción. Más simple, pero instala dependencias de desarrollo y compila TypeScript en cada arranque.
- El esbuild ya instalado como dependencia de `tsx` no ejecuta su script de instalación (`allowBuilds: esbuild: false`). Se agrega `esbuild` como dependencia directa de desarrollo y se verifica que su binario opcional funcione igual que con `tsx`.

### D4. Render (servidor)
`render.yaml` (Blueprint) en la raíz:
- Servicio `web`, `runtime: node`, `plan: free`, `region` la más cercana (a definir por el usuario al crear el Blueprint).
- `buildCommand`: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter server build:prod`.
- `startCommand`: `node apps/server/dist/main.js`. `healthCheckPath: /health`.
- `envVars`: `NODE_VERSION=22`, `TRUST_PROXY_HOPS=1`, `ALLOWED_ORIGINS` con `sync: false` (se define en el panel con la URL real de Pages).
- Una instancia; el plan gratis no escala, y se deja explícito que no debe activarse autoescalado.
- Despliegue automático solo cuando pasan las verificaciones de GitHub (opción "after CI checks pass"). Si el Blueprint no la acepta como campo, se configura en el panel y se documenta.

### D5. Cloudflare Pages (web)
Integración con Git desde el panel (no requiere secretos en el repo):
- Comando de build: `corepack enable && pnpm install --frozen-lockfile && pnpm --filter web build`.
- Directorio de salida: `apps/web/dist`.
- Variables: `NODE_VERSION=22`, `VITE_SERVER_URL=wss://<servicio>.onrender.com`.
- Pages no espera a GitHub Actions: si un push rompe la web, Pages podría publicarla igual. Es aceptable para un juego familiar, porque las pruebas del CI avisan en el mismo push.
- *Alternativa:* desplegar desde GitHub Actions con `wrangler pages deploy`. Así solo se publica si pasan las pruebas, pero requiere guardar un token de Cloudflare como secreto. Se deja como mejora posible.

### D6. pnpm 12 en las plataformas
Ambas plataformas instalan pnpm con `corepack enable`, que respeta `packageManager: pnpm@12.10.1`.
- Riesgo: que su versión de Node o de corepack no conozca pnpm 12. Plan B en este orden:
  1. instalar pnpm con `npm i -g pnpm@12.10.1` en el comando de build;
  2. en Render, un `Dockerfile` (soportado en el plan gratis).
- Se comprueba en el primer despliegue (tarea dedicada).

### D7. Cliente: primera conexión y servidor despertando
- `NetClient` muestra el estado `connecting` también en el primer intento y agrega un tiempo máximo de apertura de 10 s: si el socket no abre ni cierra, lo cierra y entra al ciclo de reintentos existente.
- `MultiplayerSession` expone desde cuándo se está intentando conectar con una acción pendiente. `Entry` y `Lobby` muestran "Conectando con el servidor…" y, pasados 5 s, "Despertando el servidor, puede tardar hasta un minuto".
- Los mensajes `create`/`join` ya quedan en cola hasta que el socket abre, así que la acción se completa sola al despertar.

### D8. Publicar el repo
1. Fijar en la configuración local del repo `user.email = 35776908+santigarh@users.noreply.github.com` para los commits futuros.
2. Reescribir solo el autor y el committer de los commits existentes con `git filter-branch --env-filter`. Viene con git y conserva las fechas; `git filter-repo` no está garantizado en la máquina. Se hace antes del primer push, así que no afecta a nadie.
3. Agregar `LICENSE` (MIT, titular "Santiago", año 2026).
4. Crear el repo con `gh repo create santigarh/mind-racer --public --source . --push`. Es una acción hacia afuera, así que se pide confirmación explícita en ese momento.

### D8b. Verificación previa a publicar
Antes del push se repite la auditoría: sin secretos, sin `.env` y sin el correo personal en `git log`.

### D9. GitHub Actions
`.github/workflows/ci.yml` en `push` y `pull_request`:
- `actions/checkout` y `pnpm/action-setup`, que lee `packageManager`;
- `actions/setup-node` con Node 22 y caché de pnpm;
- `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod`.

Un repo público tiene minutos de Actions gratis.

### D10. Documentación
README con una sección "Publicar en internet" que sigue los pasos en orden:
1. Crear el repo.
2. Crear el Blueprint en Render y definir `ALLOWED_ORIGINS`.
3. Crear el proyecto de Pages con `VITE_SERVER_URL`.
4. Ajustar `ALLOWED_ORIGINS` a la URL real de Pages y probar desde el celular.

Incluye qué esperar del plan gratis: el servidor se duerme a los 15 minutos y despertarlo tarda alrededor de un minuto.

## Risks / Trade-offs

- [El servidor dormido hace esperar ~1 minuto la primera sala] → aceptado por el usuario; aviso claro y reintento automático (spec `multiplayer-rooms`).
- [Render cambia las condiciones del plan gratis] → la configuración es portable: `render.yaml` es simple y el servidor es un proceso Node estándar que corre en cualquier plataforma con WebSockets.
- [750 horas gratis al mes] → alcanzan para un solo servicio 24/7, y el plan gratis además se duerme sin uso.
- [Las salas se pierden si el servidor se reinicia o despliega] → aceptado; el cliente muestra el error y vuelve al menú. Se recomienda no hacer push durante una partida familiar.
- [pnpm 12 no disponible en el build] → plan B de D6.
- [Pages publica aunque fallen las pruebas] → aceptado (D5); mejora posible con `wrangler`.
- [Abuso del servidor público] → orígenes permitidos, límite de salas por IP y los límites existentes (tamaño de mensaje, 20 respuestas/s, 200 salas).
- [La reescritura del historial falla o pierde algo] → se hace sobre una rama de respaldo y se compara el árbol de archivos (`git diff respaldo HEAD` vacío) antes de borrarla.

## Migration Plan

1. Implementar y probar los cambios de servidor y cliente en local; `pnpm dev` debe seguir igual.
2. Reescribir el autor, agregar `LICENSE` y crear el repo público.
3. Conectar Render (Blueprint) y luego Cloudflare Pages con sus variables.
4. Ajustar `ALLOWED_ORIGINS` a la URL definitiva de Pages y probar desde un celular fuera del wifi de casa.
5. Rollback: en Render y Pages se puede volver a un despliegue anterior desde el panel. El juego local no depende de la nube.

## Open Questions

- Nombre final del servicio en Render y del proyecto en Pages (definen las URL `*.onrender.com` y `*.pages.dev`): se eligen al crearlos y solo cambian valores de variables.
- Región de Render más cercana a la familia: se elige al crear el Blueprint.
