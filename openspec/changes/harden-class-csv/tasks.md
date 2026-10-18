# Tasks

## 1. Protocolo

- [x] 1.1 Agregar `raceNumber` y `startedAt` opcionales a `raceStart` (D3); verificar con pruebas de `messages.test.ts` que un `raceStart` con y sin los campos nuevos valida, y que un `raceNumber` no entero se rechaza

## 2. Servidor

- [x] 2.1 `Room` cuenta las carreras (`raceCount`) y envía `raceNumber` y `startedAt` (el `epoch`) en cada `raceStart` (D3); verificar con pruebas que la primera carrera trae 1, la segunda 2, y que `startedAt` coincide con el reloj de la sala al iniciar
- [x] 2.2 Guardar `lastRace` (el `raceStart` y los resultados) al terminar una carrera de clase, borrarlo al iniciar la siguiente y al cerrar la sala, y reenviarlo a la profesora en `rejoin` cuando no hay carrera en curso (D2); verificar en `Room.class.test.ts` los escenarios "Recarga en la pantalla de resultados" (la profesora recibe `raceStart` con el mismo número y luego `results`) y "Ya empezó otra carrera" (recibe la carrera en curso), que un alumno que se reconecta no recibe `results`, y que una sala familiar no guarda nada

## 3. CSV y columnas

- [x] 3.1 Escape de fórmulas en `cell()`: anteponer `'` a los valores que empiezan con `=`, `+`, `-`, `@`, tabulación o retorno de carro, antes de las comillas (D1); verificar en `csv.test.ts` los escenarios "Nombre con forma de fórmula" (`=1+1` → `'=1+1`), `@SUMA`, `-Ana` y un nombre con `=` y `;` (apóstrofo y comillas), y "Nombre común" (`Ana` sin cambios)
- [x] 3.2 Crear `standingsRows(results, presence, distance)` en `classroom/` con las 11 columnas, estados ("Llegó", "Sin llegar", "Se fue", "Desconectado"), tiempo "—", avance y precisión "sin respuestas" (D4); verificar con pruebas unitarias los escenarios "Alumno que abandonó", "Alumno desconectado al terminar", "Alumno sin respuestas" y "Subió de nivel"
- [x] 3.3 `toCsv` usa `standingsRows` con los encabezados nuevos, y `csvFileName` recibe la fecha de inicio de la carrera (D3, D4); actualizar `csv.test.ts` (encabezados, fila de ejemplo y "Llevarse los resultados" con 28 filas más encabezado) y verificar "Carrera que cruza la medianoche" (inicio el 17, nombre con 2026-10-17)

## 4. Cliente y tablero

- [x] 4.1 `NetworkRaceController` expone `raceNumber`, `startedAt` y la distancia de la carrera, y conserva `presence` de los resultados para el tablero (D3, D4); verificar en `NetworkRaceController.test.ts` que los valores llegan desde `raceStart`, que faltan sin error con un servidor viejo, y que `presence` 'left' de un resultado queda disponible
- [x] 4.2 `BoardResults` muestra la tabla con `standingsRows` y descarga con el `raceNumber` y `startedAt` de la carrera; `MultiplayerApp` deja de usar `seenSeeds` y solo recurre al contador local y la fecha actual si el servidor no envía los campos (D3, D4); verificar en `TeacherBoard.test.tsx` las columnas nuevas y el nombre del archivo descargado
- [x] 4.3 Recarga de la profesora de punta a punta con la red falsa: terminar la segunda carrera, reconectar y comprobar que el tablero vuelve a mostrar la clasificación y que "Descargar CSV" baja `...-2.csv`; verificar con una prueba en `MultiplayerApp.test.tsx` (o en el harness de `classroom/`) que cubra "Recargar no reinicia la numeración"

## 5. Integración

- [x] 5.1 Correr `pnpm test` y `pnpm typecheck` en la raíz y verificar que pasan sin fallos
- [x] 5.2 Prueba manual: abrir una sala de clase en local con dos alumnos, uno con nombre `=1+1` que abandona, terminar la carrera, recargar el tablero y abrir el CSV descargado en una planilla; verificar que la clasificación reaparece, el nombre se ve como texto y el estado dice "Se fue"

## Workflow follow-up

- Sincronizar la delta spec con `openspec/specs/classroom-mode/spec.md` y archivar el cambio cuando esté implementado y revisado.
