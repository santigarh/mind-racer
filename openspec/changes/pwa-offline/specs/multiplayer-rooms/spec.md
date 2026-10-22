# Spec Delta

## MODIFIED Requirements

### Requirement: Servidor despertando
Al crear una sala, unirse o volver a una sala, mientras la conexión con el servidor no esté abierta, la pantalla SHALL mostrar "Conectando con el servidor…"; si tras 5 segundos sigue sin abrir, SHALL mostrar "Despertando el servidor, puede tardar hasta un minuto". Si el dispositivo indica que no tiene conexión a internet, la pantalla SHALL mostrar en su lugar "Sin conexión a internet. Jugar con amigos necesita internet; mientras tanto puedes correr contra los bots." El cliente SHALL seguir reintentando y SHALL completar la acción pendiente apenas el servidor responda.

#### Scenario: Servidor dormido
- **WHEN** un jugador pulsa "Crear sala" y el servidor tarda 40 segundos en despertar
- **THEN** ve primero "Conectando con el servidor…", luego "Despertando el servidor, puede tardar hasta un minuto", y al despertar entra al lobby sin volver a pulsar nada

#### Scenario: Conexión que no responde
- **WHEN** el intento de conexión no se abre ni se cierra durante 10 segundos
- **THEN** el cliente lo abandona y reintenta automáticamente

#### Scenario: Servidor despierto
- **WHEN** el servidor responde en menos de 5 segundos
- **THEN** el jugador no ve el aviso de servidor despertando

#### Scenario: Sin internet
- **WHEN** un jugador sin conexión a internet pulsa "Crear sala de clase"
- **THEN** ve "Sin conexión a internet. Jugar con amigos necesita internet; mientras tanto puedes correr contra los bots." y no ve el aviso de servidor despertando

#### Scenario: Vuelve la conexión
- **WHEN** un jugador sin conexión pulsó "Unirse" con el código K7QF y el dispositivo recupera internet
- **THEN** el aviso cambia a "Conectando con el servidor…" y el jugador entra a la sala K7QF sin volver a pulsar nada
