# Tasks

## 1. Estructura del monorepo

- [x] 1.1 Crear `package.json` raíz, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore` y `.editorconfig`; verificar que `pnpm install` termina sin errores
- [x] 1.2 Crear `packages/engine` (`@mind-racer/engine`) con TypeScript estricto y Vitest; verificar que `pnpm --filter @mind-racer/engine test` ejecuta una prueba de humo
- [x] 1.3 Crear `apps/web` con Vite + React + TS que importa `@mind-racer/engine`; verificar que `pnpm --filter web dev` levanta y `pnpm -r build` compila ambos paquetes
- [x] 1.4 Agregar scripts raíz `dev`, `build`, `test`, `typecheck` y un README con cómo correrlos; verificar que cada script funciona tal como está documentado

## 2. Base del motor: PRNG y configuración

- [x] 2.1 Implementar `mulberry32` y derivación de subflujos `(semilla, corredor, propósito)` (D6); verificar con pruebas que misma semilla ⇒ misma secuencia y que subflujos distintos no se correlacionan trivialmente
- [x] 2.2 Definir `RaceConfig` con las constantes de D3 (distancia, vMax, k, c, penalización, nitro, límite, tick) y los tipos `Challenge`, `ChallengeSource`, `RunnerState`, `RaceSnapshot`; verificar con `pnpm typecheck`

## 3. Desafíos matemáticos (spec math-challenges)

- [x] 3.1 Implementar plantillas de los niveles 1–5 según D5 con respuesta entera única y no negativa; verificar con pruebas que recorren miles de problemas por nivel (operaciones permitidas, divisiones exactas, resultados ≥ 0)
- [x] 3.2 Implementar plantillas de los niveles 6–10 (negativos, precedencia, paréntesis, cuadrados, raíces, porcentajes); verificar con pruebas que evalúan cada `prompt` y lo comparan con `answer`
- [x] 3.3 Implementar `MathChallengeSource.next` con anti-repetición de las últimas 10 claves y la normalización/validación de respuestas (espacios, ceros a la izquierda, signo menos, entradas no numéricas); verificar con las pruebas de los escenarios de la spec

## 4. Motor de carrera (spec race-engine)

- [x] 4.1 Implementar fases `waiting → countdown → racing → finished` con reloj inyectado y `advanceTo`; verificar con pruebas que las respuestas en cuenta regresiva se ignoran
- [x] 4.2 Implementar el modelo de velocidad de D3 (impulso por nivel y rapidez, tope, decaimiento, penalización por error); verificar con pruebas de cada escenario de aceleración, tope, desaceleración y error
- [x] 4.3 Implementar racha y nitro; verificar con pruebas que el 5.º acierto seguido activa nitro, supera vMax temporalmente y la racha se reinicia
- [x] 4.4 Implementar meta, límite de 180 s, clasificación y estadísticas por corredor (aciertos, errores, precisión, correctas por minuto); verificar con pruebas de llegada, tiempo agotado y orden de clasificación
- [x] 4.5 Verificar determinismo e independencia de variante: prueba que reproduce una carrera con misma semilla y eventos, y prueba con una `ChallengeSource` falsa no matemática

## 5. Dificultad adaptativa (spec adaptive-difficulty)

- [x] 5.1 Implementar `DifficultyController` por corredor (nivel inicial, subida tras 3 aciertos rápidos, bajada tras 2 errores en 4, reinicio de ventana, rango −1/+2 y 1–10) e integrarlo en el motor; verificar con pruebas de cada escenario de la spec
- [x] 5.2 Registrar el nivel máximo alcanzado en la clasificación; verificar con prueba

## 6. Bots (spec race-bots)

- [x] 6.1 Implementar `BotAgent` con perfiles Tortuga/Crucero/Turbo (D8), tiempos lognormales escalados por `T(nivel)` y respuestas erróneas plausibles; verificar con pruebas que un bot nunca envía antes de `racing` y que sus errores reciben la misma penalización
- [x] 6.2 Prueba de simulación: miles de carreras solo con bots por nivel; verificar que Turbo < Crucero < Tortuga en tiempo medio, que la duración media de Crucero cae en ~60–80 s en todos los niveles y que la misma semilla da la misma clasificación; ajustar `RaceConfig`/tiempos objetivo si no se cumple

## 7. Progreso del jugador (spec player-progress)

- [x] 7.1 Implementar funciones puras de perfil: crear perfil (nombre 1–20 caracteres, punto de partida 1/4/7), aplicar resultado (desbloqueo con 1.º/2.º y ≥ 80 %, récords por nivel, carreras y victorias); verificar con pruebas de cada escenario
- [x] 7.2 Implementar adaptador `localStorage` (`mind-racer:profile:v1`) con validación y recuperación ante datos dañados; verificar con pruebas usando almacenamiento simulado y datos corruptos

## 8. Pantallas de la app web (spec race-screen)

- [x] 8.1 Implementar `RaceController` (bucle rAF, `advanceTo`, bots, instantáneas con `useSyncExternalStore`, pausa por `visibilitychange` con nueva cuenta regresiva); verificar con pruebas de componente usando reloj falso
- [x] 8.2 Implementar pantalla de primer ingreso y menú (selección de nivel con bloqueados, récords por nivel); verificar con Testing Library que los niveles bloqueados no se pueden elegir
- [x] 8.3 Implementar la pista (carriles, autos con `translateX`, nombres, carril del jugador destacado, meta) y la cuenta regresiva visible; verificar visualmente en `pnpm dev` y con prueba de que el avance es proporcional a la distancia
- [x] 8.4 Implementar desafío grande, input con envío automático por longitud y con Enter, foco automático y retroalimentación de acierto/error con respuesta correcta; verificar con Testing Library los escenarios de envío automático y Enter
- [x] 8.5 Implementar teclado en pantalla (dígitos, menos, borrar, enviar) para `pointer: coarse`; verificar con Testing Library y en vista móvil del navegador
- [x] 8.6 Implementar indicadores en vivo (posición, velocidad, racha, tiempo, nivel) y efecto de nitro; verificar en `pnpm dev`
- [x] 8.7 Implementar estado de jugador terminado, pantalla de resultados (clasificación, estadísticas, récords, desbloqueos, correr de nuevo / menú) y abandono con Escape + confirmación; verificar con Testing Library que abandonar no modifica el perfil y que correr de nuevo usa otra semilla

## 9. Integración

- [x] 9.1 Recorrido completo en navegador: primer ingreso → menú → carrera contra 3 bots → resultados → desbloqueo → correr de nuevo, en escritorio y en vista móvil; verificar sin errores en consola
- [x] 9.2 Verificar que `pnpm test`, `pnpm typecheck` y `pnpm build` pasan desde la raíz

## Workflow follow-up

- Archivar el cambio con `/opsx:archive` cuando la revisión esté completa.
- Proponer el siguiente cambio: multijugador en tiempo real (`apps/server` con el motor como autoridad, salas, WebSockets).
