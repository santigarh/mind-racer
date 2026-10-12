# Design

## Context

Ver proposal.md (Why) y las specs de este cambio. Estado actual relevante (revisado en el código):

- **Problemas:** `Race` crea un `DifficultyController(nivel)` por corredor, con rango −1/+2. Los problemas salen de `deriveRng(seed, 0, "challenges:<id>")` con el nivel *actual* del corredor. Por eso, con la misma semilla, dos jugadores que responden distinto reciben problemas distintos en cuanto su nivel cambia.
- **Mismo id y bots deterministas:** en una carrera local, el jugador siempre tiene `PLAYER_ID` y los bots son los mismos perfiles con semillas derivadas de la carrera. Con la semilla, el nivel y la adaptación fijos, la carrera es idéntica en cualquier dispositivo.
- **Semilla:** `hashSeed(...partes)` (FNV-1a) ya existe y es estable entre motores de JavaScript. `LocalRaceController` acepta `config?: Partial<RaceConfig>`.
- **Perfil:** el perfil (`mind-racer:profile:v1`) tiene validación estricta; agregarle campos obliga a migrarlo. Las preferencias ya usan una clave aparte (`mind-racer:settings:v1`).
- **Compartir:** `ShareRoom` ya implementa la cadena `navigator.share` → portapapeles → campo visible, pero metida dentro del componente.
- **Pantallas:**
  - `Menu` muestra la lista de niveles y un panel de detalle.
  - `Results` recibe `onPlayAgain` y `onMenu`, y tiene una variante `online`.
  - `RaceScreen` titula "Carrera · nivel N".

## Goals / Non-Goals

**Goals:**
- Un desafío por día y por nivel, idéntico para todos, sin servidor.
- Que volver cada día tenga recompensa visible (la racha) y que compartir sea un toque.
- Cambiar lo mínimo en el motor y no tocar el perfil.

**Non-Goals:**
- Tabla de posiciones compartida, verificación de resultados o protección contra trampas (es un juego familiar).
- Desafío en salas multijugador, recordatorios o notificaciones, y desafíos atrasados.

## Decisions

### D1. Semilla y fecha
- La fecha del día es `dateKey = YYYY-MM-DD` con la hora **local** del dispositivo (`getFullYear`, `getMonth`, `getDate`), no UTC: el desafío cambia a la medianoche de la casa.
- La semilla es `hashSeed('daily', dateKey, level)`, con un prefijo propio para no coincidir nunca con otras semillas.
- *Alternativa:* fecha UTC. Es igual para todo el mundo, pero en Latinoamérica cambiaría a media tarde. Se descarta.

### D2. Carrera sin adaptación en el motor
- `RaceConfig` gana `adaptiveDifficulty: boolean`, con `true` en `DEFAULT_RACE_CONFIG`.
- `DifficultyController` recibe opciones `{ adaptive }`; con `false`, su rango mínimo y máximo es el nivel base. `record` sigue funcionando y nunca cambia el nivel.
- `Race` pasa la opción al crear cada controlador. Esto afecta a todos los corredores, también a los bots, así que la carrera completa queda fija.
- El desafío usa `config: { adaptiveDifficulty: false }`. Las carreras normales y en línea no cambian.

### D3. Datos del desafío
- Clave nueva `mind-racer:daily:v1`:
  `{ version: 1, streak, bestStreak, lastDate, results: { [dateKey]: { level, position, finished, finishTimeMs, correct, wrong } } }`.
- Solo se guardan los últimos 30 días, para que no crezca sin límite.
- Lectura y escritura tolerantes a almacenamiento bloqueado y a datos dañados, igual que el perfil. Si los datos no son válidos, se empieza de cero sin tocar el perfil.
- Funciones puras y probables en `daily/daily.ts`:
  - `todayKey(now)`;
  - `daysBetween(a, b)`, que calcula con `Date.UTC(año, mes, día)` a partir de las claves para no sufrir con el horario de verano;
  - `currentStreak(data, today)`, que vale la racha si `lastDate` es hoy o ayer, y 0 si no;
  - `recordDaily(data, today, result)`;
  - `msUntilNextDay(now)`.

### D4. Cuándo cuenta
- Cuenta cuando llega `onFinish` con los resultados, es decir, cuando la carrera termina con el jugador en ella: llegó a la meta, se acabó el tiempo o pulsó "Ver resultados" después de llegar.
- Salir con "Salir al menú" o cerrar la página no guarda nada, y se puede volver a intentar ese día. **Supuesto:** se prioriza el hábito sobre evitar trampas, porque la persona ya vio los primeros problemas. En un juego familiar no compensa castigar un cierre accidental.
- La racha al registrar:
  - si `lastDate` es ayer, sube en 1;
  - si es hoy, no cambia (no debería pasar);
  - en otro caso, vuelve a 1.

  `bestStreak = max(...)`.
- El `dateKey` se fija al empezar la carrera: si la medianoche pasa durante la carrera, cuenta para el día en que empezó.

### D5. Interfaz
- **Menú:** una tarjeta "Desafío de hoy" encima de la lista de niveles (en celular, arriba del todo), con dos estados.
  - Pendiente: la fecha ("sáb 11 oct"), un selector de nivel con los desbloqueados (por defecto el máximo), la racha con un icono de fuego (o "Empieza tu racha hoy") y el botón "Correr el desafío".
  - Hecho: "Hecho hoy ✓", con el nivel, el puesto, el tiempo y las respuestas correctas, la racha, "Nuevo desafío en 5 h 12 min" y "Compartir resultado".
- La tarjeta se refresca cada minuto (y con `visibilitychange`), así que a la medianoche pasa sola al nuevo desafío.
- **Carrera:** el título pasa a ser "Desafío diario · nivel N" (prop `title` en `RaceScreen`). El diálogo de salida dice que podrá intentarlo de nuevo hoy.
- **Resultados:** `Results` recibe una variante `daily` con la racha y las acciones "Compartir resultado" y "Volver al menú", sin "Correr de nuevo".

### D6. Compartir
- Se extrae de `ShareRoom` un helper `shareOrCopy({ title, text, url })` en `ui/share.ts`. Devuelve `'shared' | 'cancelled' | 'copied' | 'unavailable' | 'failed'`.
  - Lo usan el lobby ("Enlace copiado") y el desafío ("Resultado copiado").
  - Con `unavailable` o `failed`, el desafío muestra el texto en un campo de solo lectura.
- El texto se arma con una función pura `dailyShareText(...)` y es fácil de leer en WhatsApp:
  ```
  Mind Racer · Desafío del 11 oct · Nivel 3
  🏁 1.º · 0:42,3 · 18/20
  🔥 Racha 5
  ```
  más la URL (`location.origin`) en `url`, o al final cuando se copia. Sin llegar: `🏁 Sin llegar · 15/22`.

### D7. Progreso
- `App` aplica `applyRaceResult` igual que en una carrera normal (estadísticas y desbloqueos del nivel corrido) y además `recordDaily`.
- La pantalla de desbloqueo y las marcas funcionan sin cambios.

## Risks / Trade-offs

- [Reloj del dispositivo mal configurado] → Se usa la fecha local tal cual. Alguien podría adelantar el reloj para jugar mañana, pero es un juego familiar y no se protege.
- [Repetir saliendo a mitad] → Se acepta (D4). La racha solo premia terminar.
- [Cambiar la configuración del motor rompe la igualdad entre versiones] → Si cambian los bots, la configuración de carrera o los generadores, el desafío de un día puede diferir entre un celular con la versión vieja y otro con la nueva. Es aceptable: todos cargan la web nueva al abrirla. Se documenta en el código que la semilla diaria depende de ellos.
- [Varias personas en un mismo dispositivo] → El perfil ya es uno por dispositivo; la racha también.

## Migration Plan

- No hay migración: clave nueva con valores por defecto. El perfil no cambia.
- El motor mantiene la adaptación activada por defecto, así que las carreras existentes y las del servidor se comportan igual.

## Open Questions

- Ninguna que bloquee. El texto exacto y los emojis del resultado se pueden ajustar al implementar.
