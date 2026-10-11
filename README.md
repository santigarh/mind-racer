# Mind Racer

Juego de carreras estilo Nitro Type donde el auto avanza resolviendo desafíos mentales.
Primera variante: **Math Racer** — cada respuesta correcta acelera tu auto.
Se juega solo contra bots o en salas privadas con amigos y familia, cada persona en su propio nivel.

## Estructura

```
packages/engine     Motor de carrera, desafíos, dificultad adaptativa y bots (TypeScript puro)
packages/protocol   Mensajes entre la app y el servidor, con validación compartida
apps/web            App web (Vite + React + TypeScript)
apps/server         Servidor multijugador (Node + WebSockets), salas en memoria
openspec/           Planificación con OpenSpec (specs y cambios)
```

Juega en línea: la web se publica en Cloudflare (Workers, archivos estáticos) y el servidor multijugador en Render (ver [Publicar en internet](#publicar-en-internet)).

## Requisitos

- Node.js 22+
- pnpm 12+

## Comandos

```bash
pnpm install      # instala dependencias de todo el monorepo
pnpm dev          # levanta la app web (puerto 5173) y el servidor multijugador (puerto 8787)
pnpm dev:web      # solo la app web
pnpm dev:server   # solo el servidor
pnpm test         # corre las pruebas de todos los paquetes
pnpm typecheck    # verifica tipos en todos los paquetes
pnpm build        # compila todo
pnpm --filter server build:prod   # empaqueta el servidor en apps/server/dist/main.js (lo que corre en Render)
```

Para un solo paquete: `pnpm --filter @mind-racer/engine test`, `pnpm --filter server test` o `pnpm --filter web dev`.

## Jugar en familia en la red de casa

1. En la computadora que hará de servidor, ejecuta `pnpm dev`. La consola muestra sus direcciones de red,
   por ejemplo `Network: http://192.168.1.12:5173/` (busca la que dice **Wi-Fi** o **Ethernet**).
2. En cada celular, tablet o computadora conectada al **mismo wifi**, abre esa dirección en el navegador.
3. Una persona entra a **Jugar con amigos → Crear sala** y comparte el código de 4 caracteres (por ejemplo `K7QF`).
4. Las demás eligen **Unirse** y escriben el código. Cada quien elige su nivel en la sala y el anfitrión pulsa **Iniciar carrera**.
   Los carriles libres se completan con bots.

La app se conecta sola al servidor de la misma computadora que la sirvió (puerto 8787). Para usar otro servidor,
define `VITE_SERVER_URL`, por ejemplo `VITE_SERVER_URL=ws://192.168.1.50:8787`.

### Si los celulares no pueden entrar (Windows)

La primera vez, Windows puede bloquear las conexiones entrantes a Node:

- Si aparece el aviso de **Firewall de Windows Defender** al ejecutar `pnpm dev`, permite el acceso en **redes privadas**.
- Si ya lo cerraste, abre *Firewall de Windows Defender → Permitir una aplicación a través del Firewall*, busca
  **Node.js JavaScript Runtime** y marca la casilla **Privada**.
- Verifica que tu red wifi esté configurada como **privada** (Configuración → Red e Internet → propiedades del wifi).
- Las direcciones de adaptadores virtuales (VirtualBox, WSL, VPN) no sirven para los celulares: usa la del wifi.

## Publicar en internet

La web va en **Cloudflare Workers** como sitio estático (gratis, siempre disponible) y el servidor multijugador en **Render** (plan gratis).
Ambos se actualizan solos con cada push a `main`. Render espera a que pasen las pruebas de GitHub Actions.

```
jugador --https--> Cloudflare Worker (menú y modo solo: siempre al instante)
   |
   +-----wss-----> Render (solo "Jugar con amigos")
```

### Qué esperar del plan gratis de Render

- Se duerme tras **15 minutos** sin conexiones ni mensajes. Mientras alguien juega, los mensajes lo mantienen despierto.
- Despertarlo tarda **alrededor de un minuto**. La app muestra "Despertando el servidor, puede tardar hasta un minuto" y entra sola a la sala.
- Las salas viven en memoria: un despliegue o un reinicio las cierra. Evita hacer push durante una partida.

### Variables del servidor

| Variable | Para qué | Valor en Render |
|---|---|---|
| `PORT` | Puerto de HTTP y WebSocket | Lo define Render |
| `HOST` | Interfaz donde escucha | `0.0.0.0` (por defecto) |
| `ALLOWED_ORIGINS` | Sitios que pueden conectarse, separados por comas | La URL de la web, p. ej. `https://mind-racer.<subdominio>.workers.dev` |
| `TRUST_PROXY_HOPS` | Proxies delante del servidor (para el límite de salas por IP) | `1` |

Sin `ALLOWED_ORIGINS` el servidor acepta cualquier origen, como en la red local. `GET /health` responde `{"status":"ok","rooms":n}`.

### Pasos (una sola vez)

1. **GitHub:** el código debe estar en un repositorio (por ejemplo `santigarh/mind-racer`).
2. **Render, el servidor:**
   1. Crea una cuenta en [render.com](https://render.com) e inicia sesión con GitHub.
   2. *New → Blueprint* y elige el repositorio. Render lee `render.yaml`: servicio `mind-racer-server`, plan gratis, región `virginia`.
      Si prefieres otra región (`oregon`, `ohio`, `frankfurt`, `singapore`), cámbiala en `render.yaml` **antes** de este paso, porque después no se puede cambiar.
   3. Cuando pida `ALLOWED_ORIGINS`, escribe cualquier valor provisional (se ajusta en el paso 4 con la URL real de la web).
   4. Al terminar, abre `https://<nombre-del-servicio>.onrender.com/health`; debe responder `{"status":"ok",...}`.
3. **Cloudflare, la web:**
   1. Crea una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com).
   2. *Workers & Pages → Create → Import a repository* y elige el repositorio. Nombre del Worker: **`mind-racer`**
      (debe coincidir con `name` en `apps/web/wrangler.jsonc`).
   3. En la configuración del build (o después en el Worker → *Settings → Build*):
      - Root directory: `apps/web`
      - Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
      - Deploy command: `npx wrangler deploy` (el que viene por defecto)
      - Variables **de build**: `NODE_VERSION` = `22` y `VITE_SERVER_URL` = `wss://<nombre-del-servicio>.onrender.com`
   4. Al terminar, Cloudflare te da la URL definitiva, por ejemplo `https://mind-racer.<subdominio>.workers.dev`.

   `apps/web/wrangler.jsonc` le dice a Cloudflare que publique `apps/web/dist` como sitio de una sola página. Sin ese archivo,
   Cloudflare intenta detectar la app sola y falla en este monorepo (por ejemplo con `Unsupported URL Type "workspace:"`).
4. **Ajustar el origen:** en Render, *Environment*, pon en `ALLOWED_ORIGINS` la URL exacta de la web (sin `/` al final) y guarda; Render se redespliega solo.
5. **Probar:** abre la URL de la web desde el celular **con datos móviles**, crea una sala y únete desde otro dispositivo con el código.

### Si el build falla por pnpm

Ambas plataformas instalan pnpm con `corepack enable` según `packageManager` en `package.json`. Si alguna no reconoce esa versión,
cambia en su build command `corepack enable` por `npm i -g pnpm@12.10.1`.

## Licencia

[MIT](LICENSE)
