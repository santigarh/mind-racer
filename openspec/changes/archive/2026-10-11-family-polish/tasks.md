# Tasks

## 1. Pendientes técnicos

- [x] 1.1 Normalizar el esquema en `serverUrl()` (`https`→`wss`, `http`→`ws`, `ws(s)` sin cambios) según D9; verificar con pruebas unitarias de los cuatro casos más el valor por defecto
- [x] 1.2 Actualizar `ci.yml` a `actions/checkout@v7`, `actions/setup-node@v7` y `pnpm/action-setup@v6` tras leer sus notas de versión (D10); verificar que el YAML es válido y, tras el push, que el run pasa sin el aviso de Node 20

## 2. Nombres legibles en móvil

- [x] 2.1 Ajustar `Track` y `Track.module.css` según D8 (columna de 112 px, nombre en hasta 2 líneas, posición y nivel en una línea aparte); verificar que las pruebas de `Track` pasan y, en el navegador a 375 × 812 px con 4 nombres largos y teclado, que cada nombre se lee completo y que la pista, el desafío y el teclado caben sin desplazar la página

## 3. Sonido y vibración

- [x] 3.1 Crear el store de preferencias (`mind-racer:settings:v1`, sonido activado por defecto, tolerante a almacenamiento bloqueado) según D7; verificar con pruebas de valor por defecto, persistencia, datos dañados y notificación a suscriptores
- [x] 3.2 Crear `audio/sfx.ts` (Web Audio sintetizado, `AudioContext` perezoso, reanudación en la primera interacción, errores ignorados) y `audio/haptics.ts` (patrones de D5, sin llamar si no hay soporte); verificar con pruebas usando un `AudioContext` y un `navigator.vibrate` falsos, incluido "Navegador sin vibración"
- [x] 3.3 Implementar `useRaceFeedback` (D6) y usarlo en `RaceScreen`, respetando la preferencia de silencio; verificar con pruebas de "Acierto y error", "Nitro", "Cuenta regresiva y salida", "Llegada" (una sola vez), "Rival con nitro" (sin sonido) y que al montar sobre una carrera en curso no se repiten sonidos
- [x] 3.4 Agregar el interruptor de sonido en el menú, el lobby y la carrera (iconos, `aria-pressed`, etiquetas), sincronizado por el store; verificar con Testing Library "Silenciar en medio de una carrera" y "Preferencia recordada", y documentar en el README la nota sobre el modo silencio del iPhone

## 4. Compartir y entrar con el enlace

- [x] 4.1 Agregar la librería de QR elegida tras verificarla (D2) y un componente `RoomQr` que dibuja el SVG del enlace; verificar con una prueba que el SVG se genera para `…/?sala=K7QF` y decodificándolo una vez en el navegador con la cámara o un lector
- [x] 4.2 Agregar al lobby el enlace en un campo de solo lectura, el QR y el botón "Compartir" con la lógica de D3; verificar con Testing Library "QR para la familia", "Compartir por mensaje" (`navigator.share` falso), "Computadora sin menú de compartir" (portapapeles falso, "Enlace copiado") y el caso sin ninguna de las dos APIs
- [x] 4.3 Leer `?sala=` al iniciar `App`, quitarlo de la barra y unir automáticamente según D1 (protección contra doble `join`, prioridad frente a la sesión guardada); verificar con Testing Library y red falsa "Familiar con perfil", "Primera vez", "Sala que ya no existe" y que se envía un solo `join` con StrictMode

## 5. Integración

- [x] 5.1 Verificar que `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod` pasan desde la raíz
- [x] 5.2 Prueba en el navegador en local: crear sala, abrir el enlace en otra pestaña con otro origen y entrar sola; correr una carrera escuchando los sonidos y silenciando a mitad; revisar la pista en 375 × 812 px; sin errores en consola
- [x] 5.3 Tras el push, prueba en la nube del usuario con dos celulares: escanear el QR del lobby desde el otro celular, entrar a la sala, correr con sonido y vibración (Android) y silenciar

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando la prueba final esté hecha.
- Siguiente en el roadmap familiar: desafío diario (misma semilla para todos según la fecha).
