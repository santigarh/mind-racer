# Proposal

## Why

Hoy Mind Racer solo se puede jugar en la red de la casa, con una PC encendida corriendo `pnpm dev`. Para que familiares y amigos jueguen desde cualquier lugar hace falta publicarlo en internet, y el presupuesto es cero. Con la web en Cloudflare (un Worker gratis que sirve los archivos estáticos, siempre disponible) y el servidor multijugador en el plan gratis de Render se cubre ese objetivo. El costo es que el servidor se duerme tras 15 minutos sin uso y tarda alrededor de un minuto en despertar.

## What Changes

- Publicar el código en un repositorio público de GitHub con licencia MIT. Antes de subirlo se reescribe el autor de los commits existentes al correo privado de GitHub, para no exponer el correo personal.
- El servidor pasa a ser un servidor HTTP con una ruta de salud (`/health`) y el WebSocket en el mismo puerto, como exigen las plataformas en la nube.
- Build de producción del servidor: un único archivo JavaScript empaquetado que se ejecuta con `node`, sin `tsx`, para que arranque rápido al despertar.
- Seguridad mínima para un servidor público: solo se aceptan conexiones desde los sitios configurados (`ALLOWED_ORIGINS`) y hay un tope de salas nuevas por dirección IP.
- La pantalla "Jugar con amigos" avisa cuando el servidor está despertando, y la conexión reintenta sola hasta lograrlo.
- Configuración de despliegue versionada en el repo: `render.yaml` con una sola instancia, el `wrangler.jsonc` de la web y un flujo de GitHub Actions que corre pruebas, verificación de tipos y build en cada push.
- Guía paso a paso para los pasos que solo puede hacer el dueño de las cuentas: crear las cuentas, conectar el repo y definir las variables.
- Fuera de alcance: dominio propio, base de datos, cuentas de usuario, servidor siempre encendido (es pago), varias instancias del servidor y analítica.

## Capabilities

### New Capabilities
- `server-operations`: comportamiento del servidor como servicio público: chequeo de salud, configuración por variables de entorno, orígenes permitidos y límite de creación de salas por IP.

### Modified Capabilities
- `multiplayer-rooms`: se agrega el aviso de servidor despertando al crear una sala o unirse, con reintento automático de la primera conexión.

## Impact

- `apps/server`: servidor HTTP con `/health` y WebSocket en el mismo puerto, verificación de origen, límite por IP, script de build con esbuild y arranque con `node`.
- `apps/web`: `NetClient` con tiempo máximo para abrir la conexión y aviso de servidor despertando; `VITE_SERVER_URL` apunta a `wss://…onrender.com` en producción.
- Archivos nuevos: `LICENSE` (MIT), `render.yaml`, `.github/workflows/ci.yml`, guía de despliegue en el README.
- Historial de git reescrito una sola vez antes del primer push (5 commits, solo el autor). No afecta a nadie porque todavía no hay remoto.
- Dependencia nueva de desarrollo: `esbuild`.
- Servicios externos: GitHub, Cloudflare Workers y Render, todos en planes gratuitos.
- `apps/web/wrangler.jsonc` y `wrangler` como dependencia de desarrollo (el panel de Cloudflare ya no ofrece Pages para proyectos nuevos).
