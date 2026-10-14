# Seguridad

- Contraseñas con Argon2id; no existen credenciales predeterminadas.
- Tokens de acceso cortos y sesiones de renovación persistidas como hash Argon2id.
- Rotación obligatoria del refresh token; reutilizar un token anterior es rechazado.
- Cierre de sesión con revocación inmediata del access token y del refresh token.
- Bloqueo temporal tras cinco intentos fallidos.
- RBAC validado por guards globales del backend.
- Helmet, CORS restringido y API enlazada a `127.0.0.1` por defecto.
- Secretos solo mediante entorno; `.env` está excluido de Git.
- Auditoría de inicio, renovación y cierre de sesión.

## Pendiente antes de producción

Protección del almacén de tokens con Windows Credential Manager, TLS y enrolamiento de
terminales LAN, pruebas de penetración externas y firma de código. Para despliegues en una
sola máquina la API permanece enlazada a `127.0.0.1`.
