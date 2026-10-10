# adaptive-difficulty Specification

## Purpose

Ajusta el nivel de dificultad de cada desafío durante la carrera según el desempeño del corredor, para que el juego se mantenga retador sin frustrar, dentro de un rango acotado alrededor del nivel elegido.

## Requirements

### Requirement: Nivel inicial de la carrera
El primer desafío de cada corredor SHALL tener el nivel de dificultad elegido para la carrera.

#### Scenario: Inicio en el nivel elegido
- **WHEN** un jugador inicia una carrera en el nivel 4
- **THEN** su primer desafío es de nivel 4

### Requirement: Rango de adaptación
El nivel de los desafíos SHALL mantenerse entre el nivel elegido menos 1 y el nivel elegido más 2, y siempre dentro de 1 a 10.

#### Scenario: Límite superior
- **WHEN** un jugador en nivel 4 ya recibe desafíos de nivel 6 y sigue acertando rápido
- **THEN** los desafíos siguientes continúan en nivel 6

#### Scenario: Límite en los extremos
- **WHEN** un jugador en nivel 1 falla repetidamente
- **THEN** los desafíos siguientes permanecen en nivel 1

### Requirement: Subida de dificultad
Tras 3 respuestas correctas consecutivas respondidas por debajo del tiempo objetivo del nivel actual, el nivel de los desafíos siguientes SHALL subir en 1, respetando el rango de adaptación.

#### Scenario: Racha rápida
- **WHEN** un corredor responde correctamente 3 desafíos seguidos de nivel 4, cada uno por debajo del tiempo objetivo
- **THEN** su siguiente desafío es de nivel 5

#### Scenario: Racha lenta
- **WHEN** un corredor responde correctamente 3 desafíos seguidos pero alguno supera el tiempo objetivo
- **THEN** el nivel no sube

### Requirement: Bajada de dificultad
Tras 2 respuestas incorrectas dentro de los últimos 4 desafíos, el nivel de los desafíos siguientes SHALL bajar en 1, respetando el rango de adaptación.

#### Scenario: Errores seguidos
- **WHEN** un corredor en nivel 5 falla 2 de sus últimos 4 desafíos
- **THEN** su siguiente desafío es de nivel 4

### Requirement: Ventana de desempeño tras un cambio
Después de cada subida o bajada, el conteo de aciertos y errores para decidir el siguiente ajuste SHALL reiniciarse.

#### Scenario: Sin cambios en cascada
- **WHEN** el nivel acaba de subir
- **THEN** se necesitan otras 3 respuestas correctas rápidas en el nuevo nivel para volver a subir

### Requirement: Nivel máximo alcanzado
El resultado de la carrera SHALL informar el nivel máximo de dificultad que alcanzó cada corredor.

#### Scenario: Resultado con nivel máximo
- **WHEN** un corredor llegó a recibir desafíos de nivel 6 durante la carrera
- **THEN** su resultado indica nivel máximo 6
