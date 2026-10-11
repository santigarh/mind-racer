# Spec Delta

## MODIFIED Requirements

### Requirement: Nivel inicial de la carrera
El primer desafío de cada corredor SHALL tener el nivel de dificultad elegido por ese corredor. En una carrera local todos los corredores tienen el nivel elegido por el jugador; en una carrera multijugador cada persona tiene el suyo.

#### Scenario: Inicio en el nivel elegido
- **WHEN** un jugador inicia una carrera en el nivel 4
- **THEN** su primer desafío es de nivel 4

#### Scenario: Corredores con niveles distintos
- **WHEN** en la misma carrera un corredor eligió el nivel 8 y otro el nivel 2
- **THEN** el primer desafío del primero es de nivel 8 y el del segundo es de nivel 2

### Requirement: Rango de adaptación
El nivel de los desafíos de cada corredor SHALL mantenerse entre el nivel elegido por ese corredor menos 1 y ese nivel más 2, y siempre dentro de 1 a 10.

#### Scenario: Límite superior
- **WHEN** un jugador en nivel 4 ya recibe desafíos de nivel 6 y sigue acertando rápido
- **THEN** los desafíos siguientes continúan en nivel 6

#### Scenario: Límite en los extremos
- **WHEN** un jugador en nivel 1 falla repetidamente
- **THEN** los desafíos siguientes permanecen en nivel 1

#### Scenario: Rangos independientes
- **WHEN** en la misma carrera un corredor eligió el nivel 8 y otro el nivel 2
- **THEN** el primero recibe desafíos solo de los niveles 7 a 10 y el segundo solo de los niveles 1 a 4
