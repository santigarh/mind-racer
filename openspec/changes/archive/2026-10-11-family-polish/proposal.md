# Proposal

## Why

Mind Racer ya se juega en familia por internet, pero hay fricciones. Para entrar a una sala hay que dictar un código de 4 caracteres; el juego es mudo, así que en el celular cuesta notar un error o un nitro sin mirar la pantalla; y en móvil los nombres largos de la pista se cortan ("Ramanu…"). También quedan pendientes técnicos del despliegue que conviene cerrar ahora: la URL del servidor se rompe si se configura con `https://`, y GitHub Actions avisa que las versiones de sus acciones usan Node 20, que se está retirando.

## What Changes

- **Compartir la sala**: el lobby ofrece un enlace (`…/?sala=K7QF`), un código QR que se escanea con la cámara y un botón para compartir por las apps del celular (o copiar el enlace donde no haya esa opción).
- **Entrar con el enlace**: abrir el enlace lleva directo a esa sala. Si la persona nunca jugó, primero crea su perfil y después entra sola.
- **Sonido y vibración** en carreras locales y en línea: cuenta regresiva, salida, acierto, error, nitro y llegada. Hay una opción para silenciar que se recuerda en el dispositivo. La vibración solo funciona donde el navegador la soporta, normalmente Android.
- **Nombres legibles en móvil**: cada nombre de hasta 20 caracteres se lee completo en la pista, en hasta dos líneas.
- Pendientes técnicos (sin cambio de comportamiento para el jugador):
  - la app acepta `VITE_SERVER_URL` con `http(s)://` y lo convierte a `ws(s)://`;
  - las acciones de GitHub Actions se actualizan a sus versiones actuales.
- Fuera de alcance: desafío diario, logros, garaje, música de fondo, sonidos personalizables por evento y PWA o modo sin conexión (quedan para cambios siguientes del roadmap).

## Capabilities

### New Capabilities
- `game-feedback`: sonido y vibración ante los eventos de la carrera, y la preferencia de silencio del jugador.

### Modified Capabilities
- `multiplayer-rooms`: se agregan compartir la sala (enlace, QR, compartir) y unirse abriendo el enlace.
- `race-screen`: se agrega que los nombres de los corredores se lean completos en pantallas de celular.

## Impact

- `apps/web`: lobby (enlace, QR y compartir), arranque de `App` con `?sala=`, nuevo módulo de audio con Web Audio y vibración, ajuste de estilos de la pista en móvil, interruptor de sonido, `serverUrl` con normalización de esquema.
- Dependencia nueva: una librería pequeña para generar el QR en el navegador (sin servicios externos).
- `.github/workflows/ci.yml`: versiones nuevas de `actions/checkout`, `actions/setup-node` y `pnpm/action-setup`.
- Sin cambios en el motor, el protocolo ni el servidor.
