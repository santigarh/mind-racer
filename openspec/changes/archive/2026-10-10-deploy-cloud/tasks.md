# Tasks

## 1. Servidor: HTTP, salud y orígenes

- [x] 1.1 Leer `ALLOWED_ORIGINS`, `TRUST_PROXY_HOPS`, `PORT` y `HOST` en `main.ts` y pasarlos a `startServer`; verificar con una prueba que `PORT` define el puerto de HTTP y WebSocket
- [x] 1.2 Reemplazar el `WebSocketServer` independiente por `http.createServer` + `WebSocketServer({ noServer: true })` con `GET /health` (200 y `{"status":"ok","rooms":n}`) y 404 para otras rutas; verificar con pruebas de integración de "Plataforma comprueba el servicio" y "Ruta desconocida", y que las pruebas existentes del servidor pasan
- [x] 1.3 Validar el `Origin` en el `upgrade` contra `ALLOWED_ORIGINS` (403 si no está; sin la variable se acepta todo); verificar con pruebas de integración de "Conexión desde el sitio publicado", "Conexión desde otro sitio" y "Red local sin configuración"

## 2. Servidor: límite de salas por IP

- [x] 2.1 Obtener la IP del cliente en el `upgrade` (`X-Forwarded-For` según `TRUST_PROXY_HOPS`, o `remoteAddress`) y pasarla a `RoomManager.connect`; verificar con pruebas unitarias de la función de IP, incluido "Encabezado falsificado"
- [x] 2.2 Limitar a 5 salas nuevas por IP cada 10 minutos (ventana deslizante, limpieza en `tick`, error `rate-limited` con el texto de la spec); verificar con pruebas de "Demasiadas salas" y "Pasada la ventana" con reloj falso

## 3. Servidor: build de producción

- [x] 3.1 Agregar `esbuild` como dependencia de desarrollo y el script `build:prod` que genera `apps/server/dist/main.js` (ESM, node22, `ws` externo); verificar que `node apps/server/dist/main.js` arranca sin `tsx` y que `/health` responde 200
- [x] 3.2 Prueba de humo del build: un cliente Node real crea una sala contra `dist/main.js` con `ALLOWED_ORIGINS` definida; verificar que la sala se crea con el origen permitido y se rechaza con otro

## 4. Cliente: primera conexión y servidor despertando

- [x] 4.1 En `NetClient`, tiempo máximo de 10 s para abrir el socket (si no abre ni cierra, se cierra y reintenta); verificar con prueba de "Conexión que no responde" usando timers falsos
- [x] 4.2 Exponer en `MultiplayerSession` desde cuándo hay una acción pendiente sin conexión abierta, y mostrar en `Entry`/`Lobby` "Conectando con el servidor…" y, tras 5 s, "Despertando el servidor, puede tardar hasta un minuto"; verificar con Testing Library "Servidor dormido" (entra al lobby al abrir sin volver a pulsar) y "Servidor despierto" (sin aviso)

## 5. Configuración de despliegue y documentación

- [x] 5.1 Agregar `render.yaml` según D4 (plan gratis, una instancia, build con corepack + pnpm, `node apps/server/dist/main.js`, `healthCheckPath`, variables); verificar que el YAML es válido y que el comando de build corre igual en local
- [x] 5.2 Agregar `.github/workflows/ci.yml` según D9; verificar el YAML con `actionlint` si está disponible o revisando la sintaxis, y en la tarea 6.4 que el primer run pasa
- [x] 5.3 Agregar `LICENSE` (MIT, Santiago, 2026) y la sección "Publicar en internet" del README (D10, con los pasos de Render y Pages, las variables y qué esperar del plan gratis); verificar que cada comando documentado existe en `package.json`
- [x] 5.4 Verificar que `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod` pasan desde la raíz y que `pnpm dev` y el juego en la red local funcionan igual

## 6. Publicar el repositorio

- [x] 6.1 Hacer commit de los cambios pendientes (incluido el archivo de `add-multiplayer-rooms`) y fijar `user.email` local en `35776908+santigarh@users.noreply.github.com`; verificar con `git config user.email`
- [x] 6.2 Crear la rama de respaldo, reescribir autor y committer de todos los commits con `git filter-branch --env-filter` (conservando fechas) y comparar el árbol con el respaldo; verificar que `git log --format='%ae %ce' | sort -u` solo muestra el correo privado y que `git diff respaldo HEAD` está vacío; luego borrar el respaldo y `refs/original`
- [x] 6.3 Repetir la auditoría de publicación (sin secretos, sin `.env`, sin el correo personal en el historial ni en archivos); verificar con los mismos comandos de búsqueda de la exploración
- [x] 6.4 Con confirmación explícita del usuario en ese momento, crear `santigarh/mind-racer` público con `gh repo create --public --source . --push`; verificar que el repo existe, que la licencia MIT aparece y que el primer run de GitHub Actions pasa

## 7. Despliegue (con el usuario)

- [x] 7.1 Usuario: crear la cuenta de Render, crear el Blueprint desde el repo (elegir región y nombre) y definir `ALLOWED_ORIGINS` provisional; verificar con `curl https://<servicio>.onrender.com/health` que responde 200, aplicando el plan B de D6 si el build falla por pnpm
- [x] 7.2 Usuario: crear el Worker de Cloudflare desde el repo con la configuración de D5 (`apps/web/wrangler.jsonc`, root `apps/web`, build con pnpm, `VITE_SERVER_URL=wss://<servicio>.onrender.com` como variable de build); verificar con `wrangler deploy --dry-run` en local, y luego que la página carga y que el modo solo funciona
- [x] 7.3 Ajustar `ALLOWED_ORIGINS` a la URL definitiva del Worker (`*.workers.dev`); verificar que crear una sala desde el sitio funciona y que una conexión desde otro origen recibe 403
- [x] 7.4 Prueba final del usuario desde un celular fuera del wifi de casa y desde otro dispositivo: crear sala, unirse por código, carrera completa y aviso de servidor despertando tras más de 15 minutos sin uso

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando la prueba final esté hecha.
- Mejora posible: desplegar la web desde GitHub Actions con `wrangler` para publicar solo si pasan las pruebas.
