# Proposal

## Why

Mind Racer se juega sobre todo en celulares y tablets de familias y alumnos, pero hoy solo existe como pestaña del navegador: no se puede poner en la pantalla de inicio y sin internet no abre. Casi todo el juego ya funciona en el dispositivo (motor y bots en TypeScript puro, sonidos sintetizados, progreso, garaje y desafío diario en `localStorage`), así que la red solo hace falta para cargar la página. El PWA quedó pendiente del roadmap desde `family-polish`.

## What Changes

- **Instalable**: el juego publica un manifiesto de app web (nombre, colores, pantalla completa, íconos) y se puede agregar a la pantalla de inicio desde el navegador. Íconos de 192 y 512 px, una variante *maskable* y un `apple-touch-icon`, todos derivados del favicon actual (× ámbar sobre `#181818`).
- **Botón "Instalar app" en el menú**: aparece solo cuando el navegador ofrece instalar (Chrome, Edge y Android) y desaparece una vez instalada. En iOS se instala desde "Compartir → Agregar a inicio", sin botón propio.
- **Jugable sin conexión**: después de la primera visita, el juego abre y funciona sin internet en los modos locales: carrera contra bots, práctica de tablas, desafío diario, garaje y progreso.
- **Fuentes propias**: Geist y Geist Mono se sirven desde el propio juego en vez de Google Fonts, para que el juego se vea igual sin conexión y deje de depender de un servicio externo.
- **Sin internet, "Jugar con amigos" lo dice claro**: si el dispositivo no tiene conexión, al crear o unirse a una sala (familiar o de clase) se muestra "Sin conexión a internet" en vez de "Despertando el servidor". El juego sigue esperando y completa la acción cuando vuelve la conexión. Un enlace `?sala=CÓDIGO` abierto sin internet también abre el juego y muestra ese aviso.
- **Actualizaciones que no interrumpen**: cuando hay una versión nueva, el juego nunca se recarga solo. En el menú aparece "Hay una versión nueva" con el botón "Actualizar". Si nadie la aplica, la versión nueva se usa la próxima vez que se abra el juego.
- Fuera de alcance:
  - jugar con amigos o en clase sin internet, o en una red local sin servidor;
  - notificaciones push, sincronización en segundo plano y recordatorios del desafío diario;
  - instrucciones propias para instalar en iOS;
  - guardar el progreso en la nube o pasarlo entre dispositivos;
  - bloquear la orientación de la pantalla.

## Capabilities

### New Capabilities

- `installable-app`: instalar el juego como app, abrirlo y jugar sin conexión en los modos locales, y recibir versiones nuevas sin interrumpir una partida.

### Modified Capabilities

- `multiplayer-rooms`: cambia "Servidor despertando". Si el dispositivo no tiene internet, se avisa "Sin conexión a internet" en vez de "Despertando el servidor", y la acción pendiente se completa cuando vuelve la conexión.

## Impact

- `apps/web`:
  - `vite.config.ts`: dependencia nueva `vite-plugin-pwa` (Workbox), que genera el manifiesto y el service worker con precarga del build;
  - carpeta nueva `public/` con los íconos y `_headers`;
  - `index.html`: quita Google Fonts y agrega los íconos y las metaetiquetas de iOS;
  - `main.tsx` o `styles`: carga de las fuentes propias con `@fontsource-variable/geist` y `@fontsource-variable/geist-mono`;
  - módulo nuevo `pwa/` que registra el service worker, avisa de la versión nueva y ofrece instalar;
  - `screens/Menu`: aviso de versión nueva y botón "Instalar app";
  - `multiplayer/Entry`: aviso sin conexión.
- Deploy (Cloudflare Worker con assets estáticos): `_headers` para que `sw.js`, `index.html` y el manifiesto no queden en caché larga, y `/assets/*` sí.
- `packages/protocol` y `apps/server` no cambian. Con el service worker, un cliente anterior puede seguir en uso más tiempo hasta que se actualice. Por eso los cambios futuros al protocolo deben seguir siendo compatibles con clientes anteriores, como ya se hace.
