# Spec Delta

## Purpose

Guarda en el dispositivo el perfil del jugador, los niveles que ha desbloqueado y sus mejores marcas, para que pueda progresar entre sesiones sin necesidad de una cuenta.

## ADDED Requirements

### Requirement: Perfil local
El juego SHALL guardar en el navegador un perfil con nombre de jugador, nivel máximo desbloqueado y estadísticas, y SHALL recuperarlo al volver a abrir el juego en el mismo navegador.

#### Scenario: Volver al juego
- **WHEN** un jugador cierra el juego y lo abre de nuevo en el mismo navegador
- **THEN** su nombre, niveles desbloqueados y marcas siguen disponibles

### Requirement: Primer ingreso y punto de partida
En el primer ingreso el juego SHALL pedir un nombre (de 1 a 20 caracteres) y un punto de partida: Principiante (nivel 1), Intermedio (nivel 4) o Avanzado (nivel 7), que queda como nivel máximo desbloqueado.

#### Scenario: Adulto elige Avanzado
- **WHEN** un jugador nuevo elige el punto de partida Avanzado
- **THEN** los niveles 1 a 7 quedan desbloqueados

### Requirement: Selección de nivel
El jugador SHALL poder iniciar carreras en cualquier nivel desbloqueado y no SHALL poder elegir niveles bloqueados.

#### Scenario: Nivel bloqueado
- **WHEN** el nivel máximo desbloqueado es 3
- **THEN** los niveles 4 a 10 se muestran bloqueados y no se pueden seleccionar

### Requirement: Desbloqueo de niveles
Al terminar una carrera en su nivel máximo desbloqueado, en 1.º o 2.º lugar y con precisión de al menos 80 %, el jugador SHALL desbloquear el nivel siguiente (hasta el 10).

#### Scenario: Desbloqueo exitoso
- **WHEN** un jugador con nivel máximo 3 termina 1.º en nivel 3 con 85 % de precisión
- **THEN** el nivel 4 queda desbloqueado y la pantalla de resultados lo anuncia

#### Scenario: Precisión insuficiente
- **WHEN** un jugador termina 1.º en su nivel máximo con 70 % de precisión
- **THEN** no se desbloquea ningún nivel

### Requirement: Mejores marcas por nivel
Por cada nivel el juego SHALL guardar: carreras jugadas, victorias, mejor tiempo de llegada, mejor cantidad de respuestas correctas por minuto y mejor precisión.

#### Scenario: Nueva mejor marca
- **WHEN** un jugador termina una carrera con un tiempo menor a su mejor tiempo en ese nivel
- **THEN** se guarda el nuevo mejor tiempo y la pantalla de resultados lo marca como récord

### Requirement: Datos dañados o ausentes
Si los datos guardados no existen, no se pueden leer o no son válidos, el juego SHALL iniciar con un perfil nuevo sin bloquearse.

#### Scenario: Almacenamiento corrupto
- **WHEN** los datos guardados del perfil están dañados
- **THEN** el juego muestra el flujo de primer ingreso y funciona normalmente
