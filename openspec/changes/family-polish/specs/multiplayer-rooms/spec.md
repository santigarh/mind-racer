# Spec Delta

## ADDED Requirements

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
