# Mind Racer

Juego de carreras estilo Nitro Type donde el auto avanza resolviendo desafíos mentales.
Primera variante: **Math Racer** — cada respuesta correcta acelera tu auto.
Se juega solo contra bots o en salas privadas con amigos y familia, cada persona en su propio nivel.

## Estructura

```
packages/engine     Motor de carrera, desafíos, dificultad adaptativa y bots (TypeScript puro)
packages/protocol   Mensajes entre la app y el servidor, con validación compartida
apps/web            App web (Vite + React + TypeScript)
apps/server         Servidor multijugador (Node + WebSockets), salas en memoria
openspec/           Planificación con OpenSpec (specs y cambios)
```

## Requisitos

- Node.js 22+
- pnpm 12+

## Comandos

```bash
pnpm install      # instala dependencias de todo el monorepo
pnpm dev          # levanta la app web (puerto 5173) y el servidor multijugador (puerto 8787)
pnpm dev:web      # solo la app web
pnpm dev:server   # solo el servidor
pnpm test         # corre las pruebas de todos los paquetes
pnpm typecheck    # verifica tipos en todos los paquetes
pnpm build        # compila todo
```

Para un solo paquete: `pnpm --filter @mind-racer/engine test`, `pnpm --filter server test` o `pnpm --filter web dev`.

## Jugar en familia en la red de casa

1. En la computadora que hará de servidor, ejecuta `pnpm dev`. La consola muestra sus direcciones de red,
   por ejemplo `Network: http://192.168.1.12:5173/` (busca la que dice **Wi-Fi** o **Ethernet**).
2. En cada celular, tablet o computadora conectada al **mismo wifi**, abre esa dirección en el navegador.
3. Una persona entra a **Jugar con amigos → Crear sala** y comparte el código de 4 caracteres (por ejemplo `K7QF`).
4. Las demás eligen **Unirse** y escriben el código. Cada quien elige su nivel en la sala y el anfitrión pulsa **Iniciar carrera**.
   Los carriles libres se completan con bots.

La app se conecta sola al servidor de la misma computadora que la sirvió (puerto 8787). Para usar otro servidor,
define `VITE_SERVER_URL`, por ejemplo `VITE_SERVER_URL=ws://192.168.1.50:8787`. El servidor acepta `PORT` y `HOST`.

### Si los celulares no pueden entrar (Windows)

La primera vez, Windows puede bloquear las conexiones entrantes a Node:

- Si aparece el aviso de **Firewall de Windows Defender** al ejecutar `pnpm dev`, permite el acceso en **redes privadas**.
- Si ya lo cerraste, abre *Firewall de Windows Defender → Permitir una aplicación a través del Firewall*, busca
  **Node.js JavaScript Runtime** y marca la casilla **Privada**.
- Verifica que tu red wifi esté configurada como **privada** (Configuración → Red e Internet → propiedades del wifi).
- Las direcciones de adaptadores virtuales (VirtualBox, WSL, VPN) no sirven para los celulares: usa la del wifi.
