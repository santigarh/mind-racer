# Design

## Context

Ver proposal.md (Why). Estado actual que define el enfoque:

- `apps/web` es una SPA de Vite 8 + React 19 que se publica como Worker de Cloudflare con assets estáticos (`wrangler.jsonc`, `not_found_handling: single-page-application`). Las ramas se publican en direcciones de preview propias.
- El build genera un solo JS de ~540 KB y un CSS de ~40 KB, sin *code splitting*. No hay carpeta `public/`. El favicon es un SVG embebido en `index.html` que dibuja la × con texto en `monospace`.
- Las fuentes se cargan desde Google Fonts y son el único recurso de otro sitio. Los sonidos se sintetizan (`audio/sfx.ts`) y el estado del jugador vive en `localStorage`.
- El multijugador usa un WebSocket a otro origen (Render), con reintentos crecientes de hasta 5 s (`NetClient`). `MultiplayerSession` expone `offlineSince` y `Entry` decide entre "Conectando…" y "Despertando el servidor…".
- El enlace de sala es `/?sala=CÓDIGO` (`multiplayer/roomLink.ts`). `App` lo lee al arrancar.
- CI ejecuta `typecheck`, `test` y `build`.

## Goals / Non-Goals

**Goals:**

- Precargar el build completo para que la primera visita deje el juego disponible sin conexión.
- Que una versión nueva quede en espera hasta que el jugador decida o hasta el próximo arranque.
- Mantener testeable con inyección de dependencias la lógica nueva del cliente (actualización, instalación, estado de la red), como el resto de `apps/web`.

**Non-Goals:**

- Caché en tiempo de ejecución de recursos de otros sitios: después de este cambio no queda ninguno.
- Interceptar el WebSocket o simular el servidor sin conexión.
- Ver el service worker en `pnpm dev`. Se prueba con `vite build` + `vite preview`.

## Decisions

### D1. `vite-plugin-pwa` con `generateSW`

El manifiesto y el service worker los genera `vite-plugin-pwa` 2.x, que es compatible con Vite 8, en modo `generateSW` (Workbox).

- **Por qué**: el plugin calcula la lista de precarga con los nombres con hash del build, versiona el service worker y borra cachés viejas (`cleanupOutdatedCaches`). Hacerlo a mano exige mantener esa lista en cada build.
- **Alternativas descartadas**:
  - Un `sw.js` propio con un plugin de Vite que inyecte la lista: más código para lo mismo.
  - `injectManifest`: solo conviene con lógica propia en el service worker, y no la hay.

### D2. Precarga completa y una sola ruta de navegación

- **Precarga**: `globPatterns` cubre `js`, `css`, `html`, `woff2`, `png`, `svg` y `webmanifest`.
- **Navegación**: `navigateFallback: 'index.html'`. Cualquier navegación del sitio, con o sin parámetros, responde con el `index.html` precargado y la dirección no cambia. Así `readRoomLink` sigue viendo `?sala=K7QF` sin conexión, sin código especial.
- **Sin `runtimeCaching`**: el WebSocket va a otro origen y el service worker no lo intercepta. `/health` tampoco se pide desde el cliente.

### D3. Actualización en espera (`registerType: 'prompt'`)

- **Registro**: el service worker se registra desde código propio (`injectRegister: null`) con `registerSW` de `virtual:pwa-register`.
- **Módulo `pwa/updates.ts`**: un store mínimo (suscribirse y leer el estado) con `needRefresh: boolean` y `applyUpdate()`. `applyUpdate()` llama a `updateSW(true)`, que activa el service worker en espera y recarga.
- **Quién muestra el aviso**: solo `Menu` se suscribe al store, así que el aviso aparece en el menú y en ningún otro lado (carrera, sala, tablero). Esto no necesita lógica de "pantalla segura", porque lo garantiza dónde se monta el componente.
- **Aviso ignorado**: con `prompt`, la versión nueva queda esperando y el navegador la activa sola cuando se cierran todas las pestañas del juego. Eso cubre "Aviso ignorado" sin código extra.
- **Detección en una app que queda abierta**: al volver a ser visible (`visibilitychange`), y como máximo una vez por hora, se llama a `registration.update()`. Así una app instalada que vive días abierta también se entera.
- **Alternativa descartada**: `autoUpdate` con recarga inmediata. Puede recargar a mitad de una carrera o de una clase, que es justo lo que se quiere evitar.

### D4. Botón "Instalar app" (`pwa/install.ts`)

- **Captura temprana**: `beforeinstallprompt` puede dispararse antes de que React monte, así que se escucha desde `main.tsx`. El evento se guarda con `preventDefault()` y se expone en un store (`canInstall`, `install()`).
- **Cuándo se apaga**: con `appinstalled`, y al arrancar si `matchMedia('(display-mode: standalone)')` o `navigator.standalone` indican que ya es una app.
- **Dónde se muestra**: `Menu` recibe el store como prop opcional, igual que `daily`, para que los tests existentes no cambien.
- `preventDefault()` oculta la mini barra de Chrome. Es aceptable, porque el botón propio la reemplaza y Chrome sigue ofreciendo instalar desde la barra de direcciones.

### D5. Estado de la red en `MultiplayerSession`

- **Campo nuevo `deviceOffline`**: `MultiplayerView` lo toma de `navigator.onLine` y de los eventos `online`/`offline`, inyectables en las opciones para los tests.
- **Prioridad del aviso en `Entry`**: si está conectando y `deviceOffline`, muestra el aviso sin conexión antes que "Despertando…".
- **Reintento inmediato**: con `online`, la sesión llama a un `retryNow()` nuevo de `NetClient`, que cancela la espera del reintento y abre la conexión enseguida. La acción pendiente sigue en la cola de `NetClient` como hoy.
- **Por qué `navigator.onLine`**: `false` es confiable como "seguro sin red". `true` no garantiza nada, y en ese caso siguen los avisos actuales. No se hacen pings extra.
- El lobby mantiene "Reconectando…" como está. La spec solo cambia las pantallas de crear, unirse y volver.

### D6. Fuentes con Fontsource

- **Paquetes**: `@fontsource-variable/geist` y `@fontsource-variable/geist-mono`, importados en `main.tsx`. Vite copia los `woff2` al build y D2 los precarga.
- **Tokens**: `--font` y `--font-mono` pasan a los nombres de familia del paquete (`'Geist Variable'`, `'Geist Mono Variable'`) y conservan los respaldos actuales.
- **Subconjuntos**: si el paquete expone CSS por subconjunto, se importa solo `latin` (cubre ñ y tildes) para no precargar cirílico. Si no, se importan todos: son pocos cientos de KB.
- **Limpieza**: se quitan de `index.html` los `preconnect` y el `stylesheet` de Google.
- **Alternativa descartada**: precargar las respuestas de Google Fonts en tiempo de ejecución. Sigue dependiendo de un tercero en la primera visita y de las redes escolares que lo bloquean.

### D7. Íconos generados una vez y versionados

- **Fuente**: `public/icons/icon.svg` dibuja la × con dos rectángulos redondeados rotados ±45°, no con texto, para no depender de fuentes. También pasa a ser el favicon, en lugar del data-URI.
- **Variantes maskable y Apple**: salen del mismo SVG con fondo `#181818` de borde a borde, que tapa las esquinas redondeadas. La × ocupa menos de un cuarto del ancho y queda dentro del círculo central del 80 % (zona segura). Un SVG aparte para la maskable sería redundante.
- **Generación**: `pwa-assets.config.ts` y un script `icons` en `apps/web` usan `@vite-pwa/assets-generator` (dependencia de desarrollo) para generar `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` y `apple-touch-icon-180x180.png`. Los PNG se suben al repo. El build no los genera, así que CI no depende de binarios de imagen.

### D8. Manifiesto y `index.html`

- **Manifiesto** (en la config del plugin):
  - `id` y `start_url` `/`, `scope` `/`;
  - `name` y `short_name` "Mind Racer", `description` igual a la meta actual;
  - `lang: 'es'`, `display: 'standalone'`;
  - `theme_color` y `background_color` `#181818`, sin `orientation`;
  - los íconos de D7, con `purpose: 'maskable'` en la variante maskable.
- **`index.html`**: agrega `apple-touch-icon`, `apple-mobile-web-app-title` y `mobile-web-app-capable`. El plugin inyecta el `<link rel="manifest">`.

### D9. Encabezados de caché en Cloudflare (`public/_headers`)

Los assets estáticos de Workers leen `_headers` desde el directorio de assets y no lo sirven.

- **Sin caché**: `/`, `/index.html`, `/sw.js` y `/manifest.webmanifest` con `Cache-Control: no-cache`.
- **Caché larga**: `/assets/*` y `/workbox-*.js`, que llevan hash en el nombre, con `public, max-age=31536000, immutable`.
- **Por qué**: los navegadores ya ignoran la caché HTTP al buscar `sw.js`, así que su regla es redundancia defensiva. La que importa es la de `index.html` para el primer registro.

### D10. Tipos y tests

- **Tipos**: `vite-plugin-pwa/client` se suma a `types` en `tsconfig.json` para resolver `virtual:pwa-register`.
- **Tests de `updates.ts` e `install.ts`**: reciben por parámetro `registerSW`, `window` y `matchMedia`, así que no hace falta el módulo virtual.
- **Tests de `MultiplayerSession`/`NetClient`**: cubren `deviceOffline` y `retryNow()`.
- **Desarrollo**: `devOptions.enabled` queda en `false` para que `pnpm dev` no deje un service worker cacheando código viejo.

## Risks / Trade-offs

- **[Una versión rota queda guardada en los dispositivos]** → La precarga de Workbox es atómica: si falla la descarga, se mantiene la versión anterior. Como último recurso se publica un build con `selfDestroying: true`, que desregistra el service worker y limpia las cachés (ver Migration Plan).
- **[Clientes viejos conviven más tiempo con el servidor nuevo]** → Ya está en la propuesta: los cambios de protocolo deben seguir siendo compatibles con clientes anteriores, con campos opcionales como hasta ahora. Hay que revisarlo en cada cambio a `packages/protocol`.
- **[Una pestaña vieja queda abierta después de "Actualizar" en otra]** → Sigue funcionando con su JS ya cargado. El único chunk aparte es `workbox-window`, y se carga al arrancar, antes de que pueda haber una versión nueva. Si en el futuro se divide el bundle, una pestaña vieja podría pedir un chunk ya borrado. Hay que reconsiderarlo entonces.
- **[Safari puede borrar los datos de sitios no instalados tras 7 días sin uso]** → El juego instalado está exento. Sin instalar, el modo sin conexión puede perderse, y el progreso en `localStorage` ya tenía ese mismo riesgo.
- **[El comportamiento de `_headers` en Workers no se puede probar localmente]** → Se verifica en la URL de preview de la rama con `curl -I` antes de mergear.
- **[En la red de casa (`http://192.168.x.x`, ver README) no hay contexto seguro]** → El navegador no registra el service worker ni ofrece instalar. El registro comprueba `'serviceWorker' in navigator` y descarta cualquier error, así que el juego funciona igual que hoy, solo que sin modo sin conexión. El README lo aclara.
- **[Precargar ~1 MB en la primera visita con datos móviles]** → Es el mismo JS y CSS que ya se descarga, más las fuentes. Es aceptable.

## Migration Plan

1. Mergear y desplegar como siempre. La primera visita después del deploy registra el service worker y precarga. No hay datos que migrar.
2. Verificar en la preview de la rama:
   - los encabezados;
   - la instalación en Android y en Chrome de escritorio;
   - el modo avión: menú, carrera y `?sala=`;
   - el aviso de versión nueva con dos deploys seguidos.
3. **Rollback**: revertir el commit no alcanza, porque los dispositivos que ya tienen el service worker siguen sirviendo la versión guardada hasta que encuentran un `sw.js` nuevo. Para retirar el PWA, hay que publicar un build con `selfDestroying: true` del plugin y mantenerlo unas semanas antes de quitar el plugin.
