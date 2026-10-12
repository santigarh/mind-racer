# Spec Delta

## ADDED Requirements

### Requirement: Carrera sin adaptación
Una carrera SHALL poder configurarse sin adaptación. En ese modo, todos los desafíos de cada corredor SHALL tener el nivel elegido por ese corredor, sin subir ni bajar, y su nivel máximo alcanzado SHALL ser ese nivel. Por defecto, las carreras se adaptan como describen los demás requisitos.

#### Scenario: Racha rápida sin adaptación
- **WHEN** en una carrera sin adaptación un corredor de nivel 4 responde correctamente 3 desafíos seguidos por debajo del tiempo objetivo
- **THEN** su siguiente desafío sigue siendo de nivel 4

#### Scenario: Errores sin adaptación
- **WHEN** en una carrera sin adaptación un corredor de nivel 4 falla varias veces seguidas
- **THEN** sus desafíos siguen siendo de nivel 4
