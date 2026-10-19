# Proposal

## Why

La clasificación descargable es lo único que la profesora se lleva de una clase, y hoy es frágil. El nombre lo escribe cada alumno y el CSV lo copia tal cual: un nombre que empieza con `=` se ejecuta como fórmula al abrir el archivo en Excel o Sheets, en la computadora de la profesora. Además, el servidor olvida los resultados al terminar la carrera: si la profesora recarga la página o se le corta el wifi en la pantalla de resultados, la clasificación se pierde. Y el archivo no distingue al alumno que se fue de la carrera del que no alcanzó a llegar.

## What Changes

- **CSV sin fórmulas**: toda celda que empiece con `=`, `+`, `-`, `@`, tabulación o retorno de carro se escribe como texto, para que Excel y Sheets no la interpreten como fórmula.
- **Resultados que sobreviven a una reconexión**: el servidor de una sala de clase guarda la clasificación de la última carrera hasta que empiece la siguiente. Si la profesora vuelve a conectarse en ese tiempo, el tablero vuelve a mostrarla y se puede descargar de nuevo.
- **Nombre de archivo estable**: el número de carrera lo lleva el servidor (1, 2, 3… desde que se abrió la sala) y la fecha es la del inicio de la carrera. Recargar la página no reinicia la numeración.
- **Más datos en la tabla y en el CSV**:
  - **Nivel máximo** alcanzado con la dificultad adaptativa, además del nivel elegido;
  - **Avance** (porcentaje del recorrido), útil para ordenar a quienes no llegaron;
  - **Estado**: "Llegó", "Sin llegar", "Se fue" (abandonó o la profesora lo quitó) o "Desconectado".
- **Precisión sin respuestas**: si un alumno no respondió nada, la precisión aparece como "sin respuestas" en vez de "0 %".
- Fuera de alcance:
  - historial de varias carreras o un reporte de toda la clase;
  - detalle por desafío u operación;
  - distinguir "abandonó" de "lo quitó la profesora" (ambos son "Se fue");
  - recuperar los resultados en el celular del alumno tras recargar (volver a aplicarlos tocaría su progreso dos veces);
  - recordar que la profesora ya pulsó "Nueva carrera" después de una recarga.

## Capabilities

### New Capabilities

_Ninguna._

### Modified Capabilities

- `classroom-mode`:
  - se modifica "Clasificación descargable": el nombre del archivo lleva el número de carrera de la sala y la fecha de inicio;
  - se agregan tres requisitos: "Columnas de la clasificación" (nivel máximo, avance, estado y precisión sin respuestas, en la tabla y en el CSV), "CSV sin fórmulas" y "La clasificación sobrevive a la reconexión".

## Impact

- `packages/protocol`: `raceStart` suma `raceNumber` y `startedAt`, ambos opcionales para que los clientes y servidores anteriores sigan funcionando.
- `apps/server` (`Room`):
  - cuenta las carreras de la sala;
  - guarda la última clasificación de una sala de clase hasta la próxima carrera;
  - al reconectarse, si no hay carrera en curso, le reenvía a la profesora `raceStart` y `results` de la última.
- `apps/web`:
  - `classroom/csv.ts`: columnas nuevas, escape de fórmulas y nombre de archivo a partir del número y la fecha de la carrera;
  - `TeacherBoard.tsx`: tabla con las columnas nuevas;
  - `NetworkRaceController`: conserva `presence`, `raceNumber` y `startedAt` para el tablero;
  - `MultiplayerApp.tsx`: deja de contar las carreras con un `useRef`.
- El motor no cambia: `maxLevel`, `distance` y `presence` ya se calculan hoy.
