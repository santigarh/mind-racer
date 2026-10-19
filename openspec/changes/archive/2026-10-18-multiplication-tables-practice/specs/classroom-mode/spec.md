# Spec Delta

## ADDED Requirements

### Requirement: Carrera de tablas en clase
En el lobby, la profesora SHALL poder elegir qué se practica en la próxima carrera: "Cada uno su nivel" o una práctica de tablas (tablas del 2 al 10 y divisiones opcionales). La elección SHALL mantenerse para las carreras siguientes hasta que la cambie, y SHALL seguir vigente si la profesora se reconecta. Solo la profesora SHALL poder cambiarla.

#### Scenario: Hoy practicamos el 7
- **WHEN** la profesora elige la tabla del 7 en el lobby e inicia la carrera
- **THEN** todos los alumnos corren con problemas de la tabla del 7, sin importar el nivel que eligieron

#### Scenario: La elección se mantiene
- **WHEN** termina una carrera de las tablas del 7 y del 8 y la profesora pulsa "Nueva carrera"
- **THEN** el lobby sigue con las tablas del 7 y del 8 elegidas

#### Scenario: Volver a los niveles
- **WHEN** la profesora elige "Cada uno su nivel" e inicia la carrera
- **THEN** cada alumno corre con el nivel que eligió, como en una carrera de clase sin tablas

#### Scenario: Un alumno intenta cambiarlo
- **WHEN** un alumno envía al servidor un cambio de tablas
- **THEN** el servidor lo rechaza y la elección de la profesora no cambia

#### Scenario: El alumno sabe qué se practica
- **WHEN** la profesora eligió las tablas del 7 y del 8 y un alumno está en el lobby
- **THEN** el alumno ve "Hoy: tablas del 7 y del 8" en lugar del selector de nivel

## MODIFIED Requirements

### Requirement: Tablero de la profesora
La profesora SHALL ver un tablero legible en un proyector. En el lobby, SHALL mostrar el código y el QR en grande, qué se va a practicar ("Cada uno su nivel" o las tablas elegidas) y la lista de alumnos con su nivel y si están conectados, además del botón "Iniciar carrera". Si se van a practicar tablas, la lista no SHALL mostrar el nivel de cada alumno. Durante la carrera, SHALL mostrar el avance de todos los alumnos ordenados por posición y el tiempo transcurrido. Al terminar, SHALL mostrar la clasificación completa y permitir "Nueva carrera".

#### Scenario: Seguir la carrera
- **WHEN** 25 alumnos están corriendo
- **THEN** el tablero muestra a los 25 con su avance, ordenados por posición, y se actualiza mientras corren

#### Scenario: Lobby de una carrera de tablas
- **WHEN** la profesora eligió la tabla del 9 con divisiones
- **THEN** el lobby muestra "Tablas: 9 + divisiones" y la lista de alumnos sin sus niveles

### Requirement: Carrera de clase
Cuando la profesora inicia la carrera, SHALL correr cada alumno conectado del lobby, cada uno con el nivel que eligió, o todos con las tablas elegidas si es una carrera de tablas, y no SHALL haber bots. La carrera SHALL poder iniciarse con un solo alumno, y no SHALL iniciarse sin alumnos.

#### Scenario: Sin bots
- **WHEN** la profesora inicia una carrera con 3 alumnos
- **THEN** la carrera tiene exactamente esos 3 corredores

#### Scenario: Sala sin alumnos
- **WHEN** no hay alumnos en la sala
- **THEN** el botón "Iniciar carrera" está deshabilitado

#### Scenario: Carrera de tablas sin bots
- **WHEN** la profesora inicia una carrera de la tabla del 6 con 3 alumnos
- **THEN** la carrera tiene exactamente esos 3 corredores y todos reciben problemas de la tabla del 6

### Requirement: Columnas de la clasificación
La clasificación del tablero y el CSV SHALL mostrar, por alumno: puesto, nombre, nivel elegido, nivel máximo alcanzado, tablas, tiempo, avance (porcentaje del recorrido), estado, aciertos, errores, precisión y correctas por minuto. En una carrera de tablas, la columna de tablas SHALL decir qué se practicó (por ejemplo "7, 8 + divisiones") y el nivel elegido y el nivel máximo SHALL decir "—"; en una carrera por niveles, la columna de tablas SHALL decir "—". El estado SHALL ser "Llegó", "Sin llegar", "Se fue" (abandonó o la profesora lo quitó) o "Desconectado". Quien no llegó SHALL tener el tiempo vacío ("—"). Si un alumno no respondió nada, su precisión SHALL decir "sin respuestas" en vez de un porcentaje.

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
- **THEN** su fila muestra nivel 3, nivel máximo 5 y tablas "—"

#### Scenario: Carrera de tablas
- **WHEN** la clase corrió las tablas del 7 y del 8 con divisiones
- **THEN** cada fila dice "7, 8 + divisiones" en tablas y "—" en nivel y en nivel máximo

#### Scenario: Mismas columnas en todas las carreras
- **WHEN** la profesora descarga el CSV de una carrera por niveles y el de una carrera de tablas
- **THEN** ambos archivos tienen los mismos encabezados, en el mismo orden
