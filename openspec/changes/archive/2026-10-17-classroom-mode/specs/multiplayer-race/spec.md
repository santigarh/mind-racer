# Spec Delta

## MODIFIED Requirements

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
