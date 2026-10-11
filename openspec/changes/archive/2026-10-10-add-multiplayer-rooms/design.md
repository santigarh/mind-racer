# Design

## Context

Ver proposal.md (Why) y las specs de este cambio. Estado actual relevante:

- `packages/engine`: `Race` es determinista con reloj inyectado (`start`, `advanceTo`, `submitAnswer(runnerId, input, atMs)`), oculta la respuesta (`snapshot()` solo expone `answerLength`; `peekChallenge()` la expone al motor) y deriva los desafíos por id de corredor. El nivel es único por carrera (`RaceOptions.level`) y se pasa a un `DifficultyController` por corredor.
- `LocalRaceSession` combina `Race` + `BotAgent` y procesa las respuestas de bots en orden temporal, pero asume un único jugador humano (`PLAYER_ID`).
- `apps/web`: `RaceController` adapta una sesión local a React (`subscribe`/`getState`/`submit`/`hold`); `RaceScreen`, `Results` y `App` dependen de esa forma.
- Restricciones: presupuesto cero; primero jugar en la red local de la casa; publicar en internet queda para después sin rediseñar.

## Goals / Non-Goals

**Goals:**
- Reutilizar el motor tal cual en el servidor como autoridad, con cambios mínimos y retrocompatibles para las carreras locales.
- Que la sala sea una clase independiente del transporte, testeable sin sockets y movible más adelante a otro entorno (p. ej. Durable Objects).
- Que la pantalla de carrera y la de resultados sirvan para local y multijugador con un controlador intercambiable.

**Non-Goals:**
- Escalar a muchas salas o a varios procesos; persistir salas ante un reinicio del servidor.
- Anti-trampas más allá de validar en el servidor y acotar la compensación de latencia (el nivel elegido se confía al cliente).
- Despliegue en internet, TLS (`wss://`) y dominios.

## Decisions

### D1. Estructura del monorepo
```
packages/engine     + nivel por corredor, responseMs opcional, RaceSession multi-humano
packages/protocol   NUEVO: mensajes cliente <-> servidor + validación (zod), compartido
apps/server         NUEVO: Node + ws; RoomManager, Room, adaptador WebSocket
apps/web            + pantallas de sala, NetworkRaceController, URL de servidor configurable
```
- *Alternativa:* tipos de mensajes dentro de `engine`. Se descarta para no mezclar reglas del juego con el transporte.

### D2. Cambios en el motor (retrocompatibles)
- `RunnerSpec.level?: number`. Si falta, se usa `RaceOptions.level` (las carreras locales no cambian). Cada `DifficultyController` se crea con el nivel de su corredor. `RunnerResult` y `RunnerState` agregan `chosenLevel`.
- `submitAnswer(runnerId, input, atMs, options?: { responseMs?: number })`: si llega `responseMs`, se usa para `q` y para la regla de "respuesta rápida" de la dificultad; el evento se sigue aplicando en `atMs`. Esto preserva el determinismo, porque el `responseMs` forma parte del evento.
- `LocalRaceSession` se generaliza a `RaceSession`, que recibe una lista de personas (`{ id, name, level }`) y perfiles de bots con su nivel. Expone `submit(runnerId, input, atMs, responseMs?)`, `finishNow(atMs)` (lo que hoy hace `RaceController.finishNow`) y `botProfiles()`. `LocalRaceSession` queda como envoltorio delgado con la API actual, para no tocar la app local.

### D3. Protocolo
Mensajes JSON por WebSocket, unión discriminada por `type`, validados con `zod` en ambos extremos. Esquema (resumen):

| Cliente → servidor | Servidor → cliente |
|---|---|
| `create { name, level }` | `joined { roomCode, playerId, token, room }` |
| `join { code, name, level }` | `room { players[], hostId, phase, waiting[] }` |
| `rejoin { code, token }` | `error { code, message }` |
| `setLevel { level }` | `raceStart { seed, distance, runners[] }` |
| `start {}` (solo anfitrión) | `state { t, phase, runners[] }` (20 Hz) |
| `answer { seq, input }` | `answer { outcome, challenge }` |
| `abandon {}` (vuelve al lobby) | `challenge { challenge }` (al empezar y al reconectar) |
| `backToRoom {}` (de resultados al lobby) | |
| `pong { id }` | `ping { id }` cada 2 s |
| `leave {}` | `results { results[] }` |

- `challenge` viaja como `PublicChallenge` (sin respuesta). `expected` solo se envía tras responder, para la retroalimentación "Era 56".
- Cada corredor de `state` y `results` lleva `presence`: `connected`, `disconnected` (puede volver dentro de 30 s) o `left` (abandonó o salió de la sala). Un booleano no distinguía "desconectado" de "se fue", y la spec los trata distinto.
- El estado de cada persona en `room` (`lobby`, `racing`, `results`, `waiting`) decide qué pantalla muestra el cliente. Quien sigue mirando resultados no entra en la revancha hasta enviar `backToRoom`.
- Límite de 4 KB por mensaje y 20 respuestas por segundo por jugador; si se excede, el mensaje se descarta y se responde `error`.
- *Alternativa:* Socket.IO. Se descarta por peso y porque no necesitamos sus fallbacks; `ws` + un cliente `WebSocket` nativo alcanza.
- *Alternativa:* validación manual (como `progress/storage.ts`). Con ~12 mensajes, `zod` reduce código y errores; es una sola dependencia compartida.

### D4. Sala y gestor de salas
- `RoomManager`: `Map<código, Room>`; genera códigos de 4 caracteres del alfabeto `ABCDEFGHJKMNPQRSTUVWXYZ23456789` y reintenta si choca; cierra salas sin conexiones tras 60 s; tope de 200 salas abiertas.
- `Room` no conoce sockets: recibe `connect(conn)`, `message(conn, msg)`, `disconnect(conn)`, `tick(nowMs)` y emite mensajes por una interfaz `Outbox`. El reloj se inyecta. El adaptador `ws` es una capa delgada encima.
- Estados de la sala: `lobby` → `racing` → `results` → (`lobby` al volver). Las personas que entran en `racing` van a `waiting` y pasan a jugadores al volver al lobby.
- Anfitrión: el de `joinedAt` más antiguo entre las personas presentes.
- Capacidad: 4 personas contando a las que esperan.

### D5. Bucle de carrera en el servidor
- `setInterval` de 50 ms por sala en `racing`: `session.advanceTo(now - raceEpoch)` y envío de `state` a todos (20 Hz ≥ 15 Hz de la spec).
- Una respuesta se procesa al recibirla: `atMs = now - raceEpoch`, `responseMs = max(1, atMs - issuedAt - min(rttMedido, 150))`.
- `rttMedido`: promedio móvil (EWMA α = 0,3) de los `ping/pong` cada 2 s. Antes del primer `pong` se usa 0, sin compensación.
- Por qué se descuenta el ida y vuelta completo: el desafío viaja al cliente (media vuelta) y la respuesta vuelve (otra media), y el servidor mide ambas.
- *Alternativa:* hacer correr el servidor unos 150 ms "en el pasado" y aplicar las respuestas en su hora compensada. Es más fiel, pero reordena eventos entre jugadores y complica el determinismo; el `responseMs` informado logra lo esencial, que es el mismo impulso para el mismo tiempo de pensamiento.

### D6. Bots de relleno
`4 − personas` bots con perfiles en orden Tortuga, Crucero, Turbo; su nivel es `min(nivel de las personas)`. Se reutiliza `BotAgent` sin cambios.

### D7. Fin de carrera
En cada tick: si cada persona llegó, abandonó o lleva más de 30 s desconectada, se llama `session.finishNow(atMs)` y se envía `results`. Si no, la carrera termina sola por meta o por el límite de 3 minutos.

### D8. Identidad, desconexión y reconexión
- Al entrar, el servidor genera `playerId` y un `token` aleatorio (`crypto.randomUUID()`). El cliente guarda `{ code, token }` en `sessionStorage`, de modo que sobrevive a recargar la pestaña pero no se comparte entre pestañas.
- Al cerrarse el socket, la persona queda `disconnected` con marca de tiempo; su corredor sigue en el motor sin responder y frena solo.
- Con `rejoin` dentro de 30 s se reasocia la conexión y se le envían `raceStart`, el `state` actual y su desafío vigente. Pasados 30 s, en el lobby se la quita de la sala y en una carrera queda como "desconectado" en la clasificación.
- El cliente reintenta con espera creciente (0,5 s, 1 s, 2 s… hasta 5 s) y muestra "Reconectando…".
- Un `rejoin` repetido a la misma sala por la misma conexión solo vuelve a sincronizar; nunca saca primero al jugador de la sala. Lo detectó la prueba manual: al recargar con React StrictMode se enviaban dos `rejoin` y el segundo sacaba a la persona de su propia carrera. Además, el cliente envía `resume` una sola vez.

### D9. Cliente web
- `RaceController` se convierte en una interfaz (`RaceViewSource`: `subscribe`, `getState`, `submit`, `playerId`, `hold`/`release`, `canFinishNow`/`finishNow`) con dos implementaciones: `LocalRaceController` (la actual) y `NetworkRaceController`. En red, `hold`/`release` no pausan, y `canFinishNow` es siempre falso porque el fin lo decide el servidor.
- `MultiplayerSession` agrupa la conexión, la sala y la carrera actual en un store para React. `MultiplayerApp` elige la pantalla según el estado del jugador en `room` y aplica el progreso apenas llegan los `results`, sin depender de que la pantalla de carrera siga montada, porque el `room` siguiente puede desmontarla antes.
- `NetworkRaceController` mantiene el último `state` y, entre mensajes, estima la posición de cada auto con su velocidad y el mismo decaimiento del motor (`DEFAULT_RACE_CONFIG`). Al recibir un `state` nuevo corrige suavemente en unos 100 ms para evitar saltos.
- `RaceScreen` muestra el nivel elegido junto al nombre en multijugador y un indicador "Reconectando…". Las demás personas tienen su propia paleta de colores de carril, asignada por id para que la pista y los resultados coincidan. La pausa por visibilidad solo se activa si el controlador la admite.
- Pantallas nuevas: botón "Jugar con amigos" en el menú → "Crear sala" o "Unirse" (campo de código) → `Lobby` → `RaceScreen` → `Results` con "Volver a la sala".
- La URL del servidor sale de `import.meta.env.VITE_SERVER_URL`, o por defecto `ws://<hostname de la página>:8787`. Así, quien abre `http://192.168.1.20:5173` en el celular se conecta solo al servidor de la misma PC.
- El progreso se aplica en el cliente con `applyRaceResult` y el nivel elegido, igual que en local.

### D10. Desarrollo y red local
- `apps/server`: `tsx watch src/main.ts` en desarrollo; `tsc` a `dist/` para producción. Escucha en `0.0.0.0` y en `PORT` (8787 por defecto).
- `pnpm dev` levanta web y servidor en paralelo. Vite corre con `--host` para que los celulares del wifi entren por la IP de la PC.
- README: cómo jugar en red local, incluido un aviso de permitir Node en el firewall de Windows.

### D11. Pruebas
- Motor: nivel por corredor, `responseMs` y `RaceSession` con varias personas, más las pruebas existentes sin cambios.
- `Room`/`RoomManager` con reloj y conexiones falsas: códigos, capacidad, anfitrión, entrada tardía, bots, compensación, desconexión y reconexión, fin anticipado y cierre de salas.
- Integración: servidor `ws` real en un puerto aleatorio con dos clientes Node que crean, se unen y corren una carrera corta (`config.distance` pequeña).
- Web: `NetworkRaceController` con un socket falso; Lobby y "Volver a la sala" con Testing Library.

## Risks / Trade-offs

- [El servidor cae y se pierden las salas en curso] → Aceptable para un juego en casa: el cliente muestra el error y vuelve al menú. Persistir salas es un non-goal.
- [Alguien elige un nivel bajo para ganar fácil] → El tope de velocidad lo acota. Entre familia se acepta confiar en el perfil local, sin cuentas.
- [Compensación de latencia abusable reportando pings altos] → El descuento tiene un tope de 150 ms. El servidor mide el ping; el cliente no lo declara.
- [El firewall de Windows bloquea a los celulares] → Paso documentado en el README; el servidor escucha en `0.0.0.0`.
- [Saltos visuales de los autos con wifi irregular] → Estimación con la física del motor y corrección suave; prueba manual con varios dispositivos.
- [`setInterval` por sala con muchas salas] → Fuera de alcance: el tope de 200 salas y el uso doméstico lo hacen irrelevante.
- [Diferencias de punto flotante entre la predicción del cliente y el servidor] → El cliente solo estima; el servidor siempre corrige.

## Migration Plan

- Los cambios del motor son aditivos: las carreras locales siguen con la misma API (`LocalRaceSession`, `RaceOptions.level`), y las pruebas existentes deben pasar sin cambios.
- El perfil local (`mind-racer:profile:v1`) no cambia de formato.
- Rollback: el multijugador es una entrada nueva en el menú; si falla, se oculta sin afectar el modo local.

## Open Questions

- Hosting gratuito para publicar en internet (plan gratis con WebSockets o la PC de casa con un túnel): se decide al publicar y no cambia specs ni diseño.
- Detalles visuales del lobby (avatares, colores por persona): se definen en la implementación.
