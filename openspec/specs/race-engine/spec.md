# race-engine Specification

## Purpose

Define el ciclo de vida de una carrera y cómo se mueven los corredores en función de sus respuestas, de forma independiente del tipo de desafío, para que todas las variantes y modos (bots y multijugador) compartan las mismas reglas.

## Requirements

### Requirement: Fases de la carrera
Una carrera SHALL pasar por las fases `waiting`, `countdown`, `racing` y `finished`, en ese orden y sin retroceder. Durante `countdown` (3 segundos) ningún corredor puede avanzar ni responder.

#### Scenario: Cuenta regresiva antes de correr
- **WHEN** se inicia una carrera con sus corredores
- **THEN** la carrera entra en `countdown` durante 3 segundos y luego pasa a `racing`

#### Scenario: Respuesta durante la cuenta regresiva
- **WHEN** un corredor envía una respuesta durante `countdown`
- **THEN** la respuesta se ignora y el corredor no gana velocidad

### Requirement: Distancia fija y meta
Cada carrera SHALL tener una distancia fija igual para todos los corredores. Un corredor termina cuando su distancia recorrida alcanza la distancia total, y desde ese momento su posición final y su tiempo quedan fijos.

#### Scenario: Corredor cruza la meta
- **WHEN** la distancia recorrida de un corredor alcanza la distancia total
- **THEN** el corredor queda marcado como terminado con su tiempo de llegada y deja de recibir desafíos

### Requirement: Aceleración por respuesta correcta
Cada respuesta correcta SHALL aumentar la velocidad del corredor. El impulso SHALL ser mayor cuanto más alto sea el nivel de dificultad del desafío respondido y cuanto más rápida sea la respuesta, y la velocidad nunca SHALL superar una velocidad máxima.

#### Scenario: Respuesta correcta acelera
- **WHEN** un corredor en `racing` responde correctamente
- **THEN** su velocidad aumenta inmediatamente

#### Scenario: Desafío más difícil da más impulso
- **WHEN** dos respuestas correctas con el mismo tiempo de respuesta corresponden a niveles de dificultad distintos
- **THEN** la del nivel más alto produce un impulso mayor

#### Scenario: Tope de velocidad
- **WHEN** un corredor ya está a velocidad máxima y responde correctamente
- **THEN** su velocidad permanece en el máximo

### Requirement: Desaceleración con el tiempo
La velocidad de un corredor SHALL disminuir progresivamente mientras no responda correctamente, hasta poder llegar a cero.

#### Scenario: Corredor sin responder
- **WHEN** un corredor deja de responder durante la carrera
- **THEN** su velocidad disminuye con el tiempo hasta detenerse

### Requirement: Penalización por error
Una respuesta incorrecta SHALL reducir la velocidad actual del corredor y reiniciar su racha. El desafío fallado se reemplaza por uno nuevo.

#### Scenario: Respuesta incorrecta frena
- **WHEN** un corredor responde incorrectamente
- **THEN** su velocidad se reduce, su racha vuelve a cero y recibe un nuevo desafío

### Requirement: Racha y nitro
El motor SHALL contar las respuestas correctas consecutivas de cada corredor. Al llegar a 5 aciertos seguidos el corredor SHALL recibir un nitro: un impulso extra temporal que puede superar momentáneamente la velocidad máxima normal.

#### Scenario: Activación de nitro
- **WHEN** un corredor acumula 5 respuestas correctas consecutivas
- **THEN** recibe un nitro y su racha cuenta de nuevo hacia el siguiente nitro

### Requirement: Límite de tiempo
Una carrera SHALL terminar como máximo 3 minutos después de iniciar `racing`. Al vencer el límite, los corredores que no llegaron a la meta se clasifican por distancia recorrida, detrás de los que sí llegaron.

#### Scenario: Se agota el tiempo
- **WHEN** pasan 3 minutos de `racing` y algún corredor no ha terminado
- **THEN** la carrera pasa a `finished` y los no terminados quedan ordenados por distancia, detrás de los terminados

### Requirement: Fin de carrera y clasificación
La carrera SHALL pasar a `finished` cuando todos los corredores terminan o se agota el tiempo, y SHALL producir una clasificación con, por corredor: posición, tiempo o distancia, respuestas correctas, respuestas incorrectas, precisión y respuestas correctas por minuto.

#### Scenario: Todos llegan a la meta
- **WHEN** el último corredor cruza la meta
- **THEN** la carrera pasa a `finished` y la clasificación ordena a los corredores por tiempo de llegada

### Requirement: Determinismo
Dadas la misma configuración, la misma semilla y la misma secuencia de eventos con sus marcas de tiempo, el motor SHALL producir exactamente el mismo estado y la misma clasificación.

#### Scenario: Repetición de una carrera
- **WHEN** se reproduce una carrera con la misma semilla y los mismos eventos
- **THEN** las posiciones, velocidades y clasificación resultantes son idénticas

### Requirement: Independencia del tipo de desafío
El motor SHALL funcionar con cualquier fuente de desafíos que entregue un desafío con nivel de dificultad y valide respuestas, sin conocer si son matemáticos u otra variante.

#### Scenario: Fuente de desafíos alternativa
- **WHEN** se configura una carrera con una fuente de desafíos distinta a matemáticas
- **THEN** la carrera funciona con las mismas reglas de velocidad, racha, meta y clasificación

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
