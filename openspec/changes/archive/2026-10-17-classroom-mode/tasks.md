# Tasks

## 1. Protocolo

- [x] 1.1 Agregar `mode` opcional a `create`, `mode` y `role` opcionales en `room`, los mensajes `kick` y `closeRoom`, y los errores `removed` y `room-closed` (D1, D5); verificar con pruebas de protocolo que los mensajes nuevos validan, que los viejos siguen siendo válidos y que un `kick` sin `playerId` se rechaza

## 2. Servidor

- [x] 2.1 Modo de sala y roles en `Room` (`classCapacity = 40`, profesora fuera del conteo, `hostId` fijo) (D1); verificar con pruebas "La profesora abre la sala", "Alumno 41", "Cuarto jugador" y "Sala de clase" (5.º alumno entra)
- [x] 2.2 Carrera de clase: sin bots, sin la profesora, con al menos un alumno, y la profesora como espectadora con estado completo (D2); verificar con pruebas "Sin bots", "Sala sin alumnos", "Carrera de clase" y que la profesora recibe `raceStart` y `state` pero no desafíos
- [x] 2.3 Estado reducido a 5 Hz en clase: alumno con él y los 5 primeros, profesora con todos; familia sin cambios (D3); verificar con prueba "Ancho de banda de una clase" (30 alumnos: ≤ 6 corredores por mensaje y ≤ 5 mensajes por segundo) y que una sala familiar sigue recibiendo 20 por segundo con todos
- [x] 2.4 `kick`, `closeRoom` y cierre al salir la profesora o pasar su tiempo de gracia (D5); verificar con pruebas "Nombre inadecuado", alumno quitado durante una carrera, `rejoin` rechazado tras quitar, "Se corta el wifi de la profesora" y "Fin de la clase"

## 3. Cliente

- [x] 3.1 `NetworkRaceController` conserva el último estado por corredor, admite espectador sin corredor propio y expone los ids recibidos (D3, D6); verificar con pruebas de estados parciales (un corredor que deja de llegar conserva su distancia y su posición) y de espectador
- [x] 3.2 `MultiplayerSession` crea salas de clase y trata `removed` y `room-closed` volviendo a la entrada con el aviso (D5, D8); verificar con red falsa que el alumno quitado y la sala cerrada vuelven a "Jugar con amigos" con el mensaje y sin sesión guardada
- [x] 3.3 Vista del alumno en clase: pista con su carril y los primeros (3 en celular, 5 en pantallas anchas), "N.º de M" y resultados con él y los 10 primeros (D3, D4); verificar con Testing Library "Alumno a mitad de tabla"

## 4. Tablero de la profesora

- [x] 4.1 "Crear sala de clase" en la entrada y lobby del tablero (QR grande, lista de alumnos, Quitar con confirmación, Iniciar y Cerrar sala) (D6, D8); verificar con Testing Library el lobby, el botón deshabilitado sin alumnos y quitar a un alumno
- [x] 4.2 Carrera y resultados del tablero, con "Nueva carrera" (D6); verificar con Testing Library "Seguir la carrera" (25 alumnos ordenados por posición) y la tabla de resultados completa
- [x] 4.3 `toCsv` y "Descargar CSV" (D7); verificar con pruebas el contenido (BOM, `;`, encabezados, "sin llegar", decimales con coma, comillas para nombres con `;`) y "Llevarse los resultados" (28 filas más encabezado)

## 5. Integración

- [x] 5.1 Verificar que `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod` pasan desde la raíz
- [x] 5.2 Prueba de carga local: un script con 30 alumnos simulados que se unen y responden, midiendo bytes por segundo hacia un alumno y hacia la profesora, y verificar que coincide con la estimación de D3
- [x] 5.3 Prueba en el navegador en local: la profesora crea la sala en una pestaña, dos pestañas de alumnos con orígenes distintos más los alumnos simulados, una carrera completa, resultados, CSV descargado y abierto, quitar a un alumno y cerrar la sala; revisar el tablero a 1280 × 720 y la vista del alumno a 375 × 812, sin errores en consola
- [x] 5.4 Actualizar el README con una sección "Modo clase" (abrir la sala antes de la clase, probar la red de la escuela, no publicar durante la clase)

## Workflow follow-up

- Tras el push, prueba real en una clase o con varios celulares en la nube.
- Archivar el cambio con `/opsx:archive`.
