# Proposal

## Why

Las tablas de multiplicar son lo que más se practica en la escuela, y Mind Racer solo las ofrece mezcladas en el nivel 4 (del 2 al 10 a la vez). Un niño que está aprendiendo la tabla del 7, o una profesora que quiere que "hoy practicamos el 7 y el 8", no tienen forma de hacerlo. El modo clase recién salió y esta es la carrera que más se le va a pedir.

## What Changes

- **Práctica de tablas en solitario**: desde el menú, el jugador elige una o varias tablas del 2 al 10, opcionalmente con sus divisiones, y corre contra los bots. Está disponible para todos, sin importar el nivel desbloqueado.
- **Carrera de tablas en la sala de clase**: en el lobby, la profesora elige antes de cada carrera entre "Cada uno su nivel" (como hoy) o unas tablas concretas. La elección se mantiene para las carreras siguientes hasta que la cambie. En una carrera de tablas todos los alumnos practican lo mismo, sin importar el nivel que eligieron.
- **Qué sale en "la tabla del 7"**:
  - multiplicaciones del ×1 al ×10, en los dos órdenes (`7 × 3` y `3 × 7`);
  - si se activan las divisiones, también `21 ÷ 7` (siempre se divide entre la tabla elegida). Vienen apagadas por defecto.
- **Ritmo fijo**: una carrera de tablas no usa la dificultad adaptativa. Las multiplicaciones tienen el tiempo esperado del nivel 4 y las divisiones el del nivel 5, así que los bots corren con el mismo ritmo que hoy.
- **No cuenta para el progreso**: una carrera de tablas, sola o en clase, no desbloquea niveles, no guarda récords por nivel y no suma carreras ni victorias para el garaje.
- **Clasificación de clase**: la tabla y el CSV suman la columna "Tablas" (por ejemplo "7, 8 + divisiones"). En una carrera de tablas, "Nivel" y "Nivel máximo" muestran "—".
- Fuera de alcance:
  - carreras de tablas en salas familiares;
  - saber qué multiplicaciones falla cada alumno, o estadísticas por tabla;
  - una dificultad adaptativa propia de las tablas (en orden, salteadas, con divisiones);
  - tablas del 0, del 1, del 11 o del 12, y multiplicar por más de 10;
  - el desafío diario, que no cambia.

## Capabilities

### New Capabilities

- `tables-practice`: elegir tablas de multiplicar y correr con ellas. Cubre qué problemas salen de una tabla, las divisiones opcionales, el ritmo fijo, la práctica en solitario desde el menú y que estas carreras no cuentan para el progreso.

### Modified Capabilities

- `classroom-mode`:
  - se agrega "Carrera de tablas en clase": la profesora elige las tablas en el lobby, la elección se mantiene entre carreras y solo ella puede cambiarla;
  - se modifica "Tablero de la profesora": el lobby muestra qué se va a practicar y deja de mostrar el nivel de cada alumno en una carrera de tablas;
  - se modifica "Carrera de clase": cada alumno corre con su nivel, salvo en una carrera de tablas;
  - se modifica "Columnas de la clasificación": columna "Tablas" y niveles en "—" en una carrera de tablas.
- `multiplayer-race`: se modifica "Resultados y progreso": una carrera de tablas no cuenta para el progreso local.
- `garage`: se modifica "Cómo se mide el progreso": las carreras de tablas no suman carreras ni victorias.

## Impact

- `packages/engine`: generador nuevo `createTablesSource` (TypeScript puro), que se conecta por el `ChallengeSource` que ya existe. La carrera, los bots y la dificultad no cambian.
- `packages/protocol`:
  - mensaje nuevo `setTables`;
  - campo `tables` en `room` y en `raceStart`, opcional para que clientes y servidores anteriores sigan funcionando.
- `apps/server` (`Room`): guarda las tablas elegidas por la profesora y, si las hay, arranca la carrera con el generador de tablas y sin adaptación.
- `apps/web`:
  - `Menu` y `App`: selector de tablas, carrera sin progreso y "Jugar de nuevo" con las mismas tablas;
  - `LocalRaceController`: acepta tablas;
  - `TeacherBoard`: selector en el lobby y columna "Tablas";
  - `Lobby` del alumno: avisa "Hoy: tablas del 7 y del 8" y oculta el selector de nivel;
  - `MultiplayerApp`: no aplica el progreso de una carrera de tablas;
  - `classroom/standings.ts` y `csv.ts`: columna nueva.
