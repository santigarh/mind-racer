# math-challenges Specification

## Purpose

Genera y valida los problemas de cálculo mental de Math Racer, organizados en niveles de dificultad que cubren desde sumas de una cifra hasta cálculo mental avanzado para jugadores de todas las edades.

## Requirements

### Requirement: Niveles de dificultad
El generador SHALL ofrecer 10 niveles de dificultad numerados del 1 al 10, ordenados de menor a mayor exigencia. Cada nivel SHALL definir qué operaciones y rangos de números puede contener (catálogo en design.md).

#### Scenario: Nivel 1
- **WHEN** se pide un problema de nivel 1
- **THEN** el problema es una suma de dos números de una cifra

#### Scenario: Nivel 4
- **WHEN** se pide un problema de nivel 4
- **THEN** el problema es una multiplicación de las tablas del 2 al 10

#### Scenario: Nivel 10
- **WHEN** se pide un problema de nivel 10
- **THEN** el problema puede combinar varias operaciones, números de varias cifras, potencias o porcentajes

### Requirement: Respuesta entera única
Todo problema generado SHALL tener una única respuesta correcta que sea un número entero. Las divisiones SHALL ser exactas. En los niveles 1 a 5 la respuesta SHALL ser mayor o igual a cero.

#### Scenario: División generada
- **WHEN** el generador produce una división
- **THEN** el dividendo es múltiplo exacto del divisor y el divisor no es cero

#### Scenario: Resta en nivel bajo
- **WHEN** el generador produce una resta en el nivel 2
- **THEN** el resultado es mayor o igual a cero

### Requirement: Presentación legible
Cada problema SHALL presentarse como una expresión en notación matemática habitual (usando `+`, `−`, `×`, `÷`, paréntesis, `²`, `√` y `%`), con su respuesta oculta al jugador.

#### Scenario: Texto de un problema
- **WHEN** se genera una multiplicación de 7 por 8
- **THEN** el texto mostrado es `7 × 8` y la respuesta esperada es 56

### Requirement: Validación de respuestas
La validación SHALL comparar el valor numérico de la respuesta del jugador con la respuesta correcta, ignorando espacios y ceros a la izquierda, y aceptando el signo menos en respuestas negativas.

#### Scenario: Respuesta con cero a la izquierda
- **WHEN** la respuesta correcta es 56 y el jugador envía `056`
- **THEN** la respuesta se considera correcta

#### Scenario: Respuesta negativa
- **WHEN** la respuesta correcta es -12 y el jugador envía `-12`
- **THEN** la respuesta se considera correcta

#### Scenario: Entrada no numérica
- **WHEN** el jugador envía un texto que no es un número entero
- **THEN** la respuesta se considera incorrecta

### Requirement: Sin repeticiones inmediatas
El generador SHALL evitar repetir el mismo problema dentro de los últimos 10 problemas entregados a un mismo corredor.

#### Scenario: Problemas consecutivos
- **WHEN** un corredor recibe 10 problemas seguidos del mismo nivel
- **THEN** ninguno de ellos es idéntico a otro (misma operación y mismos operandos)

### Requirement: Generación reproducible
Con la misma semilla y la misma secuencia de niveles pedidos, el generador SHALL producir la misma secuencia de problemas.

#### Scenario: Misma semilla
- **WHEN** se generan dos secuencias con la misma semilla y los mismos niveles
- **THEN** ambas secuencias son idénticas
