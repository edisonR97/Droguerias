# FarmaCore ERP Ultimate

Fundamentos de un ERP farmacéutico local para Windows. Esta entrega corresponde a la **Fase 1**: monorepo, API local, persistencia PostgreSQL, autenticación, RBAC, aplicación React/Tauri y dashboard conectado.

## Requisitos de desarrollo

- Node.js 22 o superior y pnpm 10.
- Docker Desktop para PostgreSQL de desarrollo.
- Rust estable y herramientas de compilación de Microsoft para ejecutar/empaquetar Tauri.

## Inicio rápido

1. Copie `.env.example` a `.env` y reemplace cada secreto.
2. Defina `POSTGRES_PASSWORD` y haga coincidir `DATABASE_URL`.
3. Ejecute `pnpm install`.
4. Ejecute `pwsh -File scripts/dev.ps1` para validar el entorno, levantar PostgreSQL y arrancar el ERP local.
5. Si prefiere hacerlo manualmente, ejecute `docker compose --env-file .env -f infra/docker/docker-compose.yml up -d --wait`, luego `pnpm db:generate`, `pnpm db:migrate` y `pnpm db:seed` (requiere `SEED_OWNER_PASSWORD`).
6. Ejecute `pnpm dev`.

La API carga automáticamente `.env` y `.env.local` al iniciar, de modo que las credenciales no queden ocultas en la ejecución local.

API: `http://127.0.0.1:4310/api/v1`; OpenAPI: `http://127.0.0.1:4310/api/docs`; cliente web de desarrollo: `http://localhost:1420`.

Nunca use los valores de ejemplo en producción. El seed no contiene una contraseña universal y falla si no se proporciona una contraseña segura.
