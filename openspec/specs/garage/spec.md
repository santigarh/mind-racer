# garage Specification

## Purpose

Convierte el progreso del jugador en algo visible: un garaje donde se eligen vehículo y pintura entre los que se desbloquean jugando, y ese auto es el que corre en la pista, en carreras locales y en las salas con la familia.

## Requirements

### Requirement: Vehículos
El garaje SHALL ofrecer estos vehículos, cada uno disponible cuando el progreso cumple su condición:

| Vehículo | Se desbloquea con |
|---|---|
| Clásico | desde el inicio |
| Moto | 3 carreras terminadas |
| Scooter | 1 victoria |
| Camión | el nivel 4 desbloqueado |
| Furgoneta | una racha de 3 días en el desafío diario |
| Tractor | 10 victorias |

#### Scenario: Primer día
- **WHEN** un jugador nuevo abre el garaje
- **THEN** solo tiene disponibles el clásico y el ámbar, y el resto aparece bloqueado

#### Scenario: Desbloqueo por victorias
- **WHEN** el jugador gana su primera carrera
- **THEN** el scooter queda disponible en el garaje

### Requirement: Pinturas
El garaje SHALL ofrecer estas pinturas, cada una disponible cuando el progreso cumple su condición:

| Pintura | Se desbloquea con |
|---|---|
| Ámbar | desde el inicio |
| Rojo | 1 carrera terminada |
| Morado | el nivel 3 desbloqueado |
| Verde | el desafío diario hecho al menos una vez |
| Azul | 5 carreras terminadas |
| Cian | 5 victorias |
| Blanco | 25 carreras terminadas |
| Dorado | una racha de 7 días en el desafío diario |

#### Scenario: Primera carrera
- **WHEN** un jugador nuevo termina su primera carrera
- **THEN** la pintura roja queda disponible

### Requirement: Cómo se mide el progreso
Las carreras terminadas y las victorias SHALL sumarse en todos los niveles, locales y en línea, tal como ya se guardan en el perfil. La racha SHALL ser la mejor racha del desafío diario. Un desbloqueo SHALL ser permanente aunque luego la racha se pierda. El juego no SHALL usar monedas, tienda ni compras.

#### Scenario: Racha perdida
- **WHEN** el jugador llegó a una racha de 3 días y después se le cortó
- **THEN** la furgoneta sigue disponible

#### Scenario: Victorias en distintos niveles
- **WHEN** el jugador ganó 3 carreras en el nivel 2 y 2 en el nivel 5
- **THEN** cuenta con 5 victorias y la pintura cian está disponible

### Requirement: Pantalla del garaje
El menú SHALL tener un acceso "Garaje". El garaje SHALL mostrar una vista previa del auto elegido y la lista de vehículos y pinturas. Cada elemento bloqueado SHALL mostrar su condición y el avance hacia ella, por ejemplo "Gana 3 carreras · 1/3". Elegir un vehículo o una pintura disponible SHALL cambiar la vista previa y guardar la elección. Los elementos bloqueados no SHALL poder elegirse.

#### Scenario: Elegir pintura
- **WHEN** el jugador elige la pintura roja, ya desbloqueada
- **THEN** la vista previa se pinta de rojo y la próxima carrera usa ese color

#### Scenario: Ver cuánto falta
- **WHEN** el jugador con 1 victoria mira el tractor
- **THEN** ve que se gana con 10 victorias y que lleva 1 de 10

### Requirement: Elección guardada en el dispositivo
La elección de vehículo y pintura SHALL guardarse en el dispositivo, separada del perfil, de modo que el perfil no cambie. Si no hay elección guardada, o la guardada está dañada, no existe o no está desbloqueada, el juego SHALL usar el clásico ámbar.

#### Scenario: Volver a abrir el juego
- **WHEN** el jugador eligió la moto azul y vuelve a abrir el juego
- **THEN** su auto sigue siendo la moto azul

#### Scenario: Elección inválida
- **WHEN** la elección guardada es un vehículo que no existe
- **THEN** el jugador corre con el clásico ámbar

### Requirement: Tu auto en la pista
En carreras locales y en línea, el auto del jugador SHALL dibujarse con su vehículo y su pintura, mirando hacia la meta, y su carril SHALL seguir resaltado como el propio. La clasificación de resultados SHALL usar la pintura de cada persona. Los bots SHALL conservar sus colores.

#### Scenario: Carrera local
- **WHEN** el jugador con el camión verde corre contra bots
- **THEN** su carril muestra un camión verde y los bots conservan sus autos y colores

### Requirement: Aviso de desbloqueo
Si una carrera, incluido el desafío diario, desbloquea un vehículo o una pintura, la pantalla de resultados SHALL anunciarlo, por ejemplo "Nuevo en el garaje: Scooter".

#### Scenario: Primera victoria
- **WHEN** el jugador gana su primera carrera
- **THEN** los resultados muestran "Nuevo en el garaje: Scooter"
