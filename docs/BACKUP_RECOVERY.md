# Respaldo y recuperación

FarmaCore genera respaldos PostgreSQL en formato personalizado, de manera atómica y con
manifiesto SHA-256. La retención predeterminada es de 30 días.

- Crear respaldo: `corepack pnpm backup`.
- Crear y restaurar en una base aislada: `corepack pnpm backup:verify`.
- Restaurar manualmente: `scripts/restore-database.ps1 -BackupPath <archivo> -TargetDatabase <base>`.

La restauración verifica el checksum, valida el formato con `pg_restore --list` y confirma que
la base restaurada contiene tablas. Para reemplazar una base existente debe indicarse
explícitamente `-RecreateTarget`. Una desinstalación no debe eliminar respaldos ni datos.

En producción, la carpeta de respaldos debe ubicarse en un disco distinto y sincronizarse
cifrada hacia almacenamiento externo con acceso restringido.
