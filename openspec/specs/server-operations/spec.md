# server-operations Specification

## Purpose

Define cómo se comporta el servidor multijugador como servicio público en internet: cómo se configura, cómo informa que está vivo y cómo se protege de conexiones de otros sitios y del abuso.

## Requirements

### Requirement: Chequeo de salud
El servidor SHALL responder `GET /health` con estado 200 y un cuerpo JSON que incluya `status: "ok"` y la cantidad de salas abiertas, en el mismo puerto que el WebSocket.

#### Scenario: Plataforma comprueba el servicio
- **WHEN** la plataforma de hosting pide `GET /health`
- **THEN** recibe 200 con `{"status":"ok","rooms":<n>}`

#### Scenario: Ruta desconocida
- **WHEN** alguien pide por HTTP una ruta distinta de `/health`
- **THEN** recibe 404 y el servidor sigue funcionando

### Requirement: Configuración por variables de entorno
El servidor SHALL tomar de variables de entorno el puerto (`PORT`, por defecto 8787), la interfaz (`HOST`, por defecto `0.0.0.0`), la lista de orígenes permitidos (`ALLOWED_ORIGINS`, separados por comas) y la cantidad de proxies de confianza (`TRUST_PROXY_HOPS`, por defecto 0).

#### Scenario: Puerto asignado por la plataforma
- **WHEN** la plataforma define `PORT=10000`
- **THEN** el servidor atiende HTTP y WebSocket en el puerto 10000

### Requirement: Orígenes permitidos
Si `ALLOWED_ORIGINS` está definida, el servidor SHALL rechazar las conexiones WebSocket cuyo encabezado `Origin` no esté en la lista. Si no está definida, SHALL aceptar cualquier origen, para el desarrollo y la red local.

#### Scenario: Conexión desde el sitio publicado
- **WHEN** `ALLOWED_ORIGINS=https://mind-racer.pages.dev` y una página de ese origen abre el WebSocket
- **THEN** la conexión se acepta

#### Scenario: Conexión desde otro sitio
- **WHEN** `ALLOWED_ORIGINS=https://mind-racer.pages.dev` y una página de `https://otro-sitio.example` intenta abrir el WebSocket
- **THEN** la conexión se rechaza con estado 403 y no se crea ninguna sala

#### Scenario: Red local sin configuración
- **WHEN** `ALLOWED_ORIGINS` no está definida
- **THEN** se aceptan conexiones desde cualquier origen, como en `pnpm dev`

### Requirement: Límite de salas por IP
El servidor SHALL permitir como máximo 5 salas nuevas por dirección IP en una ventana de 10 minutos. Al superarlo, SHALL responder con un error claro sin afectar a las salas existentes. Con `TRUST_PROXY_HOPS=n`, la IP SHALL tomarse del n-ésimo valor de `X-Forwarded-For` contando desde la derecha (el que agrega el proxy de la plataforma); sin esa variable, SHALL usarse la IP de la conexión.

#### Scenario: Demasiadas salas
- **WHEN** una misma IP crea su sexta sala en menos de 10 minutos
- **THEN** recibe el error "Creaste muchas salas seguidas; espera unos minutos" y no se crea la sala

#### Scenario: Encabezado falsificado
- **WHEN** `TRUST_PROXY_HOPS=1` y un cliente envía `X-Forwarded-For: 1.2.3.4` al que el proxy agrega su IP real `200.1.1.1`
- **THEN** el límite se cuenta para `200.1.1.1` y no para `1.2.3.4`

#### Scenario: Pasada la ventana
- **WHEN** pasan 10 minutos desde la primera de esas 5 salas
- **THEN** esa IP puede volver a crear una sala

### Requirement: Una sola instancia
El servicio SHALL desplegarse con exactamente una instancia, porque las salas viven en la memoria del proceso.

#### Scenario: Configuración del servicio
- **WHEN** se revisa la configuración de despliegue del servidor
- **THEN** declara una única instancia y no tiene autoescalado
