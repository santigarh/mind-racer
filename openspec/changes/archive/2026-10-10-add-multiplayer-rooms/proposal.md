# Proposal

## Why

Math Racer hoy solo se juega contra bots en un dispositivo. La meta es que una familia compita en tiempo real desde sus propios dispositivos, aunque tengan edades y habilidades muy distintas: que papá corra en nivel 8 y su hija en nivel 2 y la carrera siga siendo reñida. El motor ya es determinista y sin dependencias de UI, así que puede ejecutarse en un servidor como fuente de verdad sin reescribirse.

## What Changes

- Salas privadas identificadas por un código corto: crear, unirse, lobby con jugadores y niveles, anfitrión que inicia la carrera y transferencia de anfitrión si se va.
- Cada persona elige su propio nivel (entre los desbloqueados en su perfil); la dificultad adaptativa trabaja alrededor del nivel de cada corredor.
- Carrera multijugador con el servidor como autoridad: el servidor ejecuta el motor, valida respuestas (la respuesta correcta nunca llega al cliente) y envía el estado de la carrera varias veces por segundo.
- Bots de relleno hasta completar 4 carriles, en el nivel más bajo de las personas de la sala.
- Compensación de latencia: el tiempo de respuesta descuenta el tiempo de ida y vuelta medido de cada jugador, con un tope.
- Desconexiones: el auto de quien se desconecta sigue frenando solo y la persona puede volver a la misma carrera durante 30 segundos.
- Cuando todas las personas llegaron (o se fueron), el servidor completa al instante a los bots y muestra resultados.
- La carrera multijugador cuenta para el progreso local de cada jugador en su propio nivel; en multijugador no hay pausa al ocultar la pestaña.
- Servidor Node con WebSockets dentro del monorepo, jugable en la red local de la casa sin costo; publicarlo en internet queda fuera de este cambio.
- Fuera de alcance: emparejamiento público, cuentas de usuario, chat, espectadores, ranking global y despliegue en internet.

## Capabilities

### New Capabilities
- `multiplayer-rooms`: ciclo de vida de una sala privada: código, unirse, lobby, niveles por jugador, anfitrión, capacidad y vuelta a la sala tras una carrera.
- `multiplayer-race`: carrera en tiempo real dentro de una sala: autoridad del servidor, bots de relleno, compensación de latencia, sincronización del estado, desconexión y reconexión, fin de carrera y progreso.

### Modified Capabilities
- `adaptive-difficulty`: el nivel inicial y el rango de adaptación pasan a calcularse sobre el nivel elegido por cada corredor, no sobre un nivel único de la carrera.
- `race-engine`: una misma carrera admite corredores con niveles elegidos distintos y la clasificación informa el nivel elegido de cada uno.

## Impact

- `packages/engine`: nivel por corredor, tiempo de respuesta informado externamente y una sesión de carrera reutilizable con varias personas y bots (hoy `LocalRaceSession` asume un solo jugador).
- Nuevo `packages/protocol`: mensajes cliente ↔ servidor con validación compartida.
- Nuevo `apps/server`: Node + `ws`, salas en memoria, puerto configurable.
- `apps/web`: pantallas para crear y unirse a salas, lobby, controlador de carrera en red y resultados con "Volver a la sala"; la URL del servidor es configurable.
- Dependencias nuevas: `ws`, `zod` y `tsx` (desarrollo del servidor).
- Las carreras locales contra bots mantienen su comportamiento actual.
