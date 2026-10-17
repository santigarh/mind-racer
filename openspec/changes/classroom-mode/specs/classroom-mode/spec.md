# Spec Delta

## Purpose

Permite usar Mind Racer en una clase en vivo: una profesora abre una sala para hasta 40 alumnos, la proyecta, la controla sin correr y al final se lleva la clasificación, sin cuentas ni datos guardados y cuidando el ancho de banda del servidor.

## ADDED Requirements

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
En el celular de un alumno, la pista SHALL mostrar su propio carril y los de los 5 primeros puestos, junto con su posición entre todos (por ejemplo "12.º de 28"). Sus resultados SHALL mostrar su propio resultado y los 10 primeros puestos.

#### Scenario: Alumno a mitad de tabla
- **WHEN** un alumno va 12.º de 28
- **THEN** ve en la pista los carriles de los 5 primeros y el suyo, y su posición "12.º de 28"

### Requirement: Clasificación descargable
Al terminar la carrera, el tablero SHALL ofrecer "Descargar CSV" con una fila por alumno: puesto, nombre, nivel, tiempo o "sin llegar", aciertos, errores, precisión y correctas por minuto. El archivo SHALL generarse en el navegador de la profesora, sin enviarse a ningún servicio.

#### Scenario: Llevarse los resultados
- **WHEN** la profesora pulsa "Descargar CSV" después de una carrera de 28 alumnos
- **THEN** descarga un archivo con 28 filas de datos y una fila de encabezados

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
