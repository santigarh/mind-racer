# daily-challenge Specification

## Purpose

Invita a jugar un rato cada día: una carrera diaria igual para todos los que corren el mismo nivel, que se juega una vez por día, lleva la cuenta de los días seguidos y permite compartir el resultado con la familia sin necesidad de servidor.

## Requirements

### Requirement: Desafío de hoy
El menú SHALL ofrecer el desafío de hoy: una carrera local contra bots cuya semilla se deriva solo de la fecha local del dispositivo (año, mes y día) y del nivel elegido. Dos personas que corran el desafío el mismo día en el mismo nivel SHALL recibir los mismos desafíos en el mismo orden y los mismos rivales con el mismo comportamiento, en cualquier dispositivo. El desafío SHALL cambiar a la medianoche local.

#### Scenario: Misma carrera para la familia
- **WHEN** Lucía y Papá corren el desafío del 11 de octubre en el nivel 3, cada quien en su celular
- **THEN** ambos reciben la misma secuencia de desafíos y los mismos bots

#### Scenario: Otro nivel, otra carrera
- **WHEN** el mismo día una persona corre el desafío en el nivel 3 y otra en el nivel 5
- **THEN** cada una recibe la carrera de su nivel, distinta de la otra

#### Scenario: Nuevo día
- **WHEN** pasa la medianoche local
- **THEN** el menú ofrece el desafío del nuevo día, con una carrera distinta a la de ayer

### Requirement: Nivel del desafío
El desafío SHALL ofrecer por defecto el nivel máximo desbloqueado del jugador y SHALL permitir elegir antes de correr cualquier otro nivel desbloqueado.

#### Scenario: Nivel por defecto
- **WHEN** un jugador con el nivel 6 desbloqueado abre el menú
- **THEN** el desafío de hoy aparece en el nivel 6

#### Scenario: Elegir un nivel más bajo
- **WHEN** ese jugador elige el nivel 3 para el desafío
- **THEN** corre la misma carrera del día que cualquiera que la corra en el nivel 3

### Requirement: Una vez por día
El desafío SHALL contar como hecho cuando su carrera termina con el jugador en ella, sea porque llegó a la meta o porque se acabó el tiempo. Una vez hecho, el menú SHALL mostrar "Hecho hoy" con el resultado y el tiempo que falta para el siguiente desafío, y no SHALL permitir correrlo de nuevo ese día. Si el jugador sale de la carrera antes de que termine, o la página se cierra, el desafío no cuenta y SHALL poder intentarlo de nuevo ese día.

#### Scenario: Desafío terminado
- **WHEN** el jugador termina el desafío de hoy y vuelve al menú
- **THEN** ve "Hecho hoy" con su puesto, su tiempo y cuánto falta para el próximo, y no hay botón para correrlo otra vez

#### Scenario: Salir a mitad
- **WHEN** el jugador sale del desafío antes de llegar a la meta
- **THEN** el menú sigue ofreciendo el desafío de hoy

#### Scenario: Se acaba el tiempo
- **WHEN** el tiempo límite termina la carrera antes de que el jugador llegue
- **THEN** el desafío cuenta como hecho, con el resultado "sin llegar"

### Requirement: Racha de días
El juego SHALL llevar la racha: la cantidad de días seguidos, hasta hoy o hasta ayer, en los que el jugador hizo el desafío, sin importar su puesto ni su precisión. Si pasa un día completo sin hacerlo, la racha SHALL volver a empezar en el siguiente desafío. El juego SHALL recordar la mejor racha. La racha SHALL mostrarse en el menú y en los resultados del desafío.

#### Scenario: Día siguiente
- **WHEN** el jugador hizo el desafío ayer con una racha de 4 y hoy lo termina
- **THEN** su racha pasa a 5

#### Scenario: Día saltado
- **WHEN** el jugador hizo el desafío por última vez anteayer y hoy lo termina
- **THEN** su racha es 1 y su mejor racha se conserva

#### Scenario: Racha pendiente hoy
- **WHEN** el jugador hizo el desafío ayer y todavía no lo hizo hoy
- **THEN** el menú muestra su racha actual y le invita a mantenerla

### Requirement: Resultados del desafío
Al terminar, la pantalla de resultados del desafío SHALL mostrar la clasificación como una carrera normal, además de la racha y un botón "Compartir resultado". No SHALL ofrecer "Correr de nuevo". El desafío SHALL contar como una carrera normal del nivel para las estadísticas y los desbloqueos.

#### Scenario: Desbloqueo desde el desafío
- **WHEN** el jugador termina 1.º el desafío en su nivel más alto con al menos 80 % de precisión
- **THEN** desbloquea el siguiente nivel igual que en una carrera normal

### Requirement: Compartir resultado
"Compartir resultado" SHALL enviar un texto corto con el desafío (fecha y nivel), el puesto, el tiempo o "sin llegar", las respuestas correctas sobre el total respondido, la racha y la dirección del juego. Donde exista el menú de compartir del dispositivo, SHALL usarlo; si no, SHALL copiar el texto y mostrar "Resultado copiado"; si tampoco se puede copiar, SHALL mostrar el texto para copiarlo a mano. El resultado del día SHALL poder compartirse también desde el menú mientras dure ese día.

#### Scenario: Compartir por mensaje
- **WHEN** el jugador pulsa "Compartir resultado" en un celular
- **THEN** se abre el menú de compartir con un texto como "Mind Racer · Desafío del 11 oct · Nivel 3 · 1.º · 0:42,3 · 18/20 · Racha 5" y la dirección del juego

#### Scenario: Computadora
- **WHEN** el navegador no tiene menú de compartir
- **THEN** el texto se copia y aparece "Resultado copiado"

### Requirement: Datos del desafío en el dispositivo
El resultado de cada día y la racha SHALL guardarse en el dispositivo, separados del perfil, de modo que un perfil existente no cambie. Si esos datos faltan o están dañados, el juego SHALL tratarlos como si no hubiera desafíos anteriores, sin afectar al perfil.

#### Scenario: Datos dañados
- **WHEN** los datos del desafío guardados están dañados
- **THEN** el menú ofrece el desafío de hoy con racha 0 y el perfil y sus estadísticas siguen intactos
