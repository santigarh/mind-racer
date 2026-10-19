# Proposal

## Why

Mind Racer ya funciona bien para una familia (salas de 4), pero el mismo juego sirve para practicar cálculo mental en una clase. Una profesora podría proyectar un código QR, que sus alumnos entren desde sus celulares y correr todos a la vez, cada uno en su nivel. Hoy no se puede: las salas admiten 4 personas, el anfitrión corre como uno más, se rellenan con bots, y el servidor envía a cada jugador el estado de todos 20 veces por segundo. Con 30 alumnos serían unos 3 MB/s de salida, demasiado para el plan gratis de Render y para el wifi de una escuela.

## What Changes

- **Sala de clase**: desde "Jugar con amigos", la profesora puede crear una sala de clase. Admite hasta 40 alumnos, y ella no cuenta.
- **La profesora no corre**: es la anfitriona y ve un **tablero** pensado para el proyector:
  - en el lobby, el QR y el código en grande, y la lista de alumnos con su nivel y si están conectados;
  - durante la carrera, el avance de todos ordenado por posición;
  - al final, la clasificación completa y un botón **Descargar CSV**.
- **Sin bots** en las salas de clase. Cada alumno elige su nivel, como en las salas familiares.
- **Quitar a un alumno**: la profesora puede sacar de la sala a alguien, por ejemplo por un nombre inadecuado. Esa persona no puede volver a entrar con la misma sesión.
- **La anfitriona no cambia**: si la profesora pierde la conexión, la sala la espera. Si cierra la sala, todos vuelven a "Jugar con amigos" con un aviso.
- **Envío de estado reducido** en salas de clase:
  - cada alumno recibe solo su propio estado y el de los 5 primeros, 5 veces por segundo;
  - el tablero recibe a todos, también 5 veces por segundo;
  - el celular del alumno muestra su carril y los de los 3 primeros (los 5 primeros en pantallas más anchas).
- Las salas familiares no cambian (4 personas, bots, 20 envíos por segundo).
- Fuera de alcance:
  - cuentas de profesora o de alumno, y listas de clase guardadas;
  - historial o tareas asíncronas;
  - niveles impuestos por la profesora, y varias salas por profesora;
  - verificar redes escolares que bloqueen WebSockets (se documenta como riesgo).

## Capabilities

### New Capabilities
- `classroom-mode`: salas de clase de hasta 40 alumnos con una profesora que no corre, tablero para proyector, quitar alumnos, clasificación descargable y envío de estado reducido.

### Modified Capabilities
- `multiplayer-rooms`: "Capacidad de la sala" y "Transferencia de anfitrión" pasan a aplicar solo a salas familiares; las de clase siguen `classroom-mode`.
- `multiplayer-race`: "Bots de relleno" solo aplica a salas familiares; las salas de clase no tienen bots.

## Impact

- `packages/protocol`:
  - `create` acepta `mode: 'class'`;
  - `room` informa el modo de la sala y el rol de cada persona;
  - mensajes nuevos `kick` (de la profesora) y `closeRoom`;
  - error `removed` para quien fue quitado;
  - el mensaje `state` puede traer solo algunos corredores.
- `apps/server`: `Room` con modo familia o clase:
  - capacidad de 40 sin contar a la profesora;
  - sin bots y sin transferencia de anfitriona;
  - la profesora fuera de la carrera;
  - expulsión, y estado reducido a 5 Hz por destinatario en clase.
- `apps/web`:
  - opción "Crear sala de clase";
  - pantallas del tablero (lobby, carrera, resultados y CSV);
  - el alumno ve su carril y los primeros, y resultados acotados;
  - `NetworkRaceController` conserva el último estado conocido de corredores que no llegan en un mensaje.
- Sin cambios en el motor ni en el despliegue. Riesgos documentados: el plan gratis se duerme, una sola instancia, y redes escolares.
