# Spec Delta

## Purpose

Permite que un grupo, típicamente una familia, se reúna en una sala privada identificada por un código para competir en carreras de Math Racer en tiempo real, cada persona con su propio nivel.

## ADDED Requirements

### Requirement: Crear una sala
Un jugador con perfil SHALL poder crear una sala privada. La sala SHALL recibir un código de 4 caracteres que no contiene caracteres ambiguos (`0`, `O`, `1`, `I`, `L`), único entre las salas abiertas, y quien la crea queda como anfitrión.

#### Scenario: Sala nueva
- **WHEN** un jugador elige "Crear sala"
- **THEN** ve el lobby con un código como `K7QF`, figura como anfitrión y como único jugador

### Requirement: Unirse con código
Un jugador SHALL poder unirse a una sala escribiendo su código, sin distinguir mayúsculas de minúsculas. Si el código no corresponde a una sala abierta o la sala está llena, el juego SHALL mostrar un mensaje claro y no SHALL unirlo.

#### Scenario: Código válido
- **WHEN** un jugador escribe `k7qf` y la sala `K7QF` existe con lugar disponible
- **THEN** entra al lobby y todos los jugadores de la sala lo ven aparecer

#### Scenario: Código inexistente
- **WHEN** un jugador escribe un código que no corresponde a ninguna sala abierta
- **THEN** ve el mensaje "No encontramos esa sala" y sigue en la pantalla para unirse

#### Scenario: Sala llena
- **WHEN** un jugador intenta unirse a una sala que ya tiene 4 personas
- **THEN** ve el mensaje "La sala está llena" y no entra

### Requirement: Capacidad de la sala
Una sala SHALL admitir hasta 4 personas, contando a quienes esperan la siguiente carrera.

#### Scenario: Cuarto jugador
- **WHEN** hay 3 personas en una sala y se une una cuarta
- **THEN** la cuarta entra y la sala pasa a estar llena

### Requirement: Lobby
El lobby SHALL mostrar el código de la sala, la lista de personas con su nombre, su nivel elegido y quién es el anfitrión, y SHALL actualizarse para todos cuando alguien entra, sale o cambia de nivel.

#### Scenario: Otro jugador cambia de nivel
- **WHEN** un jugador cambia su nivel de 3 a 5 en el lobby
- **THEN** todos los jugadores de la sala ven su nivel 5

### Requirement: Nivel propio
Cada persona SHALL elegir su propio nivel en el lobby, entre los niveles desbloqueados en su perfil. Al entrar, su nivel inicial SHALL ser su nivel máximo desbloqueado.

#### Scenario: Familia con niveles distintos
- **WHEN** papá tiene desbloqueado hasta el nivel 8 y su hija hasta el nivel 2
- **THEN** cada uno puede elegir su nivel y la sala muestra a papá en nivel 8 y a la hija en nivel 2

#### Scenario: Nivel bloqueado
- **WHEN** un jugador con nivel máximo 3 intenta elegir el nivel 5
- **THEN** el nivel 5 aparece bloqueado y no se puede elegir

### Requirement: Anfitrión inicia la carrera
Solo el anfitrión SHALL poder iniciar la carrera desde el lobby. La carrera SHALL poder iniciarse con una sola persona en la sala.

#### Scenario: Invitado intenta iniciar
- **WHEN** un invitado está en el lobby
- **THEN** no ve el botón para iniciar y ve el mensaje "Esperando a que el anfitrión inicie"

#### Scenario: Anfitrión inicia
- **WHEN** el anfitrión pulsa "Iniciar carrera"
- **THEN** todos los jugadores de la sala pasan a la cuenta regresiva de la misma carrera

### Requirement: Transferencia de anfitrión
Si el anfitrión sale de la sala, el rol de anfitrión SHALL pasar a la persona que lleva más tiempo en la sala.

#### Scenario: El anfitrión se va
- **WHEN** el anfitrión sale de una sala con otras dos personas
- **THEN** la persona que entró primero entre las restantes pasa a ser anfitrión y todos lo ven

### Requirement: Unirse durante una carrera
Si alguien se une mientras la sala está en una carrera, SHALL quedar esperando en el lobby y SHALL participar desde la siguiente carrera.

#### Scenario: Llegada tardía
- **WHEN** un jugador se une a una sala con una carrera en curso
- **THEN** ve el mensaje "Hay una carrera en curso; entrarás en la siguiente" y no aparece en la pista actual

### Requirement: Volver a la sala
Al terminar una carrera, cada persona SHALL poder volver al lobby de la misma sala para correr otra vez, conservando su nivel elegido.

#### Scenario: Revancha
- **WHEN** termina una carrera y el anfitrión vuelve a la sala y pulsa "Iniciar carrera"
- **THEN** comienza una nueva carrera con las personas que están en el lobby y una semilla distinta

### Requirement: Salir de la sala y cierre
Una persona SHALL poder salir de la sala en cualquier momento. Una sala sin personas conectadas durante 60 segundos SHALL cerrarse y su código SHALL dejar de funcionar.

#### Scenario: Sala vacía
- **WHEN** la última persona sale de la sala y pasan 60 segundos
- **THEN** la sala se cierra y unirse con su código muestra "No encontramos esa sala"

### Requirement: Validación en el servidor
El servidor SHALL rechazar nombres fuera de 1 a 20 caracteres, niveles fuera de 1 a 10 y mensajes mal formados, sin afectar a los demás jugadores de la sala.

#### Scenario: Mensaje inválido
- **WHEN** un cliente envía un mensaje con un nivel 15
- **THEN** el servidor lo rechaza con un error y la sala sigue funcionando para todos
