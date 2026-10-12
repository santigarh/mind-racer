# Proposal

## Why

La familia quiere un motivo para jugar un ratito cada día. Hoy cada carrera es distinta y nada invita a volver mañana. Un desafío diario igual para todos los del mismo nivel, que se juega una sola vez y alimenta una racha de días, crea el hábito. Compartir el resultado por mensaje permite picarse en familia sin necesidad de servidor ni base de datos.

## What Changes

- **Desafío de hoy** en el menú: una carrera contra bots cuya semilla sale de la fecha local y del nivel. Todos los que lo corran el mismo día en el mismo nivel reciben los mismos problemas y los mismos rivales, en cualquier dispositivo.
- **Nivel del desafío**: por defecto, el nivel máximo desbloqueado; se puede elegir cualquier nivel desbloqueado antes de correr.
- **Sin adaptación**: en el desafío, la dificultad se queda en el nivel elegido, para que la carrera sea la misma para todos.
- **Una vez por día**: el desafío cuenta cuando la carrera termina, sea al llegar a la meta o al acabarse el tiempo. Después, el menú muestra "Hecho hoy" con el resultado y cuánto falta para el siguiente. Si la persona sale a mitad de carrera, puede volver a intentarlo ese día.
- **Racha**: los días seguidos con el desafío terminado, más la mejor racha. Basta con terminar, sin importar el puesto. Si se salta un día, la racha vuelve a empezar.
- **Compartir resultado**: un texto corto con la fecha, el nivel, el puesto, el tiempo, las respuestas correctas y la racha, más el enlace al juego. Se envía con el menú de compartir del dispositivo, o se copia donde no haya menú.
- El desafío **cuenta como una carrera normal** para las estadísticas y los desbloqueos del nivel.
- Fuera de alcance: tabla compartida entre jugadores, desafío diario en línea o en salas, logros, notificaciones o recordatorios, y desafíos de días anteriores.

## Capabilities

### New Capabilities
- `daily-challenge`: el desafío del día (semilla por fecha y nivel, una vez por día), la racha de días y compartir el resultado.

### Modified Capabilities
- `adaptive-difficulty`: se agrega un modo de carrera sin adaptación, en el que todos los desafíos se quedan en el nivel elegido.

## Impact

- `packages/engine`:
  - opción `adaptiveDifficulty` en `RaceConfig`, activada por defecto, que respeta `DifficultyController`;
  - semilla diaria derivada con `hashSeed`.
- `apps/web`:
  - tarjeta "Desafío de hoy" en el menú;
  - variante diaria de la carrera y de los resultados;
  - almacenamiento nuevo `mind-racer:daily:v1`, separado del perfil, con la racha y los resultados recientes;
  - compartir resultado reutilizando la lógica de compartir del lobby.
- Sin cambios en el protocolo, el servidor ni el despliegue.
