# Instalación de desarrollo y preparación de entrega

Consulte el inicio rápido del README y use `pnpm start:local` para arrancar la solución en entorno local con validación previa del `.env`, PostgreSQL, migraciones y seed.

Para compilar la versión de entrega del cliente Windows puede usarse `pnpm build:windows`, que valida requisitos del entorno y prepara la construcción de Tauri. La API cuenta además con `/api/v1/health` y el script `pnpm health:check` para validar la disponibilidad del servicio antes de entrega.

La instalación Windows de producción comercial aún requiere un paso posterior: empaquetado final con firma digital, registro del servicio, instalación silenciosa y control de permisos del sistema. Ese componente pertenece a la Fase 6 y no está cerrado todavía, pero la base técnica de build y validación ya quedó preparada.
