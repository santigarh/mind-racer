# Spec Delta

## ADDED Requirements

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
