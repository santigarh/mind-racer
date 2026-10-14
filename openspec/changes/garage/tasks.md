# Tasks

## 1. Catálogo y protocolo

- [x] 1.1 Crear `packages/protocol/src/garage.ts` con `CAR_BODIES`, `CAR_PAINTS`, `carSchema` y `DEFAULT_CAR`, y agregar `car` a `create`/`join` (opcional, inválido → ausente), `RoomPlayer` y `RaceRunner` (D1, D4); verificar con pruebas de protocolo: auto válido, auto ausente, auto inválido que no rechaza el mensaje, y que un mensaje sin `car` sigue siendo válido

## 2. Servidor

- [x] 2.1 Guardar el auto en `Player` (con `DEFAULT_CAR` si no llega), conservarlo al reconectar e incluirlo en `room` y en los corredores humanos de `raceStart` (D4); verificar con pruebas de `Room`/`RoomManager` de "La familia ve los autos", "Versión vieja del juego", "Auto inválido", "Reconexión" y "Mismo auto"

## 3. Garaje en la web

- [x] 3.1 Crear `garage/catalog.ts` (nombres, íconos y variables `--paint-*`) y `garage/unlocks.ts` con `progressOf`, `isUnlocked`, `requirementText` y `newlyUnlocked` (D1, D2); verificar con pruebas de cada condición de las tablas, "Primer día", "Desbloqueo por victorias", "Primera carrera", "Racha perdida", "Victorias en distintos niveles" y los textos de avance
- [x] 3.2 Crear el store de la elección (`mind-racer:garage:v1`) con `effectiveCar` (D3); verificar con pruebas de "Volver a abrir el juego", "Elección inválida", elección bloqueada, datos dañados y almacenamiento bloqueado
- [x] 3.3 Pantalla `Garage` con vista previa, vehículos y pinturas, condiciones bloqueadas y botón en el menú (D6); verificar con Testing Library "Elegir pintura", "Ver cuánto falta" y que los bloqueados no se pueden elegir

## 4. El auto en carrera

- [x] 4.1 Agregar `cars` a `RaceViewState` (local: el jugador; en línea: desde `raceStart`) y dibujar vehículo y pintura en `Track` y `Results`, con los bots como hoy (D5); verificar con pruebas "Carrera local" y una carrera en línea con dos personas, y revisar en el navegador que los 6 vehículos miran hacia la meta (voltear los que no)
- [x] 4.2 Enviar el auto efectivo en `create`/`join` desde `MultiplayerSession` y mostrar el auto de cada persona en el `Lobby` (D4, D5); verificar con Testing Library y red falsa que el `join` lleva el auto y que el lobby muestra los autos recibidos
- [x] 4.3 Aviso "Nuevo en el garaje" en los resultados de carreras locales, del desafío diario y en línea (D7); verificar con Testing Library "Primera victoria"

## 5. Integración

- [x] 5.1 Verificar que `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod` pasan desde la raíz
- [x] 5.2 Prueba en el navegador en local: abrir el garaje, desbloquear algo ganando una carrera, elegir vehículo y pintura, verlos en la pista local y en una sala con dos pestañas de orígenes distintos (lobby, pista y resultados); revisar el garaje a 375 × 812 px y que no haya errores en consola
- [x] 5.3 Actualizar el README (sección de juego en familia) con el garaje

## Workflow follow-up

- Tras el push, prueba en la nube con dos celulares: cada uno elige su auto y entran a la misma sala.
- Archivar el cambio con `/opsx:archive`.
