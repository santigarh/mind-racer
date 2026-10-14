# Proposal

## Why

El desafío diario creó un motivo para volver cada día, pero lo que se gana jugando (victorias, niveles, racha) solo se ve en números. Un garaje donde el progreso desbloquea vehículos y pinturas convierte esos logros en algo que se luce en la pista. Si la familia ve el auto de cada quien en la sala, también da conversación y ganas de seguir jugando, sobre todo a los niños. Todo sin monedas ni tienda que equilibrar.

## What Changes

- **Garaje** accesible desde el menú: una vista previa de tu vehículo y una cuadrícula de vehículos y pinturas para elegir. Lo bloqueado muestra cómo se gana y cuánto te falta (por ejemplo, "Gana 3 carreras · 1/3").
- **Desbloqueos por progreso**, calculados con lo que el juego ya guarda en el dispositivo: carreras jugadas, victorias, nivel desbloqueado y mejor racha del desafío diario. No hay monedas, tienda ni compras.
- **Catálogo inicial**:
  - 6 vehículos vistos de perfil: clásico, moto, scooter, camión, furgoneta y tractor;
  - 8 pinturas, de las cuales el ámbar actual es la inicial.
- **Tu auto en la pista**: en carreras locales y en línea se dibuja con tu vehículo y tu pintura. Tu carril sigue resaltado como hasta ahora.
- **Visible en las salas**: al crear o unirte a una sala se envía tu auto. El servidor lo valida y lo reenvía, y el lobby, la pista y los resultados muestran el auto de cada persona. Si alguien llega sin auto (por ejemplo, con una versión vieja), se usa el auto inicial.
- **Aviso de desbloqueo**: si una carrera te desbloquea algo, los resultados lo anuncian ("Nuevo en el garaje: Moto").
- Fuera de alcance:
  - cambiar de auto estando dentro de una sala (se elige antes de entrar);
  - impedir que dos personas tengan la misma pintura;
  - arte propio o animaciones de vehículos;
  - monedas, tienda o logros independientes del garaje.

## Capabilities

### New Capabilities
- `garage`: catálogo de vehículos y pinturas, reglas de desbloqueo, elección guardada en el dispositivo, y cómo se ve tu auto en la pista y en los resultados.

### Modified Capabilities
- `multiplayer-rooms`: cada persona entra a la sala con su auto, el servidor lo valida y lo comparte, y el lobby lo muestra.

## Impact

- `packages/protocol`:
  - nuevo esquema `car` con ids cerrados de vehículo y pintura;
  - campo `car` opcional en `create` y `join`;
  - `car` en `RoomPlayer` y en los corredores humanos de `raceStart`.

  Es compatible con clientes y servidores viejos, porque los objetos ignoran campos desconocidos y el campo es opcional.
- `apps/server`: `Room` guarda el auto de cada persona (con el auto inicial si no llega), lo incluye en `room` y `raceStart`, y lo conserva al reconectar.
- `apps/web`:
  - pantalla `Garage` y botón en el menú;
  - catálogo y reglas de desbloqueo;
  - almacenamiento nuevo `mind-racer:garage:v1`, separado del perfil;
  - `RaceViewState` con el auto de cada corredor, y `Track`, `Results` y `Lobby` dibujándolo;
  - aviso de desbloqueo en los resultados.
- Sin cambios en el motor de carrera.
