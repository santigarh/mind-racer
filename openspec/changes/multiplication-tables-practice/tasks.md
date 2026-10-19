# Tasks

## 1. Motor: generador de tablas

- [x] 1.1 Crear `challenges/math/tables.ts` con `TablesSelection`, `TABLES_MIN`/`TABLES_MAX`/`TABLES_FACTOR_MAX` y `normalizeTables` (ordena, quita duplicados, `null` si queda vacío o fuera de rango) (D1); verificar con pruebas en `tables.test.ts` el escenario "Varias tablas" (`[8, 7, 7]` → `[7, 8]`, sin divisiones), una selección vacía y una tabla 11 (ambas → `null`)
- [x] 1.2 Implementar `createTablesSource`: grupo de problemas `N × k` y `k × N` (k de 1 a 10, sin prompts repetidos), divisiones `(N·k) ÷ N` si `divisions`, nivel y `targetTimeMs` de los niveles 4 y 5 leídos de `getLevelDefinition`, y `check` con `parseIntegerAnswer` (D1, D3); verificar con pruebas los escenarios "Tabla del 7" (19 problemas exactos), "Orden mezclado", "Nada fuera de las tablas elegidas" (3 y 9), "Divisiones de la tabla del 7" (aparece `21 ÷ 7`, nunca `21 ÷ 3`) y "Divisiones apagadas"
- [x] 1.3 Elegir filtrando `recent` en vez de reintentar (D2); verificar con pruebas "Una sola tabla" (500 problemas de la tabla del 2 con `recent` de 10: ninguno idéntico a uno de los 10 anteriores) y "Misma semilla" (dos secuencias de las tablas del 4 y del 5 con la misma semilla son iguales)
- [x] 1.4 Exportar desde `packages/engine/src/index.ts` y probar una carrera completa con `LocalRaceSession({ level: 4, source: createTablesSource(...), config: { adaptiveDifficulty: false } })`; verificar en `session.test.ts` el escenario "Racha rápida" (tras 5 respuestas rápidas correctas, el siguiente problema sigue siendo de la tabla elegida y `maxLevel` es 4) y que la carrera termina con bots

## 2. Protocolo

- [x] 2.1 Agregar `tablesSchema` (normaliza con `normalizeTables` y rechaza si queda `null`), el mensaje `setTables` (`tables` o `null`), `tables` opcional y anulable en `room` y `tables` opcional en `raceStart` (D4); verificar en `messages.test.ts` que validan con y sin los campos nuevos, que `[8, 7]` llega como `[7, 8]`, y que una tabla 1, una 11, una lista vacía o un campo extra se rechazan

## 3. Servidor

- [x] 3.1 `Room` guarda `tables`, maneja `setTables` (solo la profesora de una sala de clase; si no, error `not-host`) y lo incluye en `broadcastRoom()` solo en salas de clase (D5); verificar en `Room.class.test.ts` los escenarios "Un alumno intenta cambiarlo", "La elección se mantiene" (después de "Nueva carrera") y que la profesora reconectada recibe `room` con las tablas; y en `Room.lobby.test.ts` que una sala familiar no envía `tables` y rechaza `setTables`
- [x] 3.2 `start()` con tablas: `RaceSession` con nivel 4, generador de tablas y sin adaptación; `raceStart` (y `lastRace.start`) llevan `tables` (D5); verificar en `Room.class.test.ts` los escenarios "Hoy practicamos el 7" (alumnos con niveles 2 y 8 reciben problemas de la tabla del 7), "Carrera de tablas sin bots" y "Volver a los niveles" (con `null`, cada uno recibe problemas de su nivel)

## 4. Web: selector y práctica en solitario

- [x] 4.1 Agregar `formatTables` ("7, 8 + divisiones") y `tablesTitle` ("Tablas del 7 y del 8", "Tablas del 9") en `ui/format.ts` (D6); verificar con pruebas unitarias una tabla, dos, tres ("del 6, del 7 y del 8") y con divisiones
- [x] 4.2 Crear `TablesPicker` (botones 2–10 con `aria-pressed`, interruptor "Con divisiones" apagado por defecto) y las pestañas "Niveles" / "Tablas" en `Menu`, con "Correr tablas" deshabilitado sin tablas (D6); verificar en `Menu.test.tsx` "Ninguna tabla" y que elegir 8 y 7 llama a `onStartTables({ tables: [7, 8], divisions: false })`, también con un perfil que solo tiene el nivel 1
- [x] 4.3 `LocalRaceController` acepta `tables` y arma la sesión con el generador, nivel 4 y sin adaptación (D6); verificar en `LocalRaceController.test.ts` que el primer desafío es de la tabla elegida y que `controller.tables` la expone
- [x] 4.4 `App`: título de la carrera con `tablesTitle`, sin `applyRaceResult` ni desbloqueos del garaje al terminar una práctica, y "Jugar de nuevo" con las mismas tablas; `Results` con `update` opcional y `practice`, que muestra "no cuenta para el progreso" y no muestra el nivel 4 (D6); verificar en `App.test.tsx` los escenarios "Principiante practica la tabla del 7", "Ganar una práctica" (perfil y garaje sin cambios en el almacenamiento) y "Jugar de nuevo"

## 5. Web: sala de clase

- [x] 5.1 `MultiplayerSession.setTables` y bloque "Qué practican" en `BoardLobby` con `TablesPicker`, que muestra siempre `room.tables` y oculta el selector si el servidor no envía el campo (D4, D7); verificar en `TeacherBoard.test.tsx` "Lobby de una carrera de tablas" ("Tablas: 9 + divisiones", lista sin `N{level}`) y que elegir una tabla envía `setTables`
- [x] 5.2 `Lobby` del alumno: con `room.tables`, ocultar el selector de nivel y mostrar "Hoy: tablas del 7 y del 8" (D7); verificar en `StudentView.test.tsx` el escenario "El alumno sabe qué se practica" y que sin tablas el selector sigue igual
- [x] 5.3 `NetworkRaceController` guarda `raceStart.tables`, y `MultiplayerApp` no aplica el progreso de una carrera de tablas y pasa `practice` a los resultados (D7); verificar en `MultiplayerApp.test.tsx` el escenario "Carrera de tablas en clase" (perfil sin cambios y aviso en resultados) y que una carrera por niveles sigue desbloqueando ("Desbloqueo en familia")
- [x] 5.4 Columna "Tablas" en `STANDINGS_HEADERS` (después de "Nivel máximo") y `standingsRows`/`toCsv`/`BoardResults` reciben las tablas de la carrera (D7); verificar en `standings.test.ts` y `csv.test.ts` los escenarios "Carrera de tablas", "Subió de nivel" (tablas "—") y "Mismas columnas en todas las carreras"
- [x] 5.5 Revisar cada lugar que muestra `chosenLevel` o `level` durante y después de una carrera de tablas (pista, HUD, resultados del alumno, tablero en carrera) para que no aparezca "nivel 4" ni "N4"; verificar con una prueba de `RaceScreen` o `Results` que en una práctica no aparece el texto "nivel 4"

## 6. Integración

- [x] 6.1 Correr `pnpm test` y `pnpm typecheck` en la raíz y verificar que pasan sin fallos
- [ ] 6.2 Prueba manual en local: una práctica en solitario de la tabla del 7 con divisiones hasta el final (el perfil no cambia), y una sala de clase con dos alumnos de niveles distintos donde la profesora elige las tablas del 7 y del 8, corre, pulsa "Nueva carrera" (la elección sigue), recarga el tablero y descarga el CSV; verificar que los dos alumnos recibieron problemas de esas tablas, el lobby del alumno decía "Hoy: tablas del 7 y del 8" y el CSV dice "7, 8" en tablas y "—" en los niveles
