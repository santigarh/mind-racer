# Mind Racer

Juego de carreras estilo Nitro Type donde el auto avanza resolviendo desafíos mentales.
Primera variante: **Math Racer** — cada respuesta correcta acelera tu auto.

## Estructura

```
packages/engine   Motor de carrera, desafíos, dificultad adaptativa y bots (TypeScript puro)
apps/web          App web (Vite + React + TypeScript)
openspec/         Planificación con OpenSpec (specs y cambios)
```

## Requisitos

- Node.js 22+
- pnpm 12+

## Comandos

```bash
pnpm install     # instala dependencias de todo el monorepo
pnpm dev         # levanta la app web en modo desarrollo (http://localhost:5173)
pnpm test        # corre las pruebas de todos los paquetes
pnpm typecheck   # verifica tipos en todos los paquetes
pnpm build       # compila el motor y la app web
```

Para un solo paquete: `pnpm --filter @mind-racer/engine test` o `pnpm --filter web dev`.
