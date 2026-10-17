# Spec Delta

## MODIFIED Requirements

### Requirement: Capacidad de la sala
Una sala familiar SHALL admitir hasta 4 personas, contando a quienes esperan la siguiente carrera. Las salas de clase siguen la capacidad definida en `classroom-mode`.

#### Scenario: Cuarto jugador
- **WHEN** hay 3 personas en una sala familiar y se une una cuarta
- **THEN** la cuarta entra y la sala pasa a estar llena

#### Scenario: Sala de clase
- **WHEN** hay 4 alumnos en una sala de clase y se une un quinto
- **THEN** el quinto entra, porque la sala de clase admite más personas

### Requirement: Transferencia de anfitrión
Si el anfitrión de una sala familiar sale de la sala, el rol de anfitrión SHALL pasar a la persona que lleva más tiempo en la sala. En las salas de clase el rol no pasa a otra persona (ver `classroom-mode`).

#### Scenario: El anfitrión se va
- **WHEN** el anfitrión sale de una sala familiar con otras dos personas
- **THEN** la persona que entró primero entre las restantes pasa a ser anfitrión y todos lo ven
