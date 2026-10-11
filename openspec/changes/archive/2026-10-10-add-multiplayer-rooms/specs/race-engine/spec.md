# Spec Delta

## ADDED Requirements

### Requirement: Nivel elegido por corredor
Una carrera SHALL admitir que cada corredor tenga su propio nivel elegido, con la misma distancia y las mismas reglas de velocidad para todos. La clasificación SHALL informar el nivel elegido de cada corredor.

#### Scenario: Niveles mezclados
- **WHEN** se inicia una carrera con un corredor en nivel 8 y otro en nivel 2
- **THEN** ambos corren la misma distancia con las mismas reglas y la clasificación muestra nivel 8 y nivel 2

#### Scenario: Carrera local
- **WHEN** se inicia una carrera local en nivel 4
- **THEN** todos los corredores, incluidos los bots, tienen nivel elegido 4

### Requirement: Tiempo de respuesta informado
Al registrar una respuesta, el motor SHALL aceptar opcionalmente un tiempo de respuesta medido externamente y SHALL usarlo, en lugar del calculado por su reloj, para el impulso y la dificultad adaptativa. El momento en que se aplica la respuesta SHALL seguir siendo el de su marca de tiempo.

#### Scenario: Tiempo compensado
- **WHEN** una respuesta llega 2,1 s después de emitido el desafío pero se informa un tiempo de respuesta de 2,0 s
- **THEN** el impulso es el que corresponde a 2,0 s y la respuesta se aplica en el instante de su llegada

#### Scenario: Sin tiempo informado
- **WHEN** una respuesta se registra sin tiempo de respuesta informado
- **THEN** el motor usa el tiempo transcurrido desde que emitió el desafío, como en las carreras locales
