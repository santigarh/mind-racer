# classroom-mode Specification

## Purpose

Permite usar Mind Racer en una clase en vivo: una profesora abre una sala para hasta 40 alumnos, la proyecta, la controla sin correr y al final se lleva la clasificación, sin cuentas ni datos guardados y cuidando el ancho de banda del servidor.

## Requirements

### Requirement: Crear una sala de clase
Desde "Jugar con amigos", un jugador con perfil SHALL poder elegir "Crear sala de clase". Quien la crea SHALL quedar como profesora de la sala: es la anfitriona, no corre y no ocupa lugar de alumno. La sala de clase SHALL usar el mismo tipo de código, enlace y QR que las salas familiares.

#### Scenario: La profesora abre la sala
- **WHEN** la profesora elige "Crear sala de clase"
- **THEN** ve el tablero de la sala con el código y el QR en grande, y una lista de alumnos vacía

### Requirement: Capacidad de la clase
Una sala de clase SHALL admitir hasta 40 alumnos, contando a quienes esperan la siguiente carrera y sin contar a la profesora. Si está llena, quien intente unirse SHALL ver "La sala está llena".

#### Scenario: Alumno 41
- **WHEN** ya hay 40 alumnos en la sala y otro intenta unirse
- **THEN** ve "La sala está llena" y no entra

### Requirement: Tablero de la profesora
La profesora SHALL ver un tablero legible en un proyector. En el lobby, SHALL mostrar el código y el QR en grande y la lista de alumnos con su nivel y si están conectados, además del botón "Iniciar carrera". Durante la carrera, SHALL mostrar el avance de todos los alumnos ordenados por posición y el tiempo transcurrido. Al terminar, SHALL mostrar la clasificación completa y permitir "Nueva carrera".

#### Scenario: Seguir la carrera
- **WHEN** 25 alumnos están corriendo
- **THEN** el tablero muestra a los 25 con su avance, ordenados por posición, y se actualiza mientras corren

### Requirement: Carrera de clase
Cuando la profesora inicia la carrera, SHALL correr cada alumno conectado del lobby, cada uno con el nivel que eligió, y no SHALL haber bots. La carrera SHALL poder iniciarse con un solo alumno, y no SHALL iniciarse sin alumnos.

#### Scenario: Sin bots
- **WHEN** la profesora inicia una carrera con 3 alumnos
- **THEN** la carrera tiene exactamente esos 3 corredores

#### Scenario: Sala sin alumnos
- **WHEN** no hay alumnos en la sala
- **THEN** el botón "Iniciar carrera" está deshabilitado

### Requirement: Vista del alumno
Durante una carrera de clase, la pista de un alumno SHALL mostrar su propio carril y los de los primeros puestos: los 3 primeros en pantallas de hasta 640 px de ancho, para que la carrera quepa en el celular junto con el desafío y el teclado, y los 5 primeros en pantallas más anchas. SHALL mostrar también su posición entre todos (por ejemplo "12.º de 28"). Sus resultados SHALL mostrar su propio resultado y los 10 primeros puestos.

#### Scenario: Alumno a mitad de tabla
- **WHEN** un alumno va 12.º de 28 en un celular
- **THEN** ve en la pista los carriles de los 3 primeros y el suyo, y su posición "12.º de 28"

#### Scenario: Cabe en el celular
- **WHEN** un alumno corre una carrera de clase en una pantalla de 375 × 812 px con el teclado en pantalla
- **THEN** la pista, el desafío y el teclado se ven sin desplazar la página

#### Scenario: Tableta o computadora
- **WHEN** un alumno corre en una pantalla de más de 640 px de ancho
- **THEN** ve los carriles de los 5 primeros y el suyo

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

### Requirement: Quitar a un alumno
La profesora SHALL poder quitar a un alumno de la sala desde el tablero. El alumno quitado SHALL volver a "Jugar con amigos" con el aviso "La profesora te quitó de la sala" y no SHALL poder reconectarse con esa sesión. Si estaba corriendo, su auto SHALL salir de la carrera como si hubiera abandonado.

#### Scenario: Nombre inadecuado
- **WHEN** la profesora quita a un alumno del lobby
- **THEN** desaparece de la lista de todos y ese alumno ve el aviso en su celular

### Requirement: La profesora sigue a cargo
En una sala de clase, el rol de anfitriona no SHALL pasar a un alumno. Si la profesora pierde la conexión, la sala SHALL esperarla. Si la profesora cierra la sala con "Cerrar sala", todos los alumnos SHALL volver a "Jugar con amigos" con el aviso "La profesora cerró la sala" y el código SHALL dejar de funcionar.

#### Scenario: Se corta el wifi de la profesora
- **WHEN** la profesora se desconecta en el lobby y vuelve a los 20 segundos
- **THEN** sigue siendo la anfitriona y los alumnos siguen en la sala

#### Scenario: Fin de la clase
- **WHEN** la profesora pulsa "Cerrar sala"
- **THEN** los alumnos ven "La profesora cerró la sala" y nadie más puede unirse con ese código

### Requirement: Envío de estado reducido
Durante una carrera de clase, el servidor SHALL enviar el estado como máximo 5 veces por segundo. A cada alumno SHALL enviarle solo su propio corredor y los 5 primeros puestos; a la profesora, todos los corredores. El cliente SHALL conservar el último estado conocido de un corredor que no llega en un mensaje. Las salas familiares SHALL seguir recibiendo el estado completo como hasta ahora.

#### Scenario: Ancho de banda de una clase
- **WHEN** corren 30 alumnos
- **THEN** cada mensaje de estado que recibe un alumno trae como máximo 6 corredores, y llegan como máximo 5 por segundo
