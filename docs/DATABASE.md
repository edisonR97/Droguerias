# Base de datos

PostgreSQL es la única fuente de verdad. La migración inicial crea establecimiento, sucursal, terminal, usuarios, sesiones, roles, permisos y auditoría con claves foráneas e índices por tenant. Todos los identificadores empresariales son UUID; la auditoría usa una secuencia monotónica.

Los importes futuros usarán `Decimal` de Prisma respaldado por `NUMERIC(p,s)`, nunca `float`. Las operaciones de ventas e inventario se implementarán con transacciones serializables o bloqueo explícito según el caso, claves de idempotencia únicas y movimientos inmutables.
