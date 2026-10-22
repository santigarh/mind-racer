# Tasks

## 1. Dependencias y fuentes propias

- [x] 1.1 Agregar a `apps/web` `vite-plugin-pwa` (2.x), su dependencia par `workbox-window` y `@vite-pwa/assets-generator` como dependencias de desarrollo, y `@fontsource-variable/geist` y `@fontsource-variable/geist-mono` como dependencias; sumar `vite-plugin-pwa/client` a `types` en `tsconfig.json` (D1, D10); verificar que `pnpm install` y `pnpm --filter web typecheck` pasan
- [x] 1.2 Importar las fuentes de Fontsource en `main.tsx` (solo el subconjunto `latin` si el paquete lo permite), cambiar `--font` y `--font-mono` en `styles/global.css` a las familias del paquete con los mismos respaldos, y quitar de `index.html` los `preconnect` y el `stylesheet` de Google Fonts (D6); verificar que `pnpm --filter web build` deja los `woff2` en `dist/assets`, que `dist/index.html` no menciona `googleapis` ni `gstatic`, y que en `vite preview` los textos se ven en Geist (escenario "Fuentes sin conexión")

## 2. Íconos

- [x] 2.1 Crear `apps/web/public/icons/icon.svg` (× ámbar `#ffb547` hecha con dos rectángulos redondeados rotados ±45° sobre `#181818` con esquinas redondeadas, sin texto), única fuente de todas las variantes (D7); verificar que se ve igual que el favicon actual
- [x] 2.2 Agregar `pwa-assets.config.ts` y el script `icons` en `apps/web/package.json` con `@vite-pwa/assets-generator` para generar `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png` y `apple-touch-icon-180x180.png` en `public/icons/` (maskable y Apple con fondo `#181818` de borde a borde), ejecutarlo y subir los PNG (D7); verificar que los cuatro archivos existen con esas medidas y que en la variante maskable la × queda dentro del círculo central del 80 %
- [x] 2.3 En `index.html`, reemplazar el favicon en data-URI por `/icons/icon.svg` y agregar `apple-touch-icon`, `apple-mobile-web-app-title` ("Mind Racer") y `mobile-web-app-capable` (D8); verificar en `vite preview` que la pestaña muestra el ícono

## 3. Manifiesto, service worker y encabezados

- [x] 3.1 Configurar `VitePWA` en `vite.config.ts`: `strategies: 'generateSW'`, `registerType: 'prompt'`, `injectRegister: null`, `devOptions.enabled: false`, el manifiesto de D8 con los íconos de D7, y Workbox con `globPatterns` de D2, `navigateFallback: 'index.html'`, `cleanupOutdatedCaches: true` y sin `runtimeCaching` (D1, D2, D8); verificar que `pnpm --filter web build` genera `dist/sw.js` y `dist/manifest.webmanifest`, que `index.html` enlaza el manifiesto, que el manifiesto no tiene `orientation` y que `pnpm --filter web test` sigue pasando con el plugin activo
- [x] 3.2 Crear `apps/web/public/_headers` con `no-cache` para `/`, `/index.html`, `/sw.js` y `/manifest.webmanifest`, y `public, max-age=31536000, immutable` para `/assets/*` y `/workbox-*.js` (D9); verificar que el archivo llega a `dist/_headers` y que la lista de precarga de `dist/sw.js` no lo incluye
- [x] 3.3 Verificar con `pnpm --filter web build && pnpm --filter web preview` en Chrome: DevTools → Application muestra el manifiesto sin errores e instalable, el service worker activo y la precarga completa; con "Offline" activado, recargar `/` muestra el menú y una carrera contra bots termina y guarda el progreso (escenarios "Abrir sin internet", "Carrera sin internet" y "Desafío diario sin internet")

## 4. Actualizaciones en el menú

- [x] 4.1 Crear `pwa/updates.ts`: un store con `needRefresh` y `applyUpdate()` que recibe por parámetro `registerSW` y `document`, registra solo si existe `navigator.serviceWorker`, descarta errores, llama a `registration.update()` al volver a ser visible y como máximo una vez por hora, y conectarlo en `main.tsx` con `virtual:pwa-register` (D3); verificar con `updates.test.ts` que `onNeedRefresh` activa `needRefresh`, que `applyUpdate()` llama a `updateSW(true)`, que no se busca una versión nueva dos veces en menos de una hora y que sin `serviceWorker` no hay errores
- [x] 4.2 `Menu` recibe la prop opcional `update` y, con `needRefresh`, muestra "Hay una versión nueva" con el botón "Actualizar", que llama a `applyUpdate()`; `App` la pasa solo al menú (D3); verificar en `Menu.test.tsx` el escenario "Aviso en el menú" y que sin la prop el menú no cambia, y en `App.test.tsx` que con `needRefresh` activo la pantalla de carrera no muestra el aviso
- [x] 4.3 Verificar en `vite preview` con dos builds seguidos (cambiando un texto) el escenario "Aviso en el menú" (el aviso aparece al volver al menú y "Actualizar" recarga con el texto nuevo y el mismo perfil, escenario "Actualización con progreso"), y "Aviso ignorado" (cerrar todas las pestañas y volver a abrir carga la versión nueva sin aviso)

## 5. Instalar app

- [x] 5.1 Crear `pwa/install.ts`: un store con `canInstall` e `install()` que recibe `window` por parámetro, guarda `beforeinstallprompt` con `preventDefault()`, se apaga con `appinstalled` y arranca apagado si `display-mode: standalone` o `navigator.standalone`; escucharlo desde `main.tsx` antes de montar React (D4); verificar con `install.test.ts` los tres casos y que `install()` llama a `prompt()` y apaga `canInstall` si el usuario acepta
- [x] 5.2 `Menu` recibe la prop opcional `install` y muestra "Instalar app" solo con `canInstall` (D4); verificar en `Menu.test.tsx` los escenarios "Navegador con instalación", "Navegador sin instalación propia" y "Ya instalada"

## 6. Jugar con amigos sin conexión

- [x] 6.1 Agregar `retryNow()` a `NetClient`: si está esperando un reintento, cancela la espera y abre la conexión enseguida conservando la cola; si no, no hace nada (D5); verificar en `NetClient.test.ts` que con un reintento pendiente de 5 s abre la conexión al instante y envía los mensajes en cola, y que estando `open` o `closed` no hace nada
- [x] 6.2 `MultiplayerSession` expone `deviceOffline` a partir de `navigator.onLine` y de los eventos `online` y `offline` (inyectables en las opciones), llama a `client.retryNow()` con `online` y quita los escuchadores al cerrarse (D5); verificar en `MultiplayerSession.test.ts` que `deviceOffline` sigue los eventos y que `online` provoca el reintento inmediato
- [x] 6.3 `Entry` recibe `deviceOffline` desde `MultiplayerApp` y, mientras conecta sin internet, muestra "Sin conexión a internet. Jugar con amigos necesita internet; mientras tanto puedes correr contra los bots." en lugar de los otros avisos (spec `multiplayer-rooms` "Servidor despertando"); verificar en `Entry.test.tsx` (o `MultiplayerApp.test.tsx`) los escenarios "Sin internet", "Vuelve la conexión" y que "Servidor dormido" y "Servidor despierto" siguen igual
- [x] 6.4 Verificar en `vite preview` con Chrome sin conexión que abrir `/?sala=K7QF` va a "Jugar con amigos" con el código y el aviso sin conexión, y que al volver la conexión con el servidor local (`pnpm dev:server`) entra a la sala sin pulsar nada (escenario "Enlace a una sala sin internet")

## 7. Documentación

- [x] 7.1 Actualizar `README.md`: sección "Instalar como app" (cómo instalar en Android, iOS y escritorio, qué funciona sin conexión y cómo llega una versión nueva), cómo probar el PWA con `build` + `preview` en vez de `dev`, cómo regenerar los íconos con `pnpm --filter web icons`, el aviso de que en la red de casa (`http://`) no hay modo sin conexión, y en "Publicar en internet" el rol de `_headers` y el rollback con `selfDestroying` (D9, Migration Plan); verificar que los comandos documentados funcionan tal como están escritos

## 8. Integración y despliegue

- [x] 8.1 Ejecutar `pnpm typecheck`, `pnpm test` y `pnpm build` en la raíz; verificar que pasan igual que en CI
- [ ] 8.2 Publicar la rama en la preview de Cloudflare y verificar con `curl -I` los encabezados de `/`, `/sw.js`, `/manifest.webmanifest` y un archivo de `/assets/`; en un Android real, instalar desde el botón, abrir en modo avión, jugar una carrera y el desafío diario, y abrir un enlace `?sala=` (escenarios de `installable-app`); en Safari para iOS, agregar a inicio y comprobar el ícono

## Workflow follow-up

- Archivar el change con `/opsx:archive` después de mergear y verificar en producción.
