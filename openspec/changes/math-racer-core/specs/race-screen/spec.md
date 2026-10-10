# Spec Delta

## Purpose

Define lo que el jugador ve y cómo interactúa durante una carrera de Math Racer: la pista, el desafío actual, la entrada de respuestas, la retroalimentación inmediata y los resultados.

## ADDED Requirements

### Requirement: Pista con todos los corredores
La pantalla SHALL mostrar un carril por corredor con su auto, nombre y avance hacia la meta, actualizados de forma fluida durante la carrera. El carril del jugador SHALL destacarse.

#### Scenario: Avance visible
- **WHEN** un corredor gana distancia
- **THEN** su auto se desplaza en su carril de forma proporcional a la distancia recorrida

### Requirement: Cuenta regresiva visible
La pantalla SHALL mostrar la cuenta regresiva 3, 2, 1 y una señal de salida antes de habilitar la entrada de respuestas.

#### Scenario: Salida
- **WHEN** termina la cuenta regresiva
- **THEN** aparece el primer desafío y el campo de respuesta recibe el foco

### Requirement: Desafío y entrada de respuesta
Durante la carrera la pantalla SHALL mostrar el desafío actual en tamaño grande y un campo de respuesta numérica. Enter SHALL enviar la respuesta; además, al escribir tantos caracteres (dígitos y signo) como tiene la respuesta correcta, se SHALL enviar automáticamente.

#### Scenario: Envío automático
- **WHEN** el desafío es `7 × 8` y el jugador escribe `56`
- **THEN** la respuesta se envía sin pulsar Enter y aparece el siguiente desafío

#### Scenario: Envío con Enter
- **WHEN** el jugador escribe `5` y pulsa Enter con el desafío `7 × 8`
- **THEN** la respuesta se envía y se evalúa como incorrecta

### Requirement: Teclado en pantalla
En dispositivos táctiles la pantalla SHALL ofrecer un teclado numérico propio (dígitos, signo menos, borrar y enviar) que funcione igual que el teclado físico.

#### Scenario: Juego en celular
- **WHEN** un jugador en un celular toca los dígitos del teclado en pantalla
- **THEN** los dígitos aparecen en el campo de respuesta y se aplican las mismas reglas de envío

### Requirement: Retroalimentación inmediata
Tras cada respuesta la pantalla SHALL indicar de forma visible si fue correcta o incorrecta; en caso de error SHALL mostrar brevemente la respuesta correcta. Los cambios de velocidad, racha y nitro SHALL ser visibles.

#### Scenario: Error
- **WHEN** el jugador responde incorrectamente
- **THEN** se muestra una señal de error con la respuesta correcta y el auto del jugador se ve frenar

#### Scenario: Nitro
- **WHEN** el jugador activa un nitro
- **THEN** su auto muestra un efecto de nitro mientras dure

### Requirement: Indicadores en vivo
Durante la carrera la pantalla SHALL mostrar al jugador su posición actual, velocidad, racha, tiempo transcurrido y nivel del desafío actual.

#### Scenario: Cambio de posición
- **WHEN** el jugador adelanta a un rival
- **THEN** el indicador de posición se actualiza

### Requirement: Jugador terminado
Cuando el jugador cruza la meta antes del fin de la carrera, la pantalla SHALL ocultar la entrada de respuestas y seguir mostrando la carrera de los demás hasta que termine.

#### Scenario: Llegada del jugador
- **WHEN** el jugador cruza la meta y aún hay bots corriendo
- **THEN** se muestra su posición final y la pista sigue animándose hasta el final de la carrera

### Requirement: Pantalla de resultados
Al terminar la carrera la pantalla SHALL mostrar la clasificación completa, las estadísticas del jugador (posición, tiempo, aciertos, errores, precisión, respuestas correctas por minuto, nivel máximo alcanzado), récords y desbloqueos obtenidos, y opciones para correr de nuevo o volver al menú.

#### Scenario: Correr de nuevo
- **WHEN** el jugador elige correr de nuevo en la pantalla de resultados
- **THEN** comienza una nueva carrera en el mismo nivel con una nueva semilla

### Requirement: Pausa al ocultar la pestaña
Una carrera local SHALL pausarse cuando la pestaña del juego deja de estar visible y SHALL reanudarse con una nueva cuenta regresiva de 3 segundos al volver, sin que el tiempo oculto cuente para nadie.

#### Scenario: Cambiar de pestaña
- **WHEN** el jugador cambia de pestaña durante una carrera contra bots y vuelve 10 segundos después
- **THEN** ningún corredor avanzó mientras estaba oculta y la carrera continúa tras una cuenta regresiva

### Requirement: Abandonar carrera
El jugador SHALL poder abandonar una carrera en curso; una carrera abandonada no SHALL contar para estadísticas ni desbloqueos.

#### Scenario: Salir con Escape
- **WHEN** el jugador pulsa Escape y confirma salir
- **THEN** vuelve al menú y sus estadísticas no cambian
