# Spec Delta

## Purpose

Proporciona rivales simulados para jugar sin conexión, que compiten con exactamente las mismas reglas que un jugador humano y con una habilidad calibrada al nivel elegido.

## ADDED Requirements

### Requirement: Rivales en carrera local
Una carrera local SHALL incluir al jugador y 3 bots, cada uno con nombre y auto visualmente distinguibles.

#### Scenario: Inicio de carrera local
- **WHEN** el jugador inicia una carrera contra bots
- **THEN** la carrera tiene 4 corredores: el jugador y 3 bots con nombres distintos

### Requirement: Mismas reglas que el jugador
Los bots SHALL avanzar únicamente enviando respuestas al motor de carrera, que aplica las mismas reglas de velocidad, error, racha y dificultad adaptativa que al jugador.

#### Scenario: Bot falla una respuesta
- **WHEN** un bot envía una respuesta incorrecta
- **THEN** sufre la misma penalización de velocidad y reinicio de racha que un jugador

### Requirement: Perfiles de habilidad variados
Los 3 bots SHALL tener perfiles distintos (más lento, parejo y más rápido que el promedio esperado para el nivel), definidos por tiempo medio de respuesta, variación y probabilidad de acierto.

#### Scenario: Diferencias entre bots
- **WHEN** se simulan muchas carreras sin jugador activo en un mismo nivel
- **THEN** el bot de perfil rápido termina en promedio antes que el parejo, y este antes que el lento

### Requirement: Calibración al nivel
El tiempo de respuesta de un bot SHALL aumentar con el nivel de dificultad del desafío que está resolviendo, de modo que al subir de nivel los bots no se vuelvan más rápidos en términos relativos.

#### Scenario: Desafío más difícil para un bot
- **WHEN** un bot recibe un desafío de nivel más alto que el anterior
- **THEN** su tiempo esperado de respuesta para ese desafío es mayor

### Requirement: Comportamiento reproducible
Con la misma semilla de carrera, los bots SHALL tomar las mismas decisiones (tiempos y aciertos).

#### Scenario: Repetir carrera con bots
- **WHEN** se ejecutan dos carreras con la misma semilla y el jugador no responde
- **THEN** los bots producen la misma clasificación y los mismos tiempos
