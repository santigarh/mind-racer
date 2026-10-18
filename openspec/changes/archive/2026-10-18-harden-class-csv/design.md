# Design

## Context

Ver proposal.md (Why) y la delta spec de `classroom-mode`. Estado actual (revisado en el código):

- **Motor:** `Race.result()` ya calcula `maxLevel`, `distance`, `accuracy` (0 si no hubo respuestas) y `correctPerMinute`. No hace falta tocarlo.
- **Servidor (`Room`):**
  - `finishRace()` arma `NetRunnerResult[]` con `presence` ('connected' | 'disconnected' | 'left'), se lo manda a quienes corrían y a la profesora, y después hace `this.race = null`. La clasificación no queda guardada en ningún lado.
  - Un alumno quitado o que abandonó queda en `race.left`, y `presence()` lo informa como `'left'`.
  - `rejoin()` solo reenvía `raceStart` y `state` si hay una carrera en curso.
  - El reloj de la sala (`options.now`) es `Date.now()` en producción.
- **Cliente:**
  - `NetworkRaceController.toRunnerResult()` descarta `presence`, así que el tablero no sabe quién se fue.
  - `MultiplayerApp` cuenta las carreras con un `useRef<Set<seed>>`: al recargar vuelve a 1.
  - `BoardResults` usa `new Date()` en el momento de la descarga.
  - `csv.ts > cell()` solo pone entre comillas los valores con `;`, `"` o saltos de línea.
- El nombre del alumno (`nameSchema`) acepta cualquier texto de 1 a 20 caracteres.

## Goals / Non-Goals

**Goals:**
- Que el CSV sea seguro de abrir y que una recarga de la profesora no le haga perder la clasificación ni la numeración.
- Mostrar en la tabla y el CSV los datos que ya se calculan.
- Compatibilidad: un cliente nuevo con un servidor viejo (o al revés) sigue funcionando, aunque sin los datos nuevos.

**Non-Goals:**
- Guardar resultados más allá de la última carrera, o fuera de la memoria del proceso.
- Agregar valores nuevos a `presence`.
- Reenviar resultados a los alumnos al reconectarse.

## Decisions

### D1. Escape de fórmulas con apóstrofo
- En `cell()`, antes de las comillas: si el valor empieza con `=`, `+`, `-`, `@`, `\t` o `\r`, se le antepone `'`. Después se aplican las comillas como hoy (si contiene `;`, `"` o saltos de línea).
- Se aplica a toda celda, no solo al nombre: así la regla no depende de saber qué columnas son texto libre. Los valores que genera la app (números con coma, `90 %`, `0:42,3`, estados) nunca empiezan con esos caracteres, así que no cambian.
- **Alternativas:**
  - Quitar los caracteres peligrosos del nombre en el servidor: cambiaría el nombre que ve todo el mundo y no protege otros campos.
  - Anteponer tabulación o espacio: depende de cómo cada planilla recorte los espacios, y es menos conocido que la recomendación habitual (OWASP), que es el apóstrofo.
- **Costo aceptado:** en Excel el apóstrofo se ve en la celda (`'=1+1`). Está escrito así en la spec.

### D2. La última clasificación vive en la sala
- `Room` gana `raceCount: number` (se incrementa en `start()`) y, solo en salas de clase, `lastRace: { start: RaceStartMessage; results: NetRunnerResult[] } | null`.
  - Se guarda en `finishRace()` antes de `this.race = null`.
  - Se borra en `start()` (empieza la siguiente) y en `close()`.
- En `rejoin()`, si `!this.race && player.role === 'teacher' && this.lastRace`, se envía `lastRace.start` y luego `{ type: 'results', results: lastRace.results }`. El cliente ya sabe procesar esos dos mensajes seguidos: `MultiplayerSession` crea el `NetworkRaceController` con `raceStart`, y este se queda con `results`.
- Memoria: como mucho 40 resultados más 40 corredores por sala de clase, unos pocos KB.
- **Alternativas:**
  - Guardar la clasificación en `localStorage` de la profesora: no cubre abrir el tablero en otra computadora, y duplicaría la fuente de verdad. Además, el servidor ya tiene el dato.
  - Un mensaje nuevo `lastResults`: obligaría a otra ruta en el cliente para algo que `raceStart` + `results` ya resuelven.
- **Solo la profesora:** el alumno aplica su resultado al perfil cuando recibe `results` (`applyRaceResult`). Reenviárselo tras una recarga se lo sumaría dos veces, porque `processedSeed` vive en memoria.

### D3. Número y fecha de la carrera en `raceStart`
- `raceStart` suma `raceNumber: number` (de `raceCount`) y `startedAt: number` (ms Unix, el `epoch` de la carrera, es decir, cuando empieza la cuenta regresiva). Ambos son `.optional()` en el esquema, como se hizo con `mode` en `room`.
- `NetworkRaceController` los expone (por ejemplo, `raceNumber` y `startedAt` como propiedades de solo lectura).
- `MultiplayerApp` deja de usar `seenSeeds`. `BoardResults` recibe `raceNumber` y `startedAt` y arma el nombre con `csvFileName(code, new Date(startedAt), raceNumber)`.
- Con un servidor viejo (campos ausentes), el cliente usa la fecha actual y el contador local como hoy. Es una ruta de compatibilidad, no se reescribe la lógica vieja.
- La fecha se formatea en la zona horaria de la profesora (`getFullYear/getMonth/getDate` locales, como ya hace `csvFileName`).

### D4. Columnas y estados
- `NetworkRaceController` deja de descartar `presence`. Opciones: que `results` en su `RaceViewState` conserve `NetRunnerResult`, o exponer aparte un `resultPresence: Record<id, Presence>`. Se elige la segunda, porque `RunnerResult` es el tipo del motor y lo usan también las carreras locales. De hecho, `buildState()` ya llena `presence` a partir de los resultados: alcanza con usar ese mapa.
- Una sola función, `standingsRows(results, presence, distance)`, en `classroom/`, produce las celdas en español. La usan la tabla de `BoardResults` y `toCsv()`, para que no se desincronicen.
- Orden de columnas: Puesto; Nombre; Nivel; Nivel máximo; Tiempo; Avance; Estado; Aciertos; Errores; Precisión; Correctas por minuto.
- Estado:
  - `finished` → "Llegó";
  - si no, `presence` `'left'` → "Se fue" y `'disconnected'` → "Desconectado";
  - en otro caso, "Sin llegar".
- Tiempo: `formatTime` si llegó; si no, "—".
- Avance: `formatPercent(min(1, distance / raceDistance))`. La distancia total es `raceStart.distance`, que el controlador ya conoce.
- Precisión: "sin respuestas" si `correct + wrong === 0`; si no, `formatPercent(accuracy)`. El motor no cambia: el caso se detecta en la vista.
- **BREAKING menor:** el encabezado del CSV cambia. Quien tenga una planilla armada sobre las columnas viejas tiene que ajustarla. No hay consumidores automáticos conocidos.

## Risks / Trade-offs

- [El servidor se reinicia (deploy o el plan gratis se duerme) entre el fin de la carrera y la recarga] → Se pierde `lastRace`, igual que hoy se pierde toda la sala. No se intenta persistir.
- [Recargar después de "Nueva carrera" vuelve a mostrar la clasificación anterior] → `boardSeed` vive en el cliente. Se acepta: un clic en "Nueva carrera" la vuelve a cerrar. Está en la proposal como fuera de alcance.
- [Apóstrofo visible en Excel] → Aceptado (D1). Solo afecta a nombres que empiezan con esos caracteres.
- [Reloj del servidor distinto del de la profesora] → Solo afecta el nombre del archivo si la carrera empieza a segundos de la medianoche. Se acepta.

## Migration Plan

- Deploy normal del servidor y del cliente; el orden no importa gracias a los campos opcionales (D3).
- Rollback: volver a la versión anterior de cualquiera de los dos. Los campos nuevos se ignoran o faltan sin errores.
