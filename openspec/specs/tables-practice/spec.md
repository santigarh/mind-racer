# tables-practice Specification

## Purpose

Permite practicar tablas de multiplicar concretas en una carrera: elegir una o varias tablas, opcionalmente con sus divisiones, y correr con un ritmo fijo y sin que la práctica cuente para el progreso.

## Requirements

### Requirement: Elegir tablas
Una práctica de tablas SHALL definirse por una o varias tablas del 2 al 10 y por si incluye divisiones. Las divisiones SHALL venir apagadas por defecto. No SHALL poder iniciarse una práctica sin al menos una tabla elegida. Cada tabla SHALL figurar una sola vez, y las tablas SHALL mostrarse ordenadas de menor a mayor.

#### Scenario: Varias tablas
- **WHEN** el jugador elige las tablas 8 y 7
- **THEN** la práctica es de las tablas del 7 y del 8, sin divisiones

#### Scenario: Ninguna tabla
- **WHEN** el jugador no eligió ninguna tabla
- **THEN** no puede iniciar la práctica

### Requirement: Problemas de una tabla
Para cada tabla elegida N, una práctica de tablas SHALL generar solo multiplicaciones de N por un número del 1 al 10, en cualquiera de los dos órdenes (`N × k` o `k × N`). Todas las multiplicaciones posibles de las tablas elegidas SHALL poder salir.

#### Scenario: Tabla del 7
- **WHEN** se practica solo la tabla del 7, sin divisiones
- **THEN** cada problema es `7 × k` o `k × 7`, con k entre 1 y 10

#### Scenario: Orden mezclado
- **WHEN** se generan suficientes problemas de la tabla del 7
- **THEN** salen problemas con el 7 primero y también con el 7 segundo

#### Scenario: Nada fuera de las tablas elegidas
- **WHEN** se practican las tablas del 3 y del 9
- **THEN** ningún problema es una multiplicación que no tenga un 3 o un 9 como factor junto a un número del 1 al 10

### Requirement: Divisiones de una tabla
Si la práctica incluye divisiones, además de las multiplicaciones SHALL poder salir, para cada tabla elegida N, la división de `N × k` entre N, con k del 1 al 10, cuyo resultado es k. El divisor SHALL ser siempre la tabla elegida.

#### Scenario: Divisiones de la tabla del 7
- **WHEN** se practica la tabla del 7 con divisiones
- **THEN** pueden salir problemas como `21 ÷ 7` (resultado 3), y nunca `21 ÷ 3`

#### Scenario: Divisiones apagadas
- **WHEN** se practica la tabla del 7 sin divisiones
- **THEN** no sale ninguna división

### Requirement: Sin repeticiones en la práctica de tablas
Una práctica de tablas SHALL respetar la misma regla que los niveles: un corredor no SHALL recibir un problema idéntico (misma operación y mismos operandos) a otro de sus últimos 10 problemas. `7 × 3` y `3 × 7` SHALL contar como problemas distintos.

#### Scenario: Una sola tabla
- **WHEN** un corredor recibe 11 problemas seguidos de la tabla del 2
- **THEN** ningún problema es idéntico a otro de los 10 anteriores

### Requirement: Ritmo fijo
Una carrera de tablas no SHALL usar la dificultad adaptativa: los problemas SHALL ser siempre de las tablas elegidas, respondan como respondan. Cada multiplicación SHALL tener el tiempo esperado de un problema del nivel 4, y cada división el de uno del nivel 5.

#### Scenario: Racha rápida
- **WHEN** un jugador responde 5 multiplicaciones seguidas, todas correctas y más rápido que el tiempo esperado
- **THEN** los problemas siguientes siguen siendo de las tablas elegidas

#### Scenario: Bots al ritmo de las tablas
- **WHEN** un jugador corre una práctica de tablas contra los bots
- **THEN** los bots responden con el mismo ritmo que en una carrera del nivel 4

### Requirement: Práctica de tablas en solitario
Desde el menú, el jugador SHALL poder elegir tablas, activar o no las divisiones y correr una práctica de tablas contra los bots. La práctica SHALL estar disponible sin importar el nivel desbloqueado. Al terminar, "Jugar de nuevo" SHALL repetir la práctica con las mismas tablas.

#### Scenario: Principiante practica la tabla del 7
- **WHEN** un jugador con solo el nivel 1 desbloqueado elige la tabla del 7 y pulsa "Correr tablas"
- **THEN** corre contra los bots con problemas de la tabla del 7

#### Scenario: Jugar de nuevo
- **WHEN** el jugador termina una práctica de las tablas del 6 y del 7 con divisiones y pulsa "Jugar de nuevo"
- **THEN** empieza otra práctica de las tablas del 6 y del 7 con divisiones

### Requirement: La práctica de tablas no cuenta para el progreso
Una carrera de tablas, en solitario o en una sala de clase, no SHALL desbloquear niveles, no SHALL cambiar las marcas por nivel y no SHALL sumar carreras ni victorias para el garaje. Los resultados de una carrera de tablas SHALL decir que es una práctica de tablas y que no cuenta para el progreso.

#### Scenario: Ganar una práctica
- **WHEN** un jugador con nivel máximo 3 gana una práctica de tablas con 100 % de precisión
- **THEN** sigue con nivel máximo 3, sus marcas no cambian y su pantalla de resultados dice que la práctica no cuenta para el progreso

### Requirement: Práctica de tablas reproducible
Con la misma semilla y las mismas tablas, una práctica de tablas SHALL producir la misma secuencia de problemas para cada corredor.

#### Scenario: Misma semilla
- **WHEN** se generan dos prácticas de las tablas del 4 y del 5 con la misma semilla
- **THEN** ambas secuencias son idénticas
