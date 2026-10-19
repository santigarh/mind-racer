# Spec Delta

## MODIFIED Requirements

### Requirement: Cómo se mide el progreso
Las carreras terminadas y las victorias SHALL sumarse en todos los niveles, locales y en línea, tal como ya se guardan en el perfil. Las carreras de tablas no SHALL sumar carreras ni victorias. La racha SHALL ser la mejor racha del desafío diario. Un desbloqueo SHALL ser permanente aunque luego la racha se pierda. El juego no SHALL usar monedas, tienda ni compras.

#### Scenario: Racha perdida
- **WHEN** el jugador llegó a una racha de 3 días y después se le cortó
- **THEN** la furgoneta sigue disponible

#### Scenario: Victorias en distintos niveles
- **WHEN** el jugador ganó 3 carreras en el nivel 2 y 2 en el nivel 5
- **THEN** cuenta con 5 victorias y la pintura cian está disponible

#### Scenario: Victorias en prácticas de tablas
- **WHEN** el jugador tiene 4 victorias en carreras por nivel y gana una práctica de tablas
- **THEN** sigue contando con 4 victorias
