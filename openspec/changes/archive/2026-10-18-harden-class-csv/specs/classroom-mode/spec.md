## MODIFIED Requirements

### Requirement: Clasificación descargable
Al terminar la carrera, el tablero SHALL ofrecer "Descargar CSV" con una fila por alumno y las columnas de la clasificación. El archivo SHALL generarse en el navegador de la profesora, sin enviarse a ningún servicio. Su nombre SHALL llevar el código de la sala, la fecha en que empezó la carrera y el número de esa carrera dentro de la sala, contando desde 1 desde que se abrió (por ejemplo `mind-racer-K7QF-2026-10-17-2.csv`).

#### Scenario: Llevarse los resultados
- **WHEN** la profesora pulsa "Descargar CSV" después de una carrera de 28 alumnos
- **THEN** descarga un archivo con 28 filas de datos y una fila de encabezados

#### Scenario: Recargar no reinicia la numeración
- **WHEN** la profesora recarga la página después de la segunda carrera de la sala y vuelve a descargar el CSV
- **THEN** el archivo se llama con el número 2, igual que antes de recargar

#### Scenario: Carrera que cruza la medianoche
- **WHEN** una carrera empieza el 17 de octubre y la profesora descarga el CSV el 18
- **THEN** el nombre del archivo lleva la fecha 2026-10-17

## ADDED Requirements

### Requirement: Columnas de la clasificación
La clasificación del tablero y el CSV SHALL mostrar, por alumno: puesto, nombre, nivel elegido, nivel máximo alcanzado, tiempo, avance (porcentaje del recorrido), estado, aciertos, errores, precisión y correctas por minuto. El estado SHALL ser "Llegó", "Sin llegar", "Se fue" (abandonó o la profesora lo quitó) o "Desconectado". Quien no llegó SHALL tener el tiempo vacío ("—"). Si un alumno no respondió nada, su precisión SHALL decir "sin respuestas" en vez de un porcentaje.

#### Scenario: Alumno que abandonó
- **WHEN** un alumno abandona la carrera a mitad del recorrido
- **THEN** su fila dice "Se fue", el tiempo "—" y un avance cercano a 50 %

#### Scenario: Alumno desconectado al terminar
- **WHEN** a un alumno se le corta la conexión y la carrera termina antes de que vuelva
- **THEN** su fila dice "Desconectado"

#### Scenario: Alumno sin respuestas
- **WHEN** un alumno no responde ningún desafío
- **THEN** su precisión dice "sin respuestas" y no "0 %"

#### Scenario: Subió de nivel
- **WHEN** un alumno eligió el nivel 3 y la dificultad adaptativa lo llevó hasta el 5
- **THEN** su fila muestra nivel 3 y nivel máximo 5

### Requirement: CSV sin fórmulas
Ninguna celda del CSV SHALL ser interpretada como fórmula por una planilla de cálculo. Si un valor empieza con `=`, `+`, `-`, `@`, tabulación o retorno de carro, el archivo SHALL guardarlo precedido de un apóstrofo (`'`), para que se abra como texto. Los demás valores SHALL quedar sin cambios.

#### Scenario: Nombre con forma de fórmula
- **WHEN** un alumno se llama `=1+1` y la profesora abre el CSV en Excel o Google Sheets
- **THEN** la celda del nombre muestra el texto `=1+1`, a lo sumo con el apóstrofo delante, y no el resultado 2

#### Scenario: Nombre común
- **WHEN** un alumno se llama `Ana`
- **THEN** la celda del nombre dice `Ana`, sin apóstrofo

### Requirement: La clasificación sobrevive a la reconexión
En una sala de clase, el servidor SHALL conservar la clasificación de la última carrera hasta que empiece la siguiente o se cierre la sala. Si la profesora se reconecta sin una carrera en curso (por ejemplo, porque recargó la página), el tablero SHALL volver a mostrar esa clasificación, con su mismo número de carrera, y permitir descargarla de nuevo.

#### Scenario: Recarga en la pantalla de resultados
- **WHEN** la profesora recarga la página mientras el tablero muestra los resultados
- **THEN** al volver ve la misma clasificación y puede pulsar "Descargar CSV"

#### Scenario: Ya empezó otra carrera
- **WHEN** la profesora se reconecta después de iniciar una carrera nueva
- **THEN** ve el avance de la carrera en curso, no la clasificación anterior
