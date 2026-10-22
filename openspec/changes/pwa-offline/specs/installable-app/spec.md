# Spec Delta

## Purpose

Permite instalar Mind Racer como una app en la pantalla de inicio, abrirlo y jugar sin conexión en los modos que no necesitan servidor, y recibir versiones nuevas sin interrumpir una partida.

## ADDED Requirements

### Requirement: Manifiesto de la app
El juego SHALL publicar un manifiesto de app web con nombre "Mind Racer", idioma español, inicio y alcance en la raíz del sitio, presentación a pantalla completa sin barra del navegador (`standalone`) y color de tema y de fondo `#181818`. No SHALL fijar la orientación de la pantalla.

#### Scenario: Navegador que permite instalar
- **WHEN** alguien abre el juego en Chrome para Android
- **THEN** el navegador lo reconoce como app instalable con el nombre "Mind Racer"

#### Scenario: App instalada
- **WHEN** alguien abre el juego desde el ícono de la pantalla de inicio
- **THEN** el juego se abre en el menú, sin barra de direcciones, con fondo `#181818`

#### Scenario: Orientación libre
- **WHEN** alguien gira el teléfono o proyecta el juego en horizontal
- **THEN** el juego sigue la orientación del dispositivo

### Requirement: Íconos de la app
El juego SHALL ofrecer íconos PNG de 192 y 512 px, una variante *maskable* de 512 px con el dibujo dentro de la zona segura y un `apple-touch-icon` de 180 px. Todos SHALL mostrar la × ámbar sobre `#181818` del favicon y no SHALL depender de fuentes instaladas en el dispositivo.

#### Scenario: Ícono adaptable en Android
- **WHEN** Android recorta el ícono instalado en círculo
- **THEN** la × se ve completa y centrada, sin bordes cortados

#### Scenario: Ícono en iOS
- **WHEN** alguien agrega el juego a la pantalla de inicio desde Safari
- **THEN** el ícono es la × ámbar sobre fondo `#181818`, no una captura de la página

### Requirement: Botón para instalar
El menú SHALL mostrar el botón "Instalar app" solo cuando el navegador ofrece instalar el juego. Al pulsarlo, SHALL abrir el diálogo de instalación del navegador. El botón SHALL desaparecer cuando el juego queda instalado o cuando ya se está usando como app instalada.

#### Scenario: Navegador con instalación
- **WHEN** un jugador abre el menú en un navegador que ofrece instalar y pulsa "Instalar app"
- **THEN** ve el diálogo de instalación del navegador, y si acepta, el botón desaparece

#### Scenario: Navegador sin instalación propia
- **WHEN** un jugador abre el menú en Safari para iOS
- **THEN** no ve el botón "Instalar app"

#### Scenario: Ya instalada
- **WHEN** un jugador abre el juego desde el ícono de la pantalla de inicio
- **THEN** el menú no muestra "Instalar app"

### Requirement: Abrir sin conexión
Después de una primera visita con conexión, el juego SHALL abrir sin internet desde cualquier dirección del sitio, incluidas las que llevan parámetros como `?sala=<CÓDIGO>`. Sin conexión, la dirección SHALL conservarse tal cual para que el juego la lea.

#### Scenario: Abrir sin internet
- **WHEN** un jugador que ya visitó el juego lo abre en modo avión
- **THEN** el juego carga y muestra el menú

#### Scenario: Enlace a una sala sin internet
- **WHEN** un jugador sin conexión abre un enlace `/?sala=K7QF`
- **THEN** el juego carga, va a "Jugar con amigos" con el código K7QF y avisa que no hay conexión

#### Scenario: Primera visita sin internet
- **WHEN** alguien que nunca abrió el juego intenta abrirlo sin conexión
- **THEN** ve el error de conexión del navegador, ya que no hay nada guardado todavía

### Requirement: Modos locales sin conexión
Sin conexión, el juego SHALL permitir correr contra los bots, practicar tablas, jugar el desafío diario y usar el garaje igual que con conexión. El progreso, los desbloqueos del garaje, la racha y los ajustes SHALL guardarse en el dispositivo como siempre.

#### Scenario: Carrera sin internet
- **WHEN** un jugador sin conexión corre contra los bots y gana
- **THEN** la carrera, los sonidos y los resultados funcionan, y el progreso queda guardado

#### Scenario: Desafío diario sin internet
- **WHEN** un jugador sin conexión juega el desafío de hoy
- **THEN** recibe los mismos problemas que con conexión y su racha se actualiza

### Requirement: Sin recursos de otros sitios
Para mostrarse, el juego SHALL usar solo archivos servidos por su propio sitio, incluidas las fuentes Geist y Geist Mono. Sin conexión, el juego SHALL verse con las mismas fuentes que con conexión.

#### Scenario: Fuentes sin conexión
- **WHEN** un jugador abre el juego sin internet
- **THEN** los textos y los problemas se ven con Geist y Geist Mono, no con la fuente del sistema

#### Scenario: Servicio de fuentes bloqueado
- **WHEN** una red escolar bloquea Google Fonts
- **THEN** el juego se ve igual que en cualquier otra red

### Requirement: Versión nueva sin interrupciones
Cuando hay una versión nueva del juego lista, el juego no SHALL recargarse por su cuenta. El menú SHALL mostrar "Hay una versión nueva" con el botón "Actualizar", que recarga el juego con la versión nueva. Durante una carrera, en una sala o en el tablero de la profesora no SHALL aparecer el aviso.

#### Scenario: Aviso en el menú
- **WHEN** se publica una versión nueva y el jugador vuelve al menú
- **THEN** ve "Hay una versión nueva", pulsa "Actualizar" y el juego vuelve a abrir en el menú con la versión nueva

#### Scenario: Versión nueva durante una clase
- **WHEN** se publica una versión nueva mientras la profesora tiene la sala abierta
- **THEN** el tablero sigue funcionando con la versión que tiene, sin recargas ni avisos

#### Scenario: Aviso ignorado
- **WHEN** el jugador no pulsa "Actualizar", cierra el juego y lo vuelve a abrir más tarde
- **THEN** el juego abre con la versión nueva

### Requirement: Datos conservados al actualizar
Instalar el juego, actualizarlo o usarlo sin conexión no SHALL borrar ni cambiar el perfil, el progreso, el garaje, el desafío diario ni los ajustes guardados en el dispositivo.

#### Scenario: Actualización con progreso
- **WHEN** un jugador con el nivel 6 desbloqueado pulsa "Actualizar"
- **THEN** después de recargar sigue con su perfil, el nivel 6 desbloqueado, su auto y su racha
