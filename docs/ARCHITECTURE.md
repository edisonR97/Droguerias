# Arquitectura

FarmaCore utiliza un monolito modular desplegado localmente. La aplicación Tauri consume exclusivamente la API NestJS autenticada; nunca conecta directamente con PostgreSQL. En modo monousuario los tres componentes residen en el mismo equipo. En multicaja, API y PostgreSQL viven en el servidor local y los terminales acceden a la API por LAN con una configuración explícita.

## Límites

- `apps/desktop`: interfaz y adaptador Tauri; no contiene reglas comerciales autoritativas.
- `apps/local-api`: autenticación, autorización y módulos del dominio.
- `packages/shared`: contratos sin lógica de infraestructura.
- `packages/validation`: esquemas reutilizables para experiencia inmediata; la API vuelve a validar.
- `database/migrations`: reservado para migraciones operativas adicionales; Prisma mantiene sus migraciones versionadas junto al esquema.
- `infra`: desarrollo, empaquetado y servicios Windows.

La API escucha en loopback por defecto. Habilitar LAN exigirá TLS local, firewall limitado a la subred, alta explícita de terminales y rotación de credenciales. La sincronización multisucursal queda fuera de Fase 1; se diseñará con registro de operaciones e identificación global, no con última escritura.
