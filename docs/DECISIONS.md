# Decisiones

## ADR-001 — Monolito modular local

Se elige NestJS con módulos de dominio sobre microservicios. Reduce operación y fallos en instalaciones locales sin impedir extraer adaptadores en el futuro.

## ADR-002 — API como única frontera de datos

Tauri no obtiene credenciales de PostgreSQL. Autorización, auditoría y transacciones permanecen en la API.

## ADR-003 — Seguridad sin contraseña inicial universal

El seed exige `SEED_OWNER_PASSWORD`; una instalación comercial deberá crear al propietario mediante un asistente de aprovisionamiento de un solo uso.
