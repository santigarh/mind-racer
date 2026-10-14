# Design

## Context

Ver proposal.md (Why) y las specs de este cambio. Estado actual relevante (revisado en el código):

- **La pista:** `Track` dibuja a todos con el mismo ícono `CarProfile` de Phosphor, de perfil y mirando a la derecha. El color sale de `laneColor`: ámbar para el jugador, un color por perfil de bot y una paleta de 3 para las demás personas, asignada por id. `Results` usa el mismo `laneColor`.
- **Íconos disponibles:** `@phosphor-icons/react` trae `CarProfile`, `Motorcycle`, `Scooter`, `Truck`, `Van` y `Tractor`, todos de perfil. `Car`, `Jeep` y `Bus` se ven de frente y se descartan para la pista.
- **El progreso:**
  - el perfil (`mind-racer:profile:v1`) guarda carreras y victorias por nivel y `unlockedLevel`;
  - el desafío diario (`mind-racer:daily:v1`) guarda `bestStreak`;
  - ambos tienen validación estricta, y el patrón establecido es una clave nueva por función (`settings`, `daily`).
- **El protocolo:**
  - `create` y `join` llevan `name` y `level`;
  - `RoomPlayer` lleva id, nombre, nivel, conexión y estado;
  - los corredores de `raceStart` llevan id, nombre, tipo, nivel y `botProfile`;
  - los esquemas son `z.object`, que descarta campos desconocidos, así que agregar un campo opcional es compatible en ambos sentidos.
- **El servidor:** `Room` guarda `Player` (nombre, nivel, token, etc.) y arma `room` y `raceStart` a partir de él.
- **El cliente:**
  - `NetworkRaceController` arma `botProfiles` desde `raceStart.runners`;
  - `RaceViewState` es la interfaz común de carreras locales y en línea.

## Goals / Non-Goals

**Goals:**
- Que el progreso se vea en la pista, en todos lados con el mismo auto.
- Desbloqueos que no necesitan datos nuevos: todo se calcula a partir de lo ya guardado.
- Compatibilidad con clientes y servidores de la versión anterior durante el despliegue.

**Non-Goals:**
- Verificar en el servidor que la persona realmente desbloqueó su auto. Es un juego familiar, así que el servidor solo valida que exista en el catálogo.
- Cambiar de auto dentro de una sala, evitar pinturas repetidas, y arte o animaciones propias.

## Decisions

### D1. Catálogo compartido en `protocol`
- `packages/protocol/src/garage.ts` define los ids cerrados:
  - `CAR_BODIES = ['classic', 'motorcycle', 'scooter', 'truck', 'van', 'tractor']`;
  - `CAR_PAINTS = ['amber', 'red', 'purple', 'green', 'blue', 'cyan', 'white', 'gold']`;
  - `carSchema = z.object({ body: z.enum(CAR_BODIES), paint: z.enum(CAR_PAINTS) })`;
  - `DEFAULT_CAR = { body: 'classic', paint: 'amber' }`.
- Así el servidor y el cliente validan lo mismo.
- Nombres, íconos y colores son de presentación y viven en la web (`garage/catalog.ts`). Cada pintura es una variable CSS (`--paint-red`, etc.):

| Pintura | Color |
|---|---|
| amber | #ffb547 (el ámbar actual) |
| red | #ff5c5c |
| purple | #b98cff |
| green | #4ed37a |
| blue | #5b9dff |
| cyan | #4cd7f0 |
| white | #f2f2f2 |
| gold | #f5c542 |

### D2. Reglas de desbloqueo
- Funciones puras en `garage/unlocks.ts`:
  - `progressOf(profile, daily)` → `{ races, wins, unlockedLevel, bestStreak }`, sumando `races` y `wins` de todos los niveles;
  - `requirementOf(item)` → `{ kind: 'races' | 'wins' | 'level' | 'streak' | 'free', target }`;
  - `isUnlocked(item, progress)`;
  - `requirementText(item, progress)`, por ejemplo "Gana 3 carreras · 1/3" o "Racha de 3 días en el desafío · 2/3";
  - `newlyUnlocked(before, after)`.
- Las condiciones son las de las tablas de las specs "Vehículos" y "Pinturas". El desafío diario hecho una vez equivale a `bestStreak >= 1`.
- Al derivarse de datos que solo crecen (carreras, victorias, `unlockedLevel`, `bestStreak`), los desbloqueos son permanentes sin guardar nada extra.

### D3. Elección guardada
- Clave nueva `mind-racer:garage:v1` con `{ version: 1, body, paint }`. Lectura tolerante como en `settings` y `daily`.
- El auto efectivo es `effectiveCar(saved, progress)`: si la elección guardada no valida con `carSchema` o no está desbloqueada, se usa `DEFAULT_CAR`, pieza por pieza (una pintura válida se conserva aunque el vehículo no lo sea).
- Un store mínimo con `useSyncExternalStore`, como el de las preferencias, para que el menú, el garaje y la carrera lo vean igual.

### D4. Protocolo y servidor
- `create` y `join` ganan `car: carSchema.optional().catch(undefined)`. Un auto inválido no rechaza el mensaje: se trata como ausente (spec "Auto inválido").
- `roomPlayerSchema` y `raceRunnerSchema` ganan `car: carSchema.optional()`. El servidor siempre lo envía para personas; los bots no lo llevan.
- `Room.join` y `Room.create` reciben el auto (por defecto `DEFAULT_CAR`) y lo guardan en `Player`. `rejoin` no lo cambia. `broadcastRoom` y el `raceStart` lo incluyen.
- `MultiplayerSession.create/join` reciben el auto efectivo además del nombre y el nivel.

### D5. Dibujo en la pista y los resultados
- `RaceViewState` gana `cars: Readonly<Record<string, Car>>`:
  - en carreras locales, solo el jugador, con su auto efectivo, que `LocalRaceController` recibe por opción;
  - en línea, todas las personas, tomadas de `raceStart.runners`.
- `Track` y `Results`:
  - si el corredor tiene auto, usan el ícono del vehículo y `--paint-<pintura>` como `--lane-color`;
  - si no, el ícono clásico y `laneColor` como hoy (bots y versiones viejas).
  - Tu carril sigue con su fondo resaltado y la etiqueta "Tú".
- Si un ícono mira a la izquierda, se voltea con `transform: scaleX(-1)` para que todos miren a la meta. Esto se comprueba en el navegador al implementar.
- El `Lobby` muestra un ícono pequeño del auto de cada persona antes del nombre.

### D6. Pantalla del garaje
- Pantalla `Garage`, abierta desde un botón con el ícono `Garage` en el encabezado del menú.
- Contenido:
  - "Volver al menú";
  - la vista previa grande (el ícono a ~96 px sobre una pista corta);
  - "Vehículos" y "Pinturas" como grupos de botones con `aria-pressed`. Los bloqueados van deshabilitados, con un candado y el texto de su condición.
- En celular, la vista previa va arriba y las cuadrículas debajo, a 2–3 columnas.

### D7. Aviso de desbloqueo
- `App` (carreras locales y desafío) y `MultiplayerApp` (en línea) calculan `newlyUnlocked(antes, después)` al aplicar el resultado al perfil y al desafío.
- `Results` recibe la lista y añade insignias "Nuevo en el garaje: <nombre>", junto a "Desbloqueaste el nivel N".

## Risks / Trade-offs

- [Íconos con distinta orientación o proporción] → Se revisan en el navegador y se voltean o se ajusta su tamaño. Si alguno no se ve bien en 24 px, se reemplaza por otro de Phosphor sin cambiar la spec.
- [Pinturas iguales en una sala o parecidas a las de los bots] → Se acepta. El nombre, la posición y el resaltado de tu carril distinguen a cada quien.
- [Alguien edita su almacenamiento para usar el dorado] → Se acepta (no-goal). El servidor solo valida el catálogo.
- [Versiones mezcladas durante el despliegue] → El campo es opcional en ambos sentidos. Un cliente nuevo con servidor viejo no ve autos de los demás (todos clásicos) y no falla.

## Migration Plan

- Sin migración de datos: clave nueva con el clásico ámbar por defecto. Perfil y desafío sin cambios.
- Desplegar el servidor y la web juntos (push a `main`); el orden no importa por la compatibilidad de D4.

## Open Questions

- Ninguna que bloquee. Las condiciones exactas de desbloqueo se pueden ajustar después de que la familia lo pruebe.
