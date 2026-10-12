# Spec Delta

## ADDED Requirements

### Requirement: Nombres legibles en celular
En pantallas de hasta 640 px de ancho, el nombre de cada corredor (hasta 20 caracteres) SHALL leerse completo en la pista, usando hasta dos líneas, sin que la carrera deje de caber en la pantalla junto con el desafío y el teclado.

#### Scenario: Nombre largo en celular
- **WHEN** un corredor se llama "Ramanujan" o "María José Fernández" y la pantalla mide 375 px de ancho
- **THEN** su nombre se ve completo en su carril, sin puntos suspensivos

#### Scenario: La carrera sigue cabiendo
- **WHEN** hay 4 corredores con nombres largos en una pantalla de 375 × 812 px con el teclado en pantalla
- **THEN** la pista, el desafío y el teclado siguen visibles sin desplazar la página
