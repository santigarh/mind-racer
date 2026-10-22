# Spec Delta

## MODIFIED Requirements

### Requirement: Resultados y progreso
La pantalla de resultados de una carrera multijugador SHALL mostrar la clasificación con el nivel de cada corredor y la opción "Volver a la sala". El resultado SHALL contar para el progreso local de cada persona en el nivel que eligió, con las mismas reglas de desbloqueo y récords que una carrera local. Una carrera de tablas no SHALL contar para el progreso local.

#### Scenario: Desbloqueo en familia
- **WHEN** la hija, con nivel máximo 2, termina 2.º en nivel 2 con 90 % de precisión en una carrera multijugador
- **THEN** su perfil desbloquea el nivel 3 y su pantalla de resultados lo anuncia

#### Scenario: Carrera de tablas en clase
- **WHEN** un alumno con nivel máximo 2 termina 1.º con 95 % de precisión en una carrera de la tabla del 7
- **THEN** su perfil sigue con nivel máximo 2, sus marcas no cambian y sus resultados dicen que la práctica no cuenta para el progreso
