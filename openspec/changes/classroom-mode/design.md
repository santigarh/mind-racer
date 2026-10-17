# Design

## Context

Ver proposal.md (Why) y las specs de este cambio. Estado actual relevante (revisado en el código):

- **Sala (`Room`):**
  - `ROOM_LIMITS.capacity = 4`;
  - el primer jugador es `hostId` y el rol pasa al siguiente si se va;
  - `start` arma la carrera con las personas en `lobby` conectadas, más bots hasta 4.
- **Envío de estado:** `RoomManager.tick()` corre cada 50 ms. `Room.tick()` llama a `broadcastState()` en cada tick, y envía el mismo mensaje `state`, con todos los corredores (~180 B cada uno en JSON), a cada persona que corre.
- **Cliente:**
  - `NetworkRaceController.buildState()` arma los corredores a partir de `raceStart.runners` y del último `state`;
  - si un corredor no viene en el último `state`, hoy su distancia vuelve a 0 y su posición a la del orden de salida.
  - `RaceScreen` asume que el jugador es uno de los corredores.
- **Errores:** la sesión del cliente muestra los errores del servidor solo en la pantalla de entrada; no hay forma de que el servidor saque a alguien de una sala.
- **Ya existe y sirve tal cual:** código, enlace `?sala=` y QR; nivel por persona; presencia y reconexión de 30 s; "Unirse durante una carrera".

## Goals / Non-Goals

**Goals:**
- Una clase de hasta 40 alumnos en vivo, sin cuentas ni datos guardados, y que la profesora controle desde un proyector.
- Que el ancho de banda de una carrera de clase quede muy por debajo de lo que costaría el envío completo.
- No cambiar en nada el comportamiento de las salas familiares.

**Non-Goals:**
- Persistencia, cuentas, listas de clase y tareas asíncronas.
- Niveles impuestos por la profesora y varias salas por profesora.
- Garantizar que una red escolar permita WebSockets.

## Decisions

### D1. Modo de la sala y roles
- `Room` gana `mode: 'family' | 'class'`, fijado al crearla (`create` con `mode: 'class'`; sin campo es `family`).
- `Player` gana `role: 'teacher' | 'student'`. En clase, quien crea la sala es `teacher`, y el resto `student`. En familia, todos son `student`, de modo que se mantiene el comportamiento actual.
- Límites:
  - `ROOM_LIMITS.capacity` (4) se aplica a familia;
  - `ROOM_LIMITS.classCapacity = 40` cuenta solo alumnos en clase.
- Protocolo:
  - `room` informa `mode` y cada jugador lleva `role`, ambos opcionales para compatibilidad con versiones viejas;
  - el `hostId` de una sala de clase siempre es la profesora.

### D2. Carrera de clase en el servidor
- `start` en clase:
  - toma a los alumnos en `lobby` conectados, nunca a la profesora;
  - no agrega bots;
  - responde con error si no hay alumnos.
- La profesora recibe `raceStart` y luego el estado completo como espectadora: no recibe desafíos ni puede responder.
- `everyoneDone` solo considera a los alumnos, igual que hoy con las personas.

### D3. Estado reducido a 5 Hz
- En clase, `broadcastState` se ejecuta uno de cada 4 ticks (200 ms). La simulación sigue a 50 ms.
- Cada alumno recibe un `state` con su propio corredor y los 5 primeros por posición (a lo sumo 6). La profesora recibe a todos.
- El mensaje `state` ya es una lista de corredores, así que basta con enviar una lista más corta: no cambia el esquema.
- Ancho de banda estimado para 30 alumnos y 3 minutos:
  - alumnos: 30 × 6 × 180 B × 5/s ≈ 160 KB/s;
  - tablero: 30 × 180 B × 5/s ≈ 27 KB/s;
  - total: unos 35 MB por carrera, contra ~580 MB con el envío actual.
- Cliente: `NetworkRaceController` guarda el último estado de cada corredor en un mapa y lo actualiza con lo que llega. Un corredor que deja de llegar conserva su último dato y no se extrapola más allá de él.
- La vista del alumno usa los ids presentes en el último `state` para elegir qué carriles mostrar.

### D4. Fin de carrera y resultados
- El mensaje `results` sigue llevando a todos los corredores: se envía una sola vez, unos 40 × 150 B ≈ 6 KB.
- El alumno ve su resultado y los 10 primeros. La profesora ve a todos.
- El progreso del alumno (perfil, desbloqueos y garaje) se aplica igual que hoy. La profesora no corre, así que su perfil no cambia.

### D5. Quitar y cerrar
- Mensajes nuevos de cliente a servidor:
  - `kick { playerId }`, aceptado solo de la profesora en clase;
  - `closeRoom`, aceptado solo de la profesora.
- `kick`:
  - borra a la persona de la sala, de modo que su token deja de servir para `rejoin`;
  - si corría, la marca como "salió" como en `abandon`;
  - le envía el error `removed` ("La profesora te quitó de la sala") y difunde el nuevo `room`.
- `closeRoom` envía a cada alumno el error `room-closed` ("La profesora cerró la sala") y elimina la sala.
- Si la profesora sale con "Salir de la sala", o pasa el tiempo de gracia de 30 s desconectada sin carrera en curso, la sala se cierra igual, porque una clase sin profesora no puede continuar.
- Cliente: `MultiplayerSession` trata `removed` y `room-closed` como "ya no estás en una sala": borra la sesión guardada, vuelve a "Jugar con amigos" y muestra el mensaje.

### D6. Pantallas de la profesora
`MultiplayerApp` elige pantallas según el rol:
- **Lobby del tablero:**
  - el QR (componente existente, más grande) y el código en tipografía grande;
  - la lista de alumnos en columnas, con nombre, nivel, conexión y un botón "Quitar" con confirmación;
  - "Iniciar carrera" (deshabilitado sin alumnos) y "Cerrar sala".
- **Carrera del tablero:** filas compactas ordenadas por posición, con puesto, nombre, nivel, una barra de avance con el auto del garaje y su pintura, y la marca de llegada. También el tiempo transcurrido. Se usa `NetworkRaceController` como espectador (sin `playerId` corredor).
- **Resultados del tablero:** la tabla completa, "Descargar CSV" y "Nueva carrera" (vuelve al lobby).
- Pensado para 1280 × 720 en adelante (proyector), con letra grande. En celular debe funcionar, aunque no es el objetivo.

### D7. CSV en el navegador
- `toCsv(results)` genera un texto con separador `;` y BOM UTF-8, para que Excel en español lo abra con columnas y acentos correctos.
- Columnas: Puesto; Nombre; Nivel; Tiempo; Aciertos; Errores; Precisión; Correctas por minuto. El tiempo va como `0:42,3` o "sin llegar"; la precisión como `92 %`, y los decimales con coma.
- Se descarga con un `Blob` y un enlace temporal, con el nombre `mind-racer-<CÓDIGO>-<AAAA-MM-DD>-<n>.csv`. No sale del navegador.

### D8. Entrada
- "Jugar con amigos" agrega una tercera tarjeta, "Crear sala de clase" ("Para profesoras: proyecta el código y tus alumnos corren desde su celular").
- El nombre de la profesora es el de su perfil.

## Risks / Trade-offs

- [El plan gratis de Render se duerme] → El primer acceso puede tardar hasta un minuto. El README pide abrir la sala unos minutos antes de la clase; el aviso "Despertando el servidor" ya existe.
- [Una sola instancia: un redespliegue cierra la sala] → No hacer push durante una clase; ya está documentado para las familias.
- [La red escolar bloquea WebSockets o los dominios] → No se puede verificar desde aquí. Se documenta y se sugiere una prueba previa con un celular de la escuela.
- [Todos los alumnos comparten la IP pública de la escuela] → El límite de 5 salas por IP solo afecta a crear salas; la profesora crea una. Unirse no está limitado por IP.
- [Nombres inadecuados] → La profesora puede quitar al alumno. No hay filtro automático de palabras (fuera de alcance).
- [Alumnos que no ven a todos en la pista] → Es a propósito: ven a los 5 primeros y su posición. El tablero muestra a todos.

## Migration Plan

- Sin datos que migrar. Los campos nuevos del protocolo son opcionales: un cliente viejo sigue funcionando en salas familiares.
- Desplegar servidor y web juntos. Un cliente viejo que se une a una sala de clase recibe estados parciales y puede mostrar carriles a 0; se acepta, porque todos cargan la web nueva al abrirla.

## Open Questions

- Ninguna que bloquee. La capacidad (40) y el número de primeros visibles (5) son constantes fáciles de ajustar tras una prueba en clase.
