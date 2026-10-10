# Proposal

## Why

Queremos un juego de carreras estilo Nitro Type donde, en lugar de escribir texto, el auto avanza resolviendo desafíos mentales. La primera variante, **Math Racer**, convierte la práctica de cálculo mental en una competencia: cada respuesta correcta acelera el auto y la dificultad crece con el nivel del jugador. Este primer cambio construye el núcleo jugable (un jugador contra bots locales) y deja el motor listo para reutilizarse en el multijugador en tiempo real y en futuras variantes (lógica, memoria, vocabulario).

## What Changes

- Proyecto nuevo (greenfield): monorepo con un paquete de motor en TypeScript puro y una app web Vite + React + TypeScript.
- Motor de carrera independiente del tipo de desafío: cuenta regresiva, distancia fija, velocidad que sube con cada respuesta correcta y decae con el tiempo, penalización por error, racha (nitro), meta, límite de tiempo y clasificación final.
- Generador de problemas matemáticos por niveles de dificultad (de sumas de una cifra a cálculo mental avanzado), siempre con respuesta entera única.
- Dificultad adaptativa durante la carrera: el problema siguiente sube o baja de nivel según aciertos, rachas y tiempo de respuesta, sin salirse de un rango alrededor del nivel elegido.
- Bots locales (3 rivales) que compiten con el mismo motor y reglas que el jugador, con habilidad calibrada al nivel elegido.
- Pantalla de carrera: pista con los autos, problema actual, entrada numérica con teclado físico y teclado en pantalla, retroalimentación de acierto/error y pantalla de resultados.
- Progreso del jugador guardado localmente: nombre, niveles desbloqueados, mejores marcas por nivel y estadísticas (respuestas correctas por minuto y precisión).
- Fuera de alcance de este cambio: multijugador en tiempo real (siguiente cambio), cuentas de usuario, ranking global, tienda/garaje de autos y variantes distintas a matemáticas.

## Capabilities

### New Capabilities
- `race-engine`: ciclo de vida de una carrera y modelo de movimiento (velocidad, aceleración por acierto, penalización, racha, meta, límite de tiempo, posiciones), independiente del tipo de desafío.
- `math-challenges`: generación y validación de problemas matemáticos por nivel de dificultad.
- `adaptive-difficulty`: ajuste del nivel de cada problema durante la carrera según el desempeño del jugador.
- `race-bots`: rivales simulados que compiten con las mismas reglas que el jugador.
- `player-progress`: perfil local del jugador, desbloqueo de niveles, mejores marcas y estadísticas.
- `race-screen`: experiencia visible de la carrera: pista, entrada de respuestas, retroalimentación y resultados.

### Modified Capabilities
<!-- Ninguna: el proyecto no tiene specs existentes. -->

## Impact

- Código nuevo: `packages/engine` (motor, desafíos, dificultad, bots; sin dependencias de UI) y `apps/web` (Vite + React + TS).
- Dependencias nuevas: pnpm workspaces, Vite, React, TypeScript, Vitest.
- Almacenamiento: `localStorage` del navegador para el perfil del jugador.
- El diseño del motor (determinista, dirigido por eventos) condiciona el siguiente cambio de multijugador, que lo ejecutará en el servidor como fuente de verdad.
