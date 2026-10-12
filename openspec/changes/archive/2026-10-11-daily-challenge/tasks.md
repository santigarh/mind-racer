# Tasks

## 1. Motor: carrera sin adaptación

- [x] 1.1 Agregar `adaptiveDifficulty` a `RaceConfig` (`true` por defecto), opción `{ adaptive }` en `DifficultyController` y pasarla desde `Race` a cada corredor (D2); verificar con pruebas "Racha rápida sin adaptación", "Errores sin adaptación", que `maxReached` sea el nivel elegido, y que las pruebas existentes de adaptación sigan pasando sin cambios
- [x] 1.2 Agregar una prueba de igualdad: dos `LocalRaceSession` con la semilla diaria del mismo día y nivel, sin adaptación, en las que el jugador responde distinto (una acierta todo, la otra falla a ratos), reciben la misma secuencia de desafíos y los bots terminan con los mismos tiempos

## 2. Datos del desafío

- [x] 2.1 Crear `daily/daily.ts` con `todayKey`, `dailySeed`, `daysBetween`, `currentStreak`, `recordDaily` (límite de 30 días) y `msUntilNextDay`, más la lectura y escritura tolerante de `mind-racer:daily:v1` (D1, D3, D4); verificar con pruebas de clave local, semilla distinta por nivel y día, "Día siguiente", "Día saltado", "Racha pendiente hoy", cambio de horario de verano, "Datos dañados" y almacenamiento bloqueado
- [x] 2.2 Crear `dailyShareText` (D6); verificar con pruebas el texto con llegada, "sin llegar" y racha 1

## 3. Compartir reutilizable

- [x] 3.1 Extraer `shareOrCopy` a `ui/share.ts` y usarlo en `ShareRoom` sin cambiar su comportamiento (D6); verificar que las pruebas existentes de compartir la sala siguen pasando y agregar pruebas de cada resultado del helper

## 4. Interfaz

- [x] 4.1 Tarjeta "Desafío de hoy" en `Menu` con los estados pendiente y hecho, selector de nivel, racha, cuenta regresiva y refresco por minuto (D5); verificar con Testing Library "Nivel por defecto", "Elegir un nivel más bajo", "Desafío terminado", "Racha pendiente hoy" y el paso de la medianoche con un reloj falso
- [x] 4.2 Variante diaria de la carrera en `App` y `RaceScreen` (título, texto del diálogo de salida, semilla diaria, sin adaptación) y registro al terminar con `applyRaceResult` + `recordDaily` (D4, D7); verificar con Testing Library "Salir a mitad" (el menú sigue ofreciendo el desafío), "Se acaba el tiempo" (cuenta como hecho, sin llegar) y "Desbloqueo desde el desafío"
- [x] 4.3 Variante `daily` de `Results` con racha y "Compartir resultado" y sin "Correr de nuevo", más "Compartir resultado" en el estado hecho del menú (D5, D6); verificar con Testing Library "Compartir por mensaje" (`navigator.share` falso con el texto esperado), "Computadora" ("Resultado copiado") y el caso sin ninguna API (texto visible)

## 5. Integración

- [x] 5.1 Verificar que `pnpm test`, `pnpm typecheck`, `pnpm build` y `pnpm --filter server build:prod` pasan desde la raíz
- [x] 5.2 Prueba en el navegador en local: correr el desafío en dos pestañas con orígenes distintos y el mismo nivel, y comprobar que los primeros desafíos coinciden; ver el estado "Hecho hoy", compartir el resultado, revisar la tarjeta a 375 × 812 px y que no haya errores en la consola
- [x] 5.3 Actualizar el README (sección de juego en familia) con el desafío diario

## Workflow follow-up

- Tras el push, prueba en la nube del usuario: Lucía y Papá corren el desafío del mismo nivel en sus celulares y comparan el texto compartido.
- Archivar el cambio con `/opsx:archive`.
