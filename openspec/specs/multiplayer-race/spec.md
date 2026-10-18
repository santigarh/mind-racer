# multiplayer-race Specification

## Purpose

Define cómo transcurre una carrera de Math Racer entre varias personas conectadas a una sala: el servidor es la fuente de verdad, todos ven la misma carrera y el resultado es justo aunque cada uno tenga distinta conexión.

## Requirements

### Requirement: Servidor como autoridad
El servidor SHALL ejecutar la carrera con el mismo motor que las carreras locales, decidir la validez de cada respuesta y el estado de todos los corredores. El cliente SHALL recibir de cada desafío solo su texto, su nivel y la longitud de la respuesta, nunca la respuesta correcta.

#### Scenario: Respuesta oculta
- **WHEN** un jugador recibe el desafío `7 × 8`
- **THEN** el mensaje que llega a su dispositivo no contiene `56`

#### Scenario: Respuesta validada por el servidor
- **WHEN** un jugador envía una respuesta
- **THEN** el servidor la valida, actualiza la carrera y le informa si fue correcta, junto con su siguiente desafío

### Requirement: Misma carrera para todos
Todas las personas de la sala SHALL ver la misma carrera: mismos corredores, posiciones y fases. El estado de la carrera SHALL enviarse al menos 15 veces por segundo y el cliente SHALL mostrar el avance de los autos de forma fluida entre actualizaciones.

#### Scenario: Dos dispositivos
- **WHEN** dos personas de la misma sala miran la pista al mismo tiempo
- **THEN** ambas ven las mismas posiciones y el mismo orden de corredores

### Requirement: Bots de relleno
Al iniciar una carrera en una sala familiar, los carriles libres hasta completar 4 corredores SHALL ocuparse con bots, en orden de perfil Tortuga, Crucero y Turbo. Los bots SHALL usar el nivel más bajo elegido entre las personas de la sala. Las carreras de las salas de clase no SHALL tener bots.

#### Scenario: Dos personas
- **WHEN** el anfitrión inicia una carrera con 2 personas en niveles 8 y 2
- **THEN** la carrera tiene 4 corredores: las 2 personas y los bots Tortuga y Crucero en nivel 2

#### Scenario: Sala llena
- **WHEN** el anfitrión inicia una carrera con 4 personas
- **THEN** la carrera no tiene bots

#### Scenario: Carrera de clase
- **WHEN** la profesora inicia una carrera de clase con 2 alumnos
- **THEN** la carrera tiene solo los 2 alumnos

### Requirement: Nivel por persona en la carrera
Cada persona SHALL recibir desafíos alrededor del nivel que eligió en el lobby, y la pista y la clasificación SHALL mostrar el nivel elegido de cada corredor.

#### Scenario: Familia en la pista
- **WHEN** papá corre en nivel 8 y su hija en nivel 2
- **THEN** papá recibe desafíos de nivel 7 a 10, su hija de nivel 1 a 4, y la pista muestra "N8" y "N2" junto a sus nombres

### Requirement: Compensación de latencia
El tiempo de respuesta usado para el impulso y la dificultad SHALL ser el tiempo medido por el servidor menos el tiempo de ida y vuelta medido de ese jugador, con un descuento máximo de 150 ms y sin bajar del mínimo que el motor admite.

#### Scenario: Conexiones distintas
- **WHEN** dos jugadores con tiempos de ida y vuelta de 20 ms y 120 ms responden 2 segundos después de ver el mismo tipo de desafío
- **THEN** ambos reciben el mismo impulso

#### Scenario: Latencia exagerada
- **WHEN** un jugador tiene un tiempo de ida y vuelta medido de 900 ms
- **THEN** solo se le descuentan 150 ms

### Requirement: Sin pausa en multijugador
Una carrera multijugador no SHALL pausarse cuando una persona oculta la pestaña; su auto SHALL seguir en carrera y frenar solo si no responde.

#### Scenario: Pestaña oculta
- **WHEN** un jugador cambia de pestaña durante una carrera multijugador
- **THEN** la carrera continúa para todos y su auto pierde velocidad mientras no responde

### Requirement: Desconexión y reconexión
Si una persona pierde la conexión durante la carrera, su auto SHALL seguir en la pista frenando solo, la pista SHALL indicarlo como desconectado, y la persona SHALL poder volver a la misma carrera durante 30 segundos con su progreso intacto.

#### Scenario: Vuelve a tiempo
- **WHEN** un jugador se desconecta y vuelve a conectarse 10 segundos después
- **THEN** retoma su auto en la misma carrera con un nuevo desafío y su distancia, aciertos y errores intactos

#### Scenario: No vuelve
- **WHEN** un jugador desconectado no vuelve en 30 segundos
- **THEN** su auto sigue en la pista hasta el final de la carrera y aparece en la clasificación como desconectado

### Requirement: Fin de carrera sin esperar a los bots
Cuando cada persona de la carrera llegó a la meta, abandonó o lleva desconectada más de 30 segundos, el servidor SHALL completar al instante el resto de la carrera con las mismas reglas y SHALL enviar la clasificación final a todos.

#### Scenario: Las personas ya llegaron
- **WHEN** las 2 personas cruzan la meta y los bots siguen corriendo
- **THEN** todos ven la pantalla de resultados de inmediato con la clasificación completa

#### Scenario: Una persona sigue corriendo
- **WHEN** una persona llegó y otra sigue corriendo
- **THEN** quien llegó ve "Esperando a los demás corredores" y la carrera continúa hasta que la otra llegue o se agote el tiempo

#### Scenario: Desconexión reciente
- **WHEN** una persona llegó y la otra lleva 10 segundos desconectada
- **THEN** la carrera sigue, para que la persona desconectada pueda volver

### Requirement: Resultados y progreso
La pantalla de resultados de una carrera multijugador SHALL mostrar la clasificación con el nivel de cada corredor y la opción "Volver a la sala". El resultado SHALL contar para el progreso local de cada persona en el nivel que eligió, con las mismas reglas de desbloqueo y récords que una carrera local.

#### Scenario: Desbloqueo en familia
- **WHEN** la hija, con nivel máximo 2, termina 2.º en nivel 2 con 90 % de precisión en una carrera multijugador
- **THEN** su perfil desbloquea el nivel 3 y su pantalla de resultados lo anuncia

### Requirement: Abandonar una carrera multijugador
Una persona SHALL poder abandonar la carrera; su auto SHALL quedar detenido en la pista para los demás y la carrera abandonada no SHALL contar para su progreso.

#### Scenario: Salir a mitad de carrera
- **WHEN** un jugador abandona la carrera y confirma
- **THEN** vuelve al lobby, los demás ven su auto detenido y sus estadísticas no cambian

### Requirement: Indicador de conexión
Durante una partida multijugador la pantalla SHALL indicar si la conexión con el servidor se perdió y que se está intentando reconectar.

#### Scenario: Se cae el wifi
- **WHEN** el dispositivo pierde la conexión con el servidor durante una carrera
- **THEN** se muestra "Reconectando…" y el juego intenta volver automáticamente a la carrera
