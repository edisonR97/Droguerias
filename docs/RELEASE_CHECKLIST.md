# Checklist de entrega comercial Windows

## Preparación

- [ ] Crear .env desde .env.example y usar secretos únicos.
- [ ] Confirmar Docker Desktop operativo y al menos 10 GB de espacio libre.
- [ ] Verificar que los puertos locales 4310 y 55432 estén disponibles.

## Artefactos

- [ ] Ejecutar corepack pnpm lint, typecheck, test, build y format:check.
- [ ] Construir el instalador con corepack pnpm installer:windows.
- [ ] Firmar el instalador con el certificado del propietario.
- [ ] Registrar versión, fecha y checksum SHA-256.

## Instalación

- [ ] Ejecutar corepack pnpm production:up.
- [ ] Confirmar corepack pnpm production:status.
- [ ] Instalar el cliente desde el ejecutable NSIS.
- [ ] Ejecutar corepack pnpm release:check y corepack pnpm e2e:smoke.

## Validación con el cliente

- [ ] Probar inicio y cierre de sesión con cuentas autorizadas.
- [ ] Completar una compra y su recepción.
- [ ] Completar una venta, cobro y devolución.
- [ ] Revisar inventario FEFO, cartera, reportes y permisos.
- [ ] Obtener aceptación escrita del cliente.

## Operación y recuperación

- [ ] Ejecutar corepack pnpm backup:verify.
- [ ] Programar respaldos, retención y copia fuera del equipo.
- [ ] Documentar restauración, soporte y responsable operativo.
- [ ] Confirmar que la API permanece limitada a 127.0.0.1.

## Criterio de aprobación

La entrega comercial queda cerrada cuando el instalador está firmado, el despliegue está saludable, el smoke test pasa, una restauración fue verificada y el cliente aprobó sus flujos reales. La validación técnica automática no sustituye la aceptación operativa ni los requisitos legales aplicables.
