# game-feedback Specification

## Purpose

Hace que la carrera se sienta y se escuche: el jugador percibe aciertos, errores, nitros y su llegada con sonidos cortos y, en celulares compatibles, con vibración, sin necesidad de mirar la pantalla, y puede silenciarlo todo.

## Requirements

### Requirement: Sonidos de la carrera
Durante una carrera local o en línea, el juego SHALL reproducir un sonido corto y distinto para cada evento del jugador: cada segundo de la cuenta regresiva, la salida, un acierto, un error, la activación del nitro y su llegada a la meta. Los sonidos SHALL generarse en el navegador, sin descargar archivos de audio.

#### Scenario: Acierto y error
- **WHEN** el jugador responde correctamente y luego responde mal
- **THEN** escucha primero el sonido de acierto y después el de error, que son distintos

#### Scenario: Nitro
- **WHEN** el jugador activa un nitro
- **THEN** escucha el sonido de nitro en lugar del de acierto

#### Scenario: Cuenta regresiva y salida
- **WHEN** empieza una carrera
- **THEN** suena un tono en el 3, el 2 y el 1, y un tono distinto en la salida

#### Scenario: Llegada
- **WHEN** el jugador cruza la meta
- **THEN** suena el sonido de llegada una sola vez

### Requirement: Solo eventos propios
Los sonidos y vibraciones SHALL corresponder solo a los eventos del propio jugador y a la cuenta regresiva, no a los de otros corredores.

#### Scenario: Rival con nitro
- **WHEN** un bot u otra persona activa un nitro
- **THEN** el jugador no escucha ningún sonido por ese evento

### Requirement: Vibración
En dispositivos cuyo navegador soporte vibración, el juego SHALL vibrar brevemente ante un error, un patrón distinto ante un nitro y otro al llegar a la meta. Donde no haya soporte, el juego SHALL funcionar igual, sin vibración y sin errores.

#### Scenario: Celular Android
- **WHEN** el jugador responde mal en un celular que soporta vibración
- **THEN** el celular vibra brevemente

#### Scenario: Navegador sin vibración
- **WHEN** el navegador no soporta vibración
- **THEN** la carrera continúa con normalidad y solo suenan los sonidos

### Requirement: Silenciar
El juego SHALL ofrecer un interruptor visible en el menú y durante la carrera para silenciar sonido y vibración. La preferencia SHALL recordarse en el dispositivo y estar activada (con sonido) por defecto.

#### Scenario: Silenciar en medio de una carrera
- **WHEN** el jugador pulsa el interruptor de sonido durante una carrera
- **THEN** dejan de sonar los efectos y de vibrar el dispositivo desde ese momento

#### Scenario: Preferencia recordada
- **WHEN** el jugador silenció el juego y vuelve a abrirlo en el mismo dispositivo
- **THEN** el juego sigue silenciado

### Requirement: Política de audio del navegador
El audio SHALL activarse con la primera interacción del jugador (toque, clic o tecla). Si el navegador bloquea el audio, el juego SHALL seguir funcionando sin sonido y sin mostrar errores.

#### Scenario: Primera visita
- **WHEN** el jugador abre el juego y su primera acción es pulsar "Correr en nivel 1"
- **THEN** los sonidos de esa carrera ya funcionan
