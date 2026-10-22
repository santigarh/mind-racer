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

Juega en línea: la web se publica en Cloudflare (Workers, archivos estáticos) y el servidor multijugador en Render (ver [Publicar en internet](#publicar-en-internet)).

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
pnpm --filter server build:prod   # empaqueta el servidor en apps/server/dist/main.js (lo que corre en Render)
```

Para un solo paquete: `pnpm --filter @mind-racer/engine test`, `pnpm --filter server test` o `pnpm --filter web dev`.

### Probar la app instalable

`pnpm dev` no registra el service worker, a propósito: guardaría código viejo mientras programas. Para probar la
instalación, el modo sin conexión y el aviso de versión nueva, usa el build:

```bash
pnpm --filter web build
pnpm --filter web preview   # http://localhost:4173
```

En Chrome, *DevTools → Application* muestra el manifiesto y el service worker, y *Network → Offline* simula estar
sin internet. Para ver el aviso de versión nueva, cambia un texto, vuelve a hacer `build` y recarga la página.

Los íconos de la app salen de `apps/web/public/icons/icon.svg`. Si cambias ese archivo, regenera los PNG y súbelos al repo:

```bash
pnpm --filter web icons
```

## Jugar en familia en la red de casa

1. En la computadora que hará de servidor, ejecuta `pnpm dev`. La consola muestra sus direcciones de red,
   por ejemplo `Network: http://192.168.1.12:5173/` (busca la que dice **Wi-Fi** o **Ethernet**).
2. En cada celular, tablet o computadora conectada al **mismo wifi**, abre esa dirección en el navegador.
3. Una persona entra a **Jugar con amigos → Crear sala**. La sala muestra un código de 4 caracteres (por ejemplo `K7QF`),
   un código QR y el enlace de la sala.
4. Las demás escanean el QR con la cámara, abren el enlace o eligen **Unirse** y escriben el código. Con el QR o el enlace
   entran directo a la sala. Cada quien elige su nivel en la sala y el anfitrión pulsa **Iniciar carrera**.
   Los carriles libres se completan con bots.

El botón **Compartir** abre el menú de compartir del celular, o copia el enlace en la computadora. Por `http://` en la red
de casa los navegadores no permiten ninguna de las dos cosas: copia el enlace del campo o usa el QR.

Por `http://` tampoco se puede instalar la app ni usarla sin internet (ver [Instalar como app](#instalar-como-app)):
en la red de casa el juego funciona igual, pero necesita la computadora encendida.

La app se conecta sola al servidor de la misma computadora que la sirvió (puerto 8787). Para usar otro servidor,
define `VITE_SERVER_URL`, por ejemplo `VITE_SERVER_URL=ws://192.168.1.50:8787`.

### Si los celulares no pueden entrar (Windows)

La primera vez, Windows puede bloquear las conexiones entrantes a Node:

- Si aparece el aviso de **Firewall de Windows Defender** al ejecutar `pnpm dev`, permite el acceso en **redes privadas**.
- Si ya lo cerraste, abre *Firewall de Windows Defender → Permitir una aplicación a través del Firewall*, busca
  **Node.js JavaScript Runtime** y marca la casilla **Privada**.
- Verifica que tu red wifi esté configurada como **privada** (Configuración → Red e Internet → propiedades del wifi).
- Las direcciones de adaptadores virtuales (VirtualBox, WSL, VPN) no sirven para los celulares: usa la del wifi.

### Sonido y vibración

La carrera suena con la cuenta regresiva, cada acierto o error, el nitro y la llegada; en celulares Android además vibra.
El botón del altavoz (en el menú, la sala y la carrera) silencia todo y el juego lo recuerda en ese dispositivo.

- **iPhone y iPad:** si el interruptor lateral de silencio está activado, el sistema puede apagar los sonidos del
  navegador; súbele el volumen o desactiva el modo silencio. Safari no permite vibrar, así que ahí no hay vibración.
- El sonido empieza con el primer toque o tecla: los navegadores no dejan reproducir audio antes.

### Desafío de hoy

Cada día el menú ofrece un desafío: una carrera contra bots que es **la misma para todos los que la corren ese día en el
mismo nivel**, en cualquier celular. Se juega una vez por día y cuenta como una carrera normal para estadísticas y desbloqueos.

- El desafío cambia a la medianoche según la hora de cada dispositivo.
- Para comparar entre ustedes, corran el mismo nivel: los adultos pueden elegir el nivel de los niños en la tarjeta.
- La **racha** suma un día cada vez que terminas el desafío, sin importar el puesto. Si un día no juegas, vuelve a empezar.
- Si sales a mitad de la carrera, no cuenta y puedes intentarlo de nuevo ese día.
- **Compartir resultado** envía algo como `Mind Racer · Desafío del 11 oct · Nivel 3 · 🏁 1.º · 0:42,3 · 18/20 · 🔥 Racha de 5 días`
  al grupo de la familia. Todo se guarda solo en el dispositivo; no hay tabla en el servidor.

### Garaje

En el **Garaje** (botón en el menú) eliges tu vehículo y tu pintura. Se desbloquean jugando, sin monedas ni compras:

| Vehículo | Se gana con | Pintura | Se gana con |
|---|---|---|---|
| Clásico | desde el inicio | Ámbar | desde el inicio |
| Moto | 3 carreras | Rojo | 1 carrera |
| Scooter | 1 victoria | Morado | desbloquear el nivel 3 |
| Camión | desbloquear el nivel 4 | Verde | hacer un desafío diario |
| Furgoneta | racha de 3 días | Azul | 5 carreras |
| Tractor | 10 victorias | Cian | 5 victorias |
| | | Blanco | 25 carreras |
| | | Dorado | racha de 7 días |

Tu auto corre en la pista y, en las salas, todos ven el de cada quien en el lobby, la pista y los resultados.
Se elige antes de entrar a una sala. Los resultados avisan cuando una carrera te desbloquea algo nuevo.

## Instalar como app

Mind Racer se puede instalar en la pantalla de inicio y abre a pantalla completa, como una app:

- **Android (Chrome) y computadoras (Chrome o Edge):** botón **Instalar app** en el menú, o el ícono de instalar de la
  barra de direcciones.
- **iPhone y iPad (Safari):** *Compartir → Agregar a inicio*.

Después de abrirlo una vez con internet, **funciona sin conexión**: carreras contra bots, práctica de tablas, desafío
diario y garaje. **Jugar con amigos** y el **modo clase** necesitan internet; sin conexión la app lo avisa y entra sola a
la sala cuando vuelve.

Cuando se publica una versión nueva, la app no se recarga sola: el menú muestra **Hay una versión nueva** con el botón
**Actualizar**. Si nadie lo pulsa, la versión nueva se usa la próxima vez que se abra el juego. Nunca interrumpe una
carrera ni una clase. El progreso, el garaje y la racha se conservan.

## Modo clase

Para usar Mind Racer con un grupo de hasta 40 alumnos, en vivo:

1. La profesora, desde una computadora conectada al proyector, entra a **Jugar con amigos → Crear sala de clase**.
   El tablero muestra el código y el QR en grande; ella no corre.
2. Los alumnos escanean el QR con su celular (o entran a **Unirse** con el código) y eligen su nivel en la sala.
3. **Iniciar carrera** hace correr a todos los alumnos conectados, sin bots. El tablero muestra el avance de todos;
   cada alumno ve su carril, los 5 primeros y su posición.
4. Al terminar: clasificación completa, **Descargar CSV** (se genera en el navegador, se abre en Excel) y
   **Nueva carrera**. **Cerrar sala** termina la clase para todos.

La profesora puede **quitar** a un alumno (por ejemplo, por un nombre inadecuado); no puede volver con esa sesión.
No hay cuentas ni se guarda nada en el servidor: todo se borra al cerrar la sala.

Antes de la clase:

- **Abre la sala unos minutos antes.** El servidor gratis se duerme y el primer acceso puede tardar hasta un minuto.
- **Prueba la red de la escuela** con un celular conectado a su wifi: algunas redes bloquean WebSockets o los dominios
  `workers.dev` / `onrender.com`. Si no conecta, usa datos móviles o la red local (sección de arriba).
- **No publiques cambios durante una clase:** el servidor se reinicia y cierra la sala.

## Publicar en internet

La web va en **Cloudflare Workers** como sitio estático (gratis, siempre disponible) y el servidor multijugador en **Render** (plan gratis).
Ambos se actualizan solos con cada push a `main`. Render espera a que pasen las pruebas de GitHub Actions.

```
jugador --https--> Cloudflare Worker (menú y modo solo: siempre al instante)
   |
   +-----wss-----> Render (solo "Jugar con amigos")
```

### Qué esperar del plan gratis de Render

- Se duerme tras **15 minutos** sin conexiones ni mensajes. Mientras alguien juega, los mensajes lo mantienen despierto.
- Despertarlo tarda **alrededor de un minuto**. La app muestra "Despertando el servidor, puede tardar hasta un minuto" y entra sola a la sala.
- Las salas viven en memoria: un despliegue o un reinicio las cierra. Evita hacer push durante una partida.

### Variables del servidor

| Variable | Para qué | Valor en Render |
|---|---|---|
| `PORT` | Puerto de HTTP y WebSocket | Lo define Render |
| `HOST` | Interfaz donde escucha | `0.0.0.0` (por defecto) |
| `ALLOWED_ORIGINS` | Sitios que pueden conectarse, separados por comas | La URL de la web, p. ej. `https://mind-racer.<subdominio>.workers.dev` |
| `TRUST_PROXY_HOPS` | Proxies delante del servidor (para el límite de salas por IP) | `1` |

Sin `ALLOWED_ORIGINS` el servidor acepta cualquier origen, como en la red local. `GET /health` responde `{"status":"ok","rooms":n}`.

### Pasos (una sola vez)

1. **GitHub:** el código debe estar en un repositorio (por ejemplo `santigarh/mind-racer`).
2. **Render, el servidor:**
   1. Crea una cuenta en [render.com](https://render.com) e inicia sesión con GitHub.
   2. *New → Blueprint* y elige el repositorio. Render lee `render.yaml`: servicio `mind-racer-server`, plan gratis, región `virginia`.
      Si prefieres otra región (`oregon`, `ohio`, `frankfurt`, `singapore`), cámbiala en `render.yaml` **antes** de este paso, porque después no se puede cambiar.
   3. Cuando pida `ALLOWED_ORIGINS`, escribe cualquier valor provisional (se ajusta en el paso 4 con la URL real de la web).
   4. Al terminar, abre `https://<nombre-del-servicio>.onrender.com/health`; debe responder `{"status":"ok",...}`.
3. **Cloudflare, la web:**
   1. Crea una cuenta en [dash.cloudflare.com](https://dash.cloudflare.com).
   2. *Workers & Pages → Create → Import a repository* y elige el repositorio. Nombre del Worker: **`mind-racer`**
      (debe coincidir con `name` en `apps/web/wrangler.jsonc`).
   3. En la configuración del build (o después en el Worker → *Settings → Build*):
      - Root directory: `apps/web`
      - Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm build`
      - Deploy command: `npx wrangler deploy` (el que viene por defecto)
      - Variables **de build**: `NODE_VERSION` = `22` y `VITE_SERVER_URL` = `wss://<nombre-del-servicio>.onrender.com`
   4. Al terminar, Cloudflare te da la URL definitiva, por ejemplo `https://mind-racer.<subdominio>.workers.dev`.

   `apps/web/wrangler.jsonc` le dice a Cloudflare que publique `apps/web/dist` como sitio de una sola página. Sin ese archivo,
   Cloudflare intenta detectar la app sola y falla en este monorepo (por ejemplo con `Unsupported URL Type "workspace:"`).
   `apps/web/public/_headers` fija la caché: `index.html`, `sw.js` y el manifiesto se revalidan siempre, para que los
   dispositivos encuentren cada versión nueva; los archivos de `assets/` llevan un hash en el nombre y se guardan un año.
4. **Ajustar el origen:** en Render, *Environment*, pon en `ALLOWED_ORIGINS` la URL exacta de la web (sin `/` al final) y guarda; Render se redespliega solo.
5. **Probar:** abre la URL de la web desde el celular **con datos móviles**, crea una sala y únete desde otro dispositivo con el código.

### Si una versión publicada falla en los dispositivos

La app instalada guarda la versión que descargó. Revertir el commit publica una versión nueva que llega con el aviso
**Actualizar**, como cualquier otra. Para **quitar** la app instalable por completo no alcanza con borrar el plugin: hay que
publicar un build con `selfDestroying: true` en la configuración de `VitePWA` (`apps/web/vite.config.ts`), que borra el
service worker y su caché en cada dispositivo, y mantenerlo publicado unas semanas antes de quitar el plugin.

### Si el build falla por pnpm

Ambas plataformas instalan pnpm con `corepack enable` según `packageManager` en `package.json`. Si alguna no reconoce esa versión,
cambia en su build command `corepack enable` por `npm i -g pnpm@12.10.1`.

## Licencia

[MIT](LICENSE)
