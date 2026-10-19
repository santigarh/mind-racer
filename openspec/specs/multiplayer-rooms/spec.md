# multiplayer-rooms Specification

## Purpose

Permite que un grupo, típicamente una familia, se reúna en una sala privada identificada por un código para competir en carreras de Math Racer en tiempo real, cada persona con su propio nivel.

## Requirements

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
Una sala familiar SHALL admitir hasta 4 personas, contando a quienes esperan la siguiente carrera. Las salas de clase siguen la capacidad definida en `classroom-mode`.

#### Scenario: Cuarto jugador
- **WHEN** hay 3 personas en una sala familiar y se une una cuarta
- **THEN** la cuarta entra y la sala pasa a estar llena

#### Scenario: Sala de clase
- **WHEN** hay 4 alumnos en una sala de clase y se une un quinto
- **THEN** el quinto entra, porque la sala de clase admite más personas

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
Si el anfitrión de una sala familiar sale de la sala, el rol de anfitrión SHALL pasar a la persona que lleva más tiempo en la sala. En las salas de clase el rol no pasa a otra persona (ver `classroom-mode`).

#### Scenario: El anfitrión se va
- **WHEN** el anfitrión sale de una sala familiar con otras dos personas
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

### Requirement: Servidor despertando
Al crear una sala, unirse o volver a una sala, mientras la conexión con el servidor no esté abierta, la pantalla SHALL mostrar "Conectando con el servidor…"; si tras 5 segundos sigue sin abrir, SHALL mostrar "Despertando el servidor, puede tardar hasta un minuto". El cliente SHALL seguir reintentando y SHALL completar la acción pendiente apenas el servidor responda.

#### Scenario: Servidor dormido
- **WHEN** un jugador pulsa "Crear sala" y el servidor tarda 40 segundos en despertar
- **THEN** ve primero "Conectando con el servidor…", luego "Despertando el servidor, puede tardar hasta un minuto", y al despertar entra al lobby sin volver a pulsar nada

#### Scenario: Conexión que no responde
- **WHEN** el intento de conexión no se abre ni se cierra durante 10 segundos
- **THEN** el cliente lo abandona y reintenta automáticamente

#### Scenario: Servidor despierto
- **WHEN** el servidor responde en menos de 5 segundos
- **THEN** el jugador no ve el aviso de servidor despertando

### Requirement: Compartir la sala
El lobby SHALL mostrar un enlace a la sala con la forma `<dirección del juego>/?sala=<CÓDIGO>` y un código QR de ese enlace que se pueda escanear con la cámara de otro celular. SHALL ofrecer un botón "Compartir" que use el menú de compartir del dispositivo y, donde no exista, copie el enlace y lo confirme con el texto "Enlace copiado".

#### Scenario: QR para la familia
- **WHEN** el anfitrión abre el lobby de la sala `K7QF`
- **THEN** ve un código QR que, al escanearlo, abre `<dirección del juego>/?sala=K7QF`

#### Scenario: Compartir por mensaje
- **WHEN** el anfitrión pulsa "Compartir" en un celular con menú de compartir
- **THEN** se abre ese menú con el enlace de la sala y un texto de invitación

#### Scenario: Computadora sin menú de compartir
- **WHEN** el anfitrión pulsa "Compartir" en un navegador sin menú de compartir
- **THEN** el enlace se copia al portapapeles y aparece "Enlace copiado"

### Requirement: Entrar con el enlace
Al abrir el juego con `?sala=<CÓDIGO>`, el juego SHALL unir al jugador a esa sala sin pasos extra, usando su nombre y su nivel máximo desbloqueado. Si no tiene perfil, SHALL pedir primero el nombre y el punto de partida y luego unirlo. Después de usarlo, el parámetro SHALL quitarse de la dirección para que recargar no repita la acción. Un código inválido o de una sala inexistente SHALL mostrar el mismo error que al unirse escribiendo el código.

#### Scenario: Familiar con perfil
- **WHEN** alguien con perfil abre `<dirección del juego>/?sala=k7qf`
- **THEN** entra al lobby de la sala `K7QF` sin pulsar nada más

#### Scenario: Primera vez
- **WHEN** alguien sin perfil abre el enlace de una sala
- **THEN** primero elige su nombre y su punto de partida y, al terminar, entra a esa sala

#### Scenario: Sala que ya no existe
- **WHEN** alguien abre el enlace de una sala que ya se cerró
- **THEN** ve "No encontramos esa sala" en la pantalla de "Jugar con amigos" y la dirección ya no contiene `?sala=`

### Requirement: Auto al entrar a la sala
Al crear una sala o unirse a ella, el cliente SHALL enviar el auto elegido en el garaje (vehículo y pintura). El servidor SHALL aceptar solo vehículos y pinturas del catálogo; si el auto falta o no es válido, SHALL usar el clásico ámbar sin rechazar a la persona. El servidor SHALL conservar el auto de cada persona al reconectar.

#### Scenario: Versión vieja del juego
- **WHEN** alguien se une sin enviar auto
- **THEN** entra con el clásico ámbar y los demás lo ven así

#### Scenario: Auto inválido
- **WHEN** un cliente envía un vehículo que no existe en el catálogo
- **THEN** el servidor lo une a la sala con el clásico ámbar

#### Scenario: Reconexión
- **WHEN** Lucía entró con la moto roja, pierde la conexión y vuelve
- **THEN** sigue con la moto roja

### Requirement: Autos visibles para todos
El servidor SHALL compartir el auto de cada persona con toda la sala. El lobby SHALL mostrar el auto de cada persona junto a su nombre, y la pista y los resultados de la carrera SHALL dibujar a cada persona con su auto. Dos personas pueden tener el mismo auto.

#### Scenario: La familia ve los autos
- **WHEN** Papá entra con el camión azul y Lucía con la moto roja
- **THEN** ambos ven en el lobby y en la pista el camión azul de Papá y la moto roja de Lucía

#### Scenario: Mismo auto
- **WHEN** dos personas eligieron el clásico ámbar
- **THEN** ambas entran a la sala y se distinguen por su nombre
