# Design

## Context

Ver proposal.md (Why) y las specs de este cambio. Estado actual relevante (revisado en el código):

- `App` decide la primera pantalla en el inicializador de `useState`: onboarding si no hay perfil, `multiplayer` si hay una sesión guardada (`canResume`), si no el menú. No lee parámetros de la URL.
- `Lobby` muestra el código grande (`data-testid="room-code"`); no hay forma de compartirlo.
- `RaceScreen` recibe `RaceViewState` tanto de carreras locales como en línea: fase, `countdownRemainingMs`, `resumeRemainingMs`, `lastAnswer` (con `seq`, `correct`, `nitro`) y `finishTimeMs` del jugador. Con eso alcanza para detectar todos los eventos de sonido sin tocar motor ni servidor.
- En móvil (`Track.module.css`), la columna de nombre mide 88 px, con `white-space: nowrap` y `text-overflow: ellipsis`, y además lleva la posición y la etiqueta `N8`.
- `serverUrl()` devuelve `VITE_SERVER_URL` tal cual. En producción se configuró `https://…` por error y el bundle quedó con esa URL.
- `ci.yml` usa `actions/checkout@v4`, `actions/setup-node@v4` y `pnpm/action-setup@v4`. GitHub avisa que esas versiones corren sobre Node 20. Las últimas publicadas son v7.0.1, v7.1.0 y v6.1.0.
- El perfil (`mind-racer:profile:v1`) tiene validación estricta; agregarle campos obliga a migrarlo.

## Goals / Non-Goals

**Goals:**
- Que unirse a una sala en familia sea escanear o tocar un enlace.
- Que el feedback de la carrera se perciba sin mirar la pantalla, con un interruptor de silencio fácil de encontrar.
- Cerrar los pendientes técnicos del despliegue sin cambiar el comportamiento.

**Non-Goals:**
- Música de fondo, volumen por canal, sonidos personalizables.
- Enlaces con caducidad o invitaciones con permisos.
- Cambios en motor, protocolo o servidor.

## Decisions

### D1. Enlace de sala
- El enlace se arma con el origen de la página: `${location.origin}/?sala=${code}`. Funciona igual en la nube (`…workers.dev`) y en la red de casa (`http://192.168.x.x:5173`).
- `App` lee `sala` al iniciar con `URLSearchParams`, lo normaliza con `normalizeRoomCode` y lo quita de la barra con `history.replaceState` en cuanto lo toma, para que recargar no repita la acción.
- Flujo:
  - con perfil: abre la pantalla de multijugador con `autoJoinCode`;
  - sin perfil: guarda el código pendiente, muestra el onboarding y al terminar va al multijugador con ese código.
- `MultiplayerApp` llama a `session.join(code, …)` una sola vez. `join` gana la misma protección que `resume` (ignora la llamada si ya hay acción pendiente o jugador), así StrictMode no envía dos `join`.
- Si hay sesión guardada **y** enlace: si es la misma sala, se usa `resume`; si es otra, gana el enlace.
- Un código mal formado se muestra en `Entry` con el mismo mensaje local que al escribirlo; una sala inexistente devuelve el error del servidor ya existente ("No encontramos esa sala").

### D2. Código QR
- Se genera en el navegador con una librería pequeña y sin dependencias que produce SVG (candidata: `uqr`). Se verifica al implementar que esté mantenida y que funcione con ESM y Vite; la alternativa es `qrcode-generator`.
- Sin servicios externos: el código de la sala no sale del dispositivo y el QR funciona sin internet en la red de casa.
- Se dibuja negro sobre blanco con margen (zona de silencio) dentro de la tarjeta oscura, a unos 192 px, para que las cámaras lo lean bien.
- *Alternativa:* una API pública de QR. Se descarta por privacidad y porque dejaría de funcionar sin internet.

### D3. Compartir
- Con `navigator.share` disponible se comparte `{ title: "Mind Racer", text: "¡Ven a correr conmigo! Sala K7QF", url }`; si la persona cancela (`AbortError`), no pasa nada.
- Si no está disponible, se usa `navigator.clipboard.writeText(url)` y se muestra "Enlace copiado" durante 2 s.
- Ambas APIs exigen contexto seguro (HTTPS o `localhost`). En la red de casa por `http://192.168.x.x` no existen, así que el enlace también se muestra siempre en un campo de solo lectura que se selecciona entero al tocarlo.
- Sin ninguna de las dos APIs, el botón "Compartir" no se muestra (no haría nada); quedan el QR y el campo. Si el portapapeles rechaza la copia, se pide copiarlo del campo.

### D4. Sonidos con Web Audio
- Módulo `audio/sfx.ts` con un `AudioContext` creado de forma perezosa y sonidos sintetizados (oscilador + envolvente de ganancia), sin archivos de audio:

| Evento | Sonido |
|---|---|
| Cuenta regresiva (3, 2, 1) | tono corto de 440 Hz |
| Salida | tono de 880 Hz, más largo |
| Acierto | dos notas ascendentes cortas |
| Error | tono grave de onda cuadrada |
| Nitro | barrido ascendente |
| Llegada | arpegio corto |

- Volumen moderado (ganancia ~0,15) para no asustar a los niños.
- Un único listener global de `pointerdown` y `keydown` reanuda el `AudioContext` en la primera interacción (política de autoplay). Cualquier excepción de audio se ignora.
- *Alternativa:* archivos `.mp3`. Más trabajo de assets, peso y licencias, y no hace falta para efectos cortos.

### D5. Vibración
`navigator.vibrate` con patrones cortos: error `[60]`, nitro `[30, 40, 30]` y llegada `[80, 60, 160]`. Si la API no existe (Safari en iPhone), no se llama.

### D6. Detección de eventos
- Hook `useRaceFeedback(state, playerId)` en `RaceScreen`. Guarda en `useRef` el último valor visto de:
  - el segundo de la cuenta regresiva (también de la reanudación tras pausa local);
  - la fase;
  - `lastAnswer.seq` del jugador;
  - su `finishTimeMs`.

  Emite el sonido y la vibración correspondientes solo cuando esos valores cambian.
- Los valores iniciales se toman del primer estado sin emitir nada. Así, al reconectar a una carrera en curso no se repiten sonidos viejos.
- Funciona igual en local y en línea porque ambos producen `RaceViewState`. Los eventos de otros corredores no se miran (spec "Solo eventos propios").
- Para poder probarlo, `sfx` y `haptics` se inyectan en el hook.

### D7. Preferencia de sonido
- Clave nueva `mind-racer:settings:v1` con `{ "sound": true }`, separada del perfil para no migrarlo. Lectura y escritura tolerantes a almacenamiento bloqueado, igual que el perfil.
- Un store mínimo (`subscribe`/`get`) consumido con `useSyncExternalStore`, para que el interruptor del menú y el de la carrera se sincronicen.
- El botón (iconos `SpeakerHigh` y `SpeakerSlash`) va en el encabezado del menú, del lobby y de la carrera. Su nombre accesible es siempre "Silenciar" con `aria-pressed` (cambiar el nombre y el estado a la vez confunde a los lectores de pantalla); el `title` dice "Silenciar" o "Activar sonido".

### D8. Nombres en móvil
En la media query de 640 px:
- La columna pasa de 88 a 144 px: la posición y la etiqueta `N8` se apilan en una columna angosta (`2.º` sobre `N8`) a la izquierda, y el nombre usa los ~112 px restantes a 12/16 px.
- Se reemplaza `nowrap` + `ellipsis` por un salto de línea permitido hasta 2 líneas (`-webkit-line-clamp: 2`), con `overflow-wrap: anywhere` para nombres sin espacios. Dos líneas de 16 px caben en los 32 px de altura de la pista, así que el carril no crece.
- *Descartado al probar:* una línea pequeña con `2.º · N8` encima del nombre agrandaba cada carril a 58 px y la página dejaba de caber a 375 × 812 (842 px).
- "Desconectado" o "Salió" no caben junto al nombre: en celular se muestran como etiqueta pequeña sobre la pista, antes de la bandera.
- En pantallas anchas se mantiene una sola fila (posición · nombre · nivel · etiquetas).
- Verificado en el navegador a 375 × 812 px con 4 nombres de hasta 20 caracteres y teclado: la página mide 812 px y cada nombre se lee completo.

### D9. URL del servidor
`serverUrl()` normaliza el esquema: `https://` pasa a `wss://` y `http://` a `ws://`; `ws(s)://` queda igual. Se prueba con pruebas unitarias.

### D10. GitHub Actions
Actualizar a `actions/checkout@v7`, `actions/setup-node@v7` y `pnpm/action-setup@v6`. Antes, leer las notas de versión por cambios incompatibles en las entradas que usamos (`node-version`, `cache: pnpm`, lectura de `packageManager`). La verificación es el run en GitHub sin el aviso de Node 20.

## Risks / Trade-offs

- [iPhone en modo silencio puede no reproducir Web Audio] → Es comportamiento del sistema; el juego sigue igual y el aviso visual existe. Se documenta en el README.
- [Sonidos molestos en una sala con varios celulares] → El interruptor de silencio es visible en la carrera y la preferencia se recuerda.
- [Compartir o copiar no disponibles por `http` en la red de casa] → El enlace siempre se ve en un campo seleccionable (D3).
- [El enlace podría unir a alguien por accidente] → Solo une a la sala del enlace y la persona puede salir con "Salir de la sala"; las salas son privadas por código igual que antes.
- [Una librería de QR desmantenida] → Es una dependencia aislada en un componente; se puede reemplazar sin tocar el resto.
- [Las acciones v7/v6 cambian entradas] → Se revisan las notas de versión antes de actualizar, y el run del CI lo confirma.

## Migration Plan

- No hay migración de datos: la preferencia de sonido usa una clave nueva con valor por defecto "con sonido".
- Los enlaces solo existen desde este cambio. Los códigos escritos a mano siguen funcionando igual.
- Despliegue normal: push a `main`; Render no cambia de comportamiento y Cloudflare reconstruye la web.

## Open Questions

- Los timbres exactos de cada sonido se ajustan a oído durante la implementación; no cambian specs ni tareas.
