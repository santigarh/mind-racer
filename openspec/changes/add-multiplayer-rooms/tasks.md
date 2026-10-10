# Tasks

## 1. Motor: nivel por corredor y tiempo de respuesta informado

- [x] 1.1 Agregar `RunnerSpec.level` opcional (por defecto `RaceOptions.level`), crear cada `DifficultyController` con el nivel de su corredor y exponer `chosenLevel` en `RunnerState` y `RunnerResult`; verificar con pruebas de "Corredores con niveles distintos" y "Rangos independientes", y que las pruebas existentes del motor pasan sin cambios
- [x] 1.2 Agregar `responseMs` opcional a `submitAnswer` y usarlo para el impulso y la regla de respuesta rápida, aplicando el evento en `atMs`; verificar con las pruebas "Tiempo compensado" y "Sin tiempo informado" y con una prueba de determinismo que incluya `responseMs`
- [x] 1.3 Generalizar `LocalRaceSession` en `RaceSession` (varias personas con su nivel, bots con su nivel, `submit(runnerId, …, responseMs?)`, `finishNow(atMs)`), dejando `LocalRaceSession` como envoltorio con la API actual; verificar con pruebas de sesión con 2 personas y 2 bots y de `finishNow` igual a esperar, y que `apps/web` pasa sus pruebas sin cambios

## 2. Protocolo compartido

- [x] 2.1 Crear `packages/protocol` con `zod` y los esquemas de mensajes cliente → servidor y servidor → cliente de D3 (incluido `PublicChallenge` sin respuesta); verificar con pruebas que aceptan mensajes válidos y rechazan nombres de 0 o 21 caracteres, niveles 0 u 11 y tipos desconocidos
- [x] 2.2 Agregar utilidades de código de sala (alfabeto sin ambiguos, normalización a mayúsculas) y el límite de tamaño de mensaje; verificar con pruebas que `k7qf` se normaliza a `K7QF` y que los códigos generados nunca contienen `0`, `O`, `1`, `I` ni `L`

## 3. Servidor: salas

- [x] 3.1 Crear `apps/server` (Node + TypeScript + Vitest + `tsx`) con `PORT` configurable y escucha en `0.0.0.0`; verificar que `pnpm --filter server dev` arranca y responde a una conexión WebSocket
- [x] 3.2 Implementar `RoomManager` (crear sala con código único, buscar por código, tope de salas, cierre tras 60 s sin conexiones) con reloj inyectado; verificar con pruebas de "Sala nueva", "Código inexistente" y "Sala vacía"
- [x] 3.3 Implementar `Room` en estado lobby: unirse, capacidad de 4, cambio de nivel, mensajes `room` a todos, anfitrión inicial y transferencia, salida y validación de mensajes; verificar con pruebas de "Código válido", "Sala llena", "Cuarto jugador", "Otro jugador cambia de nivel", "El anfitrión se va" y "Mensaje inválido"
- [x] 3.4 Implementar el adaptador `ws` (conexiones, parseo con `protocol`, límite de tamaño y de 20 respuestas por segundo, `ping`/`pong` con RTT EWMA); verificar con una prueba de integración con dos clientes Node reales que crean y se unen a una sala

## 4. Servidor: carrera multijugador

- [x] 4.1 Iniciar la carrera desde el lobby (solo anfitrión): bots de relleno en orden Tortuga, Crucero, Turbo con el nivel mínimo, `raceStart` con corredores y niveles, bucle de 50 ms con `state` a 20 Hz; verificar con pruebas de "Invitado intenta iniciar", "Anfitrión inicia", "Dos personas" y "Sala llena"
- [x] 4.2 Procesar `answer` con compensación de latencia (`responseMs` con descuento de RTT, tope de 150 ms) y responder con el resultado y el siguiente `PublicChallenge`; verificar con pruebas de "Respuesta oculta", "Respuesta validada por el servidor", "Conexiones distintas" y "Latencia exagerada"
- [x] 4.3 Implementar desconexión y `rejoin` con token dentro de 30 s (corredor que sigue frenando, estado y desafío reenviados) y marca de desconectado; verificar con pruebas de "Vuelve a tiempo" y "No vuelve"
- [x] 4.4 Implementar el fin anticipado (todas las personas llegaron, abandonaron o llevan más de 30 s desconectadas → `finishNow` y `results`), el abandono y la entrada tardía a `waiting`; verificar con pruebas de "Las personas ya llegaron", "Una persona sigue corriendo", "Desconexión reciente", "Salir a mitad de carrera" y "Llegada tardía"
- [x] 4.5 Implementar la vuelta al lobby tras `results`, pasando a jugadores a quienes esperaban, y la revancha con nueva semilla; verificar con la prueba "Revancha"
- [x] 4.6 Prueba de integración de punta a punta con servidor real y dos clientes Node: crear, unirse, elegir niveles 8 y 2, correr una carrera corta, recibir `results` con niveles y bots; verificar que pasa en `pnpm test`

## 5. Web: cliente de red y pantallas

- [x] 5.1 Extraer la interfaz `RaceViewSource` y renombrar el controlador actual a `LocalRaceController` sin cambiar su comportamiento; verificar que todas las pruebas web existentes pasan
- [x] 5.2 Implementar el cliente WebSocket (URL desde `VITE_SERVER_URL` o `ws://<hostname>:8787`, validación con `protocol`, reconexión con espera creciente y `rejoin` con `sessionStorage`); verificar con pruebas usando un socket falso, incluida la reconexión
- [x] 5.3 Implementar `NetworkRaceController` (estado desde `state`, estimación de posición con la física del motor y corrección suave, `submit` → `answer`, sin pausa, sin `finishNow`); verificar con pruebas de estimación entre mensajes, de corrección y de que ocultar la pestaña no pausa
- [x] 5.4 Agregar "Jugar con amigos" al menú y las pantallas "Crear sala" y "Unirse" (código, errores "No encontramos esa sala" y "La sala está llena"); verificar con Testing Library
- [x] 5.5 Implementar la pantalla `Lobby` (código grande, personas con nivel, anfitrión, selector de nivel limitado a los desbloqueados, "Iniciar carrera" solo para el anfitrión, mensajes de espera y de carrera en curso); verificar con Testing Library los escenarios de lobby, nivel propio y nivel bloqueado
- [x] 5.6 Adaptar `RaceScreen` y `Results` al modo multijugador (nivel junto al nombre, corredor desconectado, "Reconectando…", "Volver a la sala", abandono que vuelve al lobby) y aplicar el progreso con el nivel elegido; verificar con Testing Library los escenarios de "Familia en la pista", "Indicador de conexión" y "Desbloqueo en familia"

## 6. Desarrollo en red local e integración

- [x] 6.1 Hacer que `pnpm dev` levante web (con `--host`) y servidor en paralelo, y documentar en el README cómo jugar en la red local y el permiso del firewall de Windows; verificar siguiendo el README desde cero
- [x] 6.2 Prueba manual con dos pestañas o dispositivos en la red local: crear sala, unirse por código, niveles distintos, carrera completa con bots de relleno, desconectar y reconectar una pestaña, revancha; verificar sin errores en consola ni en el servidor
- [x] 6.3 Verificar que `pnpm test`, `pnpm typecheck` y `pnpm build` pasan desde la raíz y que la carrera local contra bots funciona igual que antes

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando la revisión esté completa.
- Decidir el hosting gratuito antes de publicar el multijugador en internet.
