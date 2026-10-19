# Design

## Context

Ver proposal.md (Why) y las delta specs. Estado actual, revisado en el código:

- **Motor:**
  - `ChallengeSource` (`next(level, rng, recent)` / `check`) es la única puerta entre la carrera y los problemas. `RaceSession` y `LocalRaceSession` ya aceptan un `source` propio; hoy siempre se usa `mathChallengeSource`.
  - `Race` crea un `DifficultyController` por corredor y le pide a `source.next()` el nivel actual de ese corredor. Con `config.adaptiveDifficulty: false`, el nivel queda fijo en el elegido.
  - `recent` guarda los últimos 10 problemas de cada corredor (`RECENT_CHALLENGES`). `mathChallengeSource` reintenta hasta 20 veces si el problema está en `recent`.
  - Los bots solo miran `challenge.targetTimeMs` (`bots.ts`), no el nivel.
  - `publicChallenge.level`, `chosenLevel` y `maxLevel` se validan en el protocolo como enteros del 1 al 10.
- **Servidor (`Room`):**
  - `start()` arma un `RaceSession` con el nivel de cada alumno, sin bots en clase.
  - `broadcastRoom()` manda el estado de la sala a todos. `rejoin()` lo reenvía.
  - `lastRace` guarda el `raceStart` y los `results` de la última carrera de clase para la profesora.
- **Cliente:**
  - El progreso se aplica en dos lugares: `App` (`onFinish` de una carrera local) y `MultiplayerApp` (al recibir `results`). Ambos llaman a `applyRaceResult` con el nivel.
  - `Results` exige un `ProgressUpdate`. "Jugar de nuevo" reinicia con `snapshot.level`.
  - El desafío diario ya es una carrera especial: `App` le pone otro título a `RaceScreen` y una nota al salir.
  - `standingsRows` arma las celdas de la clasificación, y `toCsv` las reutiliza.

## Goals / Non-Goals

**Goals:**
- Que el motor no cambie: las tablas entran como otro `ChallengeSource`.
- Una sola definición de "práctica de tablas" (`TablesSelection`), compartida por el motor, el protocolo, el servidor y la web.
- Compatibilidad: un cliente nuevo con un servidor viejo (o al revés) sigue funcionando, sin carreras de tablas en clase.

**Non-Goals:**
- Cambiar `ChallengeSource`, `Race` o `DifficultyController`.
- Guardar la última selección de tablas en el dispositivo (alcanza con recordarla mientras la app está abierta, como `lastLevel`).
- Carreras de tablas en salas familiares: el servidor ignora `setTables` fuera de una sala de clase.

## Decisions

### D1. Generador de tablas como `ChallengeSource`
- Archivo nuevo: `packages/engine/src/challenges/math/tables.ts`, con:
  - `TablesSelection = { tables: number[]; divisions: boolean }`;
  - `TABLES_MIN = 2`, `TABLES_MAX = 10`, `TABLES_FACTOR_MAX = 10`;
  - `normalizeTables(selection)`: ordena, quita duplicados y valida el rango. Devuelve `null` si no queda ninguna tabla;
  - `createTablesSource(selection): ChallengeSource`.
- `createTablesSource` arma una sola vez el **grupo** de problemas posibles:
  - para cada tabla N y cada k de 1 a 10: `N × k` y `k × N`, con prompts distintos. Si coinciden (`N = k`, o la otra tabla también está elegida), queda un solo problema por prompt;
  - si `divisions`: `(N·k) ÷ N`, con k de 1 a 10.
- `check` reutiliza `parseIntegerAnswer`, igual que `mathChallengeSource`.
- Se exporta desde `packages/engine/src/index.ts`.
- **Alternativas:**
  - Un "nivel 11" o niveles parametrizados en `MATH_LEVELS`: rompería `levelSchema` (1–10), el perfil por nivel, el garaje y el selector de niveles.
  - Cambiar `ChallengeSource.next` para recibir opciones: tocaría la interfaz común a todas las variantes futuras por algo que un `source` nuevo ya resuelve.

### D2. Elegir sin repetir: filtrar, no reintentar
- `next(_level, rng, recent)` toma los problemas del grupo que no están en `recent` y elige uno con `rng.pick()`. Si no quedara ninguno (no pasa con los grupos actuales), elige de todo el grupo.
- El grupo más chico (una tabla sin divisiones) tiene 19 problemas, más que los 10 de `recent`, así que siempre quedan al menos 9 para elegir. La regla de los últimos 10 se cumple siempre, sin la suerte del reintento.
- La `key` es el prompt, así que `7 × 3` y `3 × 7` son problemas distintos, como dice la spec.
- Es determinista con la misma semilla: el grupo se arma en un orden fijo, y `recent` y `rng` son por corredor.
- **Alternativa:** un mazo barajado con estado por corredor. `ChallengeSource` es un objeto compartido y sin estado, así que habría que guardar el mazo por `rng` (un `WeakMap`) o cambiar la interfaz. El filtro da casi lo mismo con 19 problemas o más.

### D3. Nivel fijo 4 y sin adaptación
- Una carrera de tablas se crea con `level: 4` y `config: { adaptiveDifficulty: false }`. Así cada corredor tiene `chosenLevel = maxLevel = 4`, y el protocolo no cambia.
- Cada problema trae su propio nivel y tiempo:
  - multiplicación: `level: 4`, `targetTimeMs` del nivel 4 (3000 ms);
  - división: `level: 5`, `targetTimeMs` del nivel 5 (3500 ms).
  
  Ambos se leen de `getLevelDefinition`, sin duplicar números. Los bots y el impulso por respuesta rápida usan `targetTimeMs`, así que se comportan como en esos niveles.
- La UI nunca muestra ese 4 en una carrera de tablas. Muestra las tablas (D6, D7).

### D4. Protocolo
- `packages/protocol`:
  - `tablesSchema = z.strictObject({ tables: z.array(z.number().int().min(TABLES_MIN).max(TABLES_MAX)).min(1).max(9), divisions: z.boolean() })`. Además, `.transform(normalizeTables)` y un rechazo si queda `null`;
  - cliente → servidor: `{ type: 'setTables', tables: tablesSchema.nullable() }`. `null` vuelve a "Cada uno su nivel";
  - `room`: `tables: tablesSchema.nullable().optional()`;
  - `raceStart`: `tables: tablesSchema.optional()`. Si no viene, es una carrera por niveles.
- Todos los campos nuevos son opcionales, como `mode`, `role`, `car`, `raceNumber`. Un cliente viejo los ignora. Un servidor viejo responde `invalid-message` a `setTables`, y el cliente nuevo no muestra el selector si `room.tables` es `undefined`: solo lo muestra si el servidor lo envía (aunque sea `null`).

### D5. Servidor
- `Room` gana `tables: TablesSelection | null` (empieza en `null`).
- `setTables`:
  - si quien lo manda no es la profesora de una sala de clase, responde el error `not-host` y no cambia nada;
  - si no, guarda la selección y llama a `broadcastRoom()`.
  
  Se acepta en cualquier fase y vale desde la próxima carrera: la carrera en curso no cambia.
- `start()`: si `this.isClass && this.tables`, crea el `RaceSession` con `level: 4`, sin `level` por alumno, `source: createTablesSource(this.tables)` y `config: { ...raceConfig, adaptiveDifficulty: false }`. `raceStart` lleva `tables`. `lastRace.start` lo guarda junto con el resto, así la profesora reconectada vuelve a ver la columna "Tablas".
- `broadcastRoom()` agrega `tables: this.isClass ? this.tables : undefined`.
- **Alternativa:** guardar la selección en `create`. La sala dura toda la clase, y la profesora necesita cambiarla entre carreras (ver la spec de `classroom-mode`).

### D6. Web: práctica en solitario
- `Menu`: arriba de los niveles, pestañas "Niveles" y "Tablas".
  - En "Tablas": botones del 2 al 10 (`aria-pressed`, se pueden elegir varios), un interruptor "Con divisiones" y "Correr tablas", deshabilitado si no hay ninguna tabla elegida.
  - `onStartTables(selection)` es una prop nueva.
  - La pestaña y la selección elegidas se recuerdan en `App` mientras está abierta, como `lastLevel`.
- `LocalRaceControllerOptions` gana `tables?: TablesSelection`. Con tablas, pasa a `LocalRaceSession` `source`, `level: 4` y `adaptiveDifficulty: false`, y expone `readonly tables`.
- `App`:
  - el estado `race` / `results` lleva `tables`;
  - `RaceScreen` recibe `title="Tablas del 7 y del 8"`;
  - en `onFinish` con tablas **no** llama a `applyRaceResult`, `saveProfile` ni `newlyUnlocked`;
  - "Jugar de nuevo" vuelve a llamar a `startTables(tables)`.
- `Results`: `update` pasa a ser opcional, y se agrega `practice?: TablesSelection`. Con `practice`, muestra "Práctica de tablas del 7 y del 8 · no cuenta para el progreso" en lugar de los récords y desbloqueos.
- Texto en `ui/format.ts`:
  - `formatTables(selection)` → "7, 8 + divisiones" (columna del CSV y lobby de la profesora);
  - `tablesTitle(selection)` → "Tablas del 7 y del 8" (títulos y lobby del alumno).

### D7. Web: sala de clase
- `MultiplayerSession.setTables(selection | null)`.
- `TeacherBoard` (`BoardLobby`):
  - bloque "Qué practican" con dos opciones, "Cada uno su nivel" y "Tablas". La segunda muestra los mismos botones del 2 al 10 y el interruptor de divisiones;
  - cada cambio envía `setTables`. El valor mostrado es siempre el de `room.tables`, el servidor manda;
  - con tablas, la lista de alumnos oculta el `N{level}`;
  - el selector se extrae a un componente `TablesPicker`, compartido con el `Menu`.
- `Lobby` del alumno: si `room.tables` no es `null`, oculta el selector de nivel y muestra "Hoy: tablas del 7 y del 8".
- `NetworkRaceController` guarda `raceStart.tables` (`readonly tables: TablesSelection | null`).
- `MultiplayerApp`: si `race.tables`, marca la carrera como procesada sin aplicar el progreso, y pasa `practice` a los resultados.
- `standingsRows(results, presence, distance, tables)`:
  - agrega la columna "Tablas" después de "Nivel máximo" en `STANDINGS_HEADERS`;
  - con tablas: "Nivel" y "Nivel máximo" = "—" y "Tablas" = `formatTables`;
  - sin tablas: "Tablas" = "—".
  
  `toCsv` y `BoardResults` reciben `tables` del controlador. Los encabezados son siempre los mismos.

## Risks / Trade-offs

- **[`7 × 3` justo después de `3 × 7`]** → La spec los cuenta como problemas distintos (D2). Se acepta: es el mismo resultado, pero ver los dos órdenes es parte de lo que se practica. Si molesta, se puede evitar el "mismo resultado" en los últimos 2 sin cambiar la spec de los 10.
- **[El 4 fijo se cuela en la UI]** (por ejemplo "N4" o "nivel 4" en resultados o en la pista) → Las tareas incluyen revisar cada lugar que muestra `chosenLevel` o `level` con una carrera de tablas, y probar los textos.
- **[Un cliente viejo en una sala con tablas]** → Recibe `raceStart` sin entender `tables`. Juega bien la carrera, pero su progreso cuenta la carrera como nivel 4. Se acepta: el cliente web se despliega junto con el servidor, así que la ventana es corta.
- **[La profesora cambia las tablas mientras corren]** → No afecta la carrera en curso, solo la próxima (D5). El tablero solo muestra el selector en el lobby.
- **[Garaje sin carreras de tablas]** → Un alumno que solo practica tablas en clase no desbloquea autos. Es lo que pide la spec: si se quiere premiar la práctica, va en otro cambio.

## Migration Plan

- Sin migración de datos: no cambia el perfil ni el almacenamiento local.
- Desplegar el servidor y la web juntos, como siempre. Si se vuelve atrás, el cliente deja de mostrar el selector de tablas en clase (porque `room.tables` vuelve a faltar), y la práctica en solitario sigue funcionando porque es solo del cliente.
