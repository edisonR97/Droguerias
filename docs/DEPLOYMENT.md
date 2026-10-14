# Despliegue de FarmaCore ERP

La entrega para Windows se compone del cliente de escritorio Tauri y de PostgreSQL con la API local, supervisados por Docker Desktop. La API solo se publica en 127.0.0.1:4310 y no queda expuesta a la red local.

## Requisitos del equipo

- Windows 10/11 de 64 bits.
- Docker Desktop con contenedores Linux.
- WebView2 Runtime, normalmente incluido en Windows 11.
- Al menos 8 GB de RAM y 10 GB de espacio libre.
- Permisos de administrador para instalar Docker Desktop y el cliente.

Node.js, pnpm y Rust solo son necesarios para construir una nueva versión.

## Preparar y arrancar producción

1. Copie .env.example a .env.
2. Defina secretos únicos para POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET y SEED_OWNER_PASSWORD.
3. Ejecute: corepack pnpm production:up
4. Verifique: corepack pnpm production:status
5. Ejecute: corepack pnpm release:check
6. Ejecute: corepack pnpm e2e:smoke
7. Instale release\FarmaCore ERP_0.1.0_x64-setup.exe.

El comando production:up crea PostgreSQL, construye la imagen del API, aplica migraciones pendientes y espera a que ambos servicios estén saludables.

## Operación

- Estado: corepack pnpm production:status
- Registros: corepack pnpm production:logs
- Salud: corepack pnpm health:check
- Respaldo: corepack pnpm backup
- Restauración de prueba: corepack pnpm backup:verify
- Detener sin borrar datos: corepack pnpm production:down

No use docker compose down -v en producción: la opción -v elimina el volumen de PostgreSQL.

## Actualización

1. Genere y conserve un respaldo verificado.
2. Reemplace el código o los artefactos.
3. Ejecute corepack pnpm production:up.
4. Ejecute corepack pnpm e2e:smoke y corepack pnpm release:check.

## Artefactos y firma

El instalador está en release\FarmaCore ERP_0.1.0_x64-setup.exe. Antes de distribución comercial externa debe firmarse con el certificado de firma de código del propietario. Esa firma requiere un certificado real y no puede completarse con credenciales ficticias.

Consulte [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) para el cierre de cada instalación.
