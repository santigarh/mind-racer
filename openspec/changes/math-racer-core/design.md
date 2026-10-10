# Design

## Context

Proyecto nuevo: la carpeta solo contiene la configuración de OpenSpec. Ver proposal.md (Why) para la motivación y las specs de este cambio para los requisitos.

Restricciones que moldean el diseño:
- El siguiente cambio agrega multijugador en tiempo real con el servidor como fuente de verdad, así que el motor debe poder ejecutarse en Node sin navegador ni React.
- Deben caber variantes futuras (lógica, memoria, vocabulario) sin tocar el motor.
- Público de todas las edades: desde celulares táctiles hasta teclado físico.

## Goals / Non-Goals

**Goals:**
- Motor de carrera determinista, puro y testeable de forma aislada, compartible con un futuro servidor.
- Balance tal que un jugador que responde al ritmo objetivo de su nivel tarde aproximadamente lo mismo en cualquier nivel (~60–75 s).
- App web jugable de punta a punta (primer ingreso → menú → carrera → resultados) sin backend.

**Non-Goals:**
- Red, salas, sincronización o anti-trampas (cambio de multijugador).
- Arte final, sonido, garaje de autos personalizables.
- Pruebas end-to-end en navegador real (se evaluarán más adelante; aquí bastan pruebas de componentes).

## Decisions

### D1. Monorepo con pnpm workspaces
```
mind-racer/
├─ package.json            # scripts raíz: dev, build, test, lint
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ packages/engine/        # TS puro: rng, race, challenges/math, difficulty, bots
└─ apps/web/               # Vite + React + TS
```
`apps/server` se agregará en el cambio de multijugador importando `@mind-racer/engine`.
- *Alternativa:* una sola app con `src/core/`. Más simple hoy, pero obliga a mover código y reconfigurar el build cuando llegue el servidor. pnpm ya está instalado en la máquina, así que el costo inicial es bajo.

### D2. Simulación de paso fijo dirigida por eventos
El motor avanza en ticks fijos de 10 ms. Las entradas son eventos con marca de tiempo (`submitAnswer(runnerId, input, atMs)`) que se aplican en el tick correspondiente. El reloj se inyecta (`advanceTo(nowMs)`); el motor nunca lee `Date.now()` ni `Math.random()`.
- Da determinismo (spec `race-engine` › Determinismo), resolución de llegada de 10 ms y el mismo código sirve para cliente, servidor y repeticiones.
- *Alternativa:* integrar física en el `requestAnimationFrame` de React. Depende del framerate, no es reproducible ni portable al servidor.
- *Alternativa:* integración analítica por tramos (decaimiento exponencial exacto). Más precisa pero complica el nitro y el cálculo del cruce de meta; el paso fijo es suficiente.

### D3. Modelo de velocidad
Por tick de duración `dt`:
- Decaimiento: `v ← v · e^(−k·dt)` con vida media de 4 s (`k = ln2 / 4`).
- Acierto: `v ← min(vMax, v + B)` con `B = c · T(nivel) · q`, donde `T(nivel)` es el tiempo objetivo del nivel, `q = clamp(T / tRespuesta, 0,5, 1,5)` y `c ≈ 3,12`.
- Error: `v ← v · 0,5`, racha = 0 y se corta el nitro activo.
- Nitro (cada 5 aciertos seguidos): `+0,5·vMax` adicional durante 2 s, que puede superar `vMax`.
- Distancia 1000 m, `vMax = 40 m/s`, límite de carrera 180 s.

Por qué `B ∝ T(nivel)`: respondiendo cada `T` segundos, la velocidad media en régimen es `B / (k·T) = c / k ≈ 18 m/s`, independiente del nivel → ~60 s por carrera para quien responde justo al ritmo objetivo. Responder más rápido da más impulsos y mayor `q`. Así un nivel difícil no castiga ni premia por sí mismo; premia el desempeño relativo. Las constantes viven en un objeto `RaceConfig` y se ajustan con pruebas de simulación (tareas).

*Ajuste tras la simulación (tarea 6.2):* con la propuesta inicial (vida media 2,5 s, `vMax` 30, `c` 4,16) el tope de velocidad recortaba los impulsos grandes de los niveles altos y Crucero tardaba 81–104 s. Con vida media 4 s, `vMax` 40 y `c` 3,12, Crucero queda en 70–78 s en todos los niveles y la curva de velocidad es más suave entre respuestas.
- *Alternativa:* modelo Nitro Type puro (distancia = respuestas/N). Simple, pero no da la sensación de “acelerar” y frenar que se pidió.

### D4. Interfaz de fuente de desafíos
```ts
interface ChallengeSource {
  next(level: number, rng: Rng, recent: ChallengeKey[]): Challenge;
  check(challenge: Challenge, input: string): boolean;
}
interface Challenge {
  key: ChallengeKey;      // identidad para evitar repeticiones
  level: number;
  prompt: string;         // "7 × 8"
  answer: string;         // canónica: "56", "-12"
  targetTimeMs: number;
}
```
La fuente valida la respuesta con `check` (cada variante sabe normalizar su propio tipo de entrada); la vista solo recibe `prompt`, `level` y `answer.length` (para el envío automático). La variante matemática es la primera implementación; otras variantes implementan la misma interfaz (spec `race-engine` › Independencia).

### D5. Catálogo de niveles matemáticos

| Nivel | Contenido | T objetivo |
|---|---|---|
| 1 | Sumas a + b, 1 cifra | 2,5 s |
| 2 | Sumas y restas 1 cifra (resultado ≥ 0) | 2,5 s |
| 3 | Sumas y restas hasta 2 cifras sin llevar/prestar | 3,5 s |
| 4 | Tablas de multiplicar 2–10 | 3,0 s |
| 5 | Divisiones exactas de las tablas; sumas/restas 2 cifras con llevada | 3,5 s |
| 6 | Las 4 operaciones con 2 cifras; 2 cifras × 1 cifra | 4,5 s |
| 7 | Resultados negativos; 3 cifras ± 2 cifras; cuadrados 1–15 | 5,5 s |
| 8 | Dos operaciones con precedencia (`3 + 4 × 5`), paréntesis | 6,5 s |
| 9 | 2 cifras × 2 cifras; raíces exactas; porcentajes simples (10 %, 25 %, 50 % de múltiplos) | 7,0 s |
| 10 | Mezcla de 7–9 con operandos mayores y tres operaciones | 8,0 s |

Cada nivel es una lista ponderada de plantillas (`generator(rng) → {prompt, answer, key}`); agregar o reajustar plantillas no cambia el motor. Reintenta hasta 20 veces si la clave está en las últimas 10 entregadas.

### D6. PRNG con semilla y subflujos
`mulberry32` con semilla de carrera. Cada corredor obtiene subflujos independientes derivados de `(semilla, idCorredor, propósito)` para desafíos y para decisiones del bot. Se usa el id y no el carril para que agregar o quitar un corredor no cambie los desafíos de los demás. Así, que el jugador esté presente o responda más rápido o más lento no altera la secuencia de los bots (reproducibilidad en spec `race-bots`).

### D7. Dificultad adaptativa dentro del motor
Un controlador por corredor (`DifficultyController`) vive en el motor y decide el nivel de cada `next()`, con las reglas de la spec `adaptive-difficulty`. Al estar en el motor, bots y futuros rivales remotos se adaptan igual que el jugador y el servidor podrá aplicarlo sin confiar en el cliente.

### D8. Bots como agentes externos al motor
Un `BotAgent` observa el desafío actual de su corredor y programa un `submitAnswer` futuro:
- tiempo = `T(nivel) · factorPerfil · lognormal(σ = 0,25)`
- acierto con probabilidad `pPerfil`; si falla, envía una respuesta plausible (±1..±10 de la correcta).

| Perfil | factor | p acierto |
|---|---|---|
| Tortuga (lento) | 1,35 | 0,85 |
| Crucero (parejo) | 1,05 | 0,90 |
| Turbo (rápido) | 0,80 | 0,95 |

Nombres de bots tomados de una lista fija. *Alternativa:* bots que mueven su auto con una curva de velocidad predefinida: más simple, pero no respetaría las reglas del motor ni la dificultad adaptativa.

### D9. Integración con React
- Un `RaceController` (TS, en `apps/web`) crea el motor y los bots, corre un bucle `requestAnimationFrame` que llama `advanceTo(performance.now() − inicio)` y publica una instantánea inmutable.
- Los componentes la leen con `useSyncExternalStore`; los autos se posicionan con `transform: translateX(...)` (DOM + CSS, sin canvas: son 4 carriles y es más accesible y fácil de estilizar).
- Navegación sin router: máquina de estados de pantallas `onboarding → menu → race → results`.
- Estilos con CSS Modules y variables CSS; sin librería de UI.
- Teclado en pantalla visible cuando `matchMedia('(pointer: coarse)')`; el `<input>` usa `inputMode="none"` en ese caso para que no aparezca el teclado del sistema.

### D10. Persistencia
`localStorage` con clave `mind-racer:profile:v1` y un campo `version`. Lectura con validación manual (type guard) y, si falla, perfil nuevo (spec `player-progress` › Datos dañados). Toda la lógica de desbloqueo y récords está en funciones puras testeables; el almacenamiento es un adaptador fino.

### D11. Pruebas
- Vitest en `packages/engine`: unitarias por módulo + pruebas de simulación (miles de carreras con bots) para validar balance y determinismo.
- Vitest + Testing Library en `apps/web` para flujos de UI (envío automático, Enter, teclado en pantalla, resultados).

## Risks / Trade-offs

- [Balance incorrecto de constantes o tiempos objetivo] → constantes centralizadas en `RaceConfig`/catálogo y pruebas de simulación que fijan rangos aceptables de duración de carrera.
- [Exponer `answer.length` permite inferir algo de la respuesta] → aceptable para un juego local; en multijugador el servidor seguirá validando.
- [Diferencias de punto flotante entre motores JS al reproducir carreras] → el determinismo se garantiza dentro del mismo entorno; en multijugador el servidor es autoridad y el cliente solo predice.
- [El foco del input se pierde en móviles o al hacer clic fuera] → el teclado en pantalla no depende del foco y el input recupera el foco en cada nuevo desafío.
- [Niños pequeños con dificultad para leer la UI] → problemas en tipografía grande, iconografía clara y textos cortos; revisión manual en celular.
- [Saltos de framerate (pestaña en segundo plano)] → `advanceTo` procesa todos los ticks pendientes con un tope; si la pestaña se oculta, la carrera local se pausa.

## Migration Plan

No aplica: proyecto nuevo, sin datos ni usuarios existentes.

## Open Questions

- Estilo visual de autos y pista (ilustración vs. formas simples): se puede decidir durante la implementación sin cambiar specs.
- Efectos de sonido: se dejan fuera de este cambio; pueden agregarse después.
