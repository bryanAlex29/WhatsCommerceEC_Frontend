# Recuperación desde login

RF-02/RNF-01, DERCAS §17 y ampliación §7 del contrato compartido. Mantiene Expo/React Native, componentes nativos propios, tema y logo existentes. No incluye AdminWeb ni registro público.

`AccessScreen` ofrece «¿Olvidaste tu contraseña?». `PasswordRecoveryScreen` permite solicitar código al correo registrado y enviar código/nueva contraseña/confirmación. Código y claves se limpian al enviar, volver o pasar a segundo plano. El controlador descarta respuestas tardías y no persiste ningún dato de recuperación ni reintenta escrituras. Al volver al login tras éxito, se limpia la sesión local mediante el mecanismo existente, con manejo de errores de SecureStore.

Transporte centralizado:
- `POST /api/auth/password-recovery/request`: `202`, mensaje genérico; no confirma existencia ni entrega.
- `POST /api/auth/password-recovery/reset`: `204`; `400 INVALID_RECOVERY_CODE` indistinguible, `429` y `503` con mensajes locales seguros.
- Sin JWT/refresh automático, secretos SMTP, códigos en URL ni persistencia ordinaria. La confirmación de contraseña solo vive en UI; no se envía a la API.

El backend debe aplicar su SQL005 y configurar privadamente Gmail antes de activar la nueva versión. No introducir su contraseña en este repositorio ni variables públicas. Si no está habilitado devuelve503, no un envío ficticio. Tras timeout de reset ofrecer login; no afirmar si el cambio se confirmó ni repetir automáticamente.

Verificación: `npm run typecheck`, `npm run lint`, `npm test`. Pruebas de controlador, transporte y componentes usan API/almacenamiento simulados. No acreditan ejecución en Android/iOS, conectividad con API real ni entrega por Gmail. Estas pruebas de aceptación siguen pendientes en dispositivos.

## Estado de aceptación reportado (2026-11-10)

El propietario confirmó recepción real del código por Gmail SMTP y posteriormente indicó que todo funciona antes de autorizar la publicación. Es evidencia reportada por el usuario, no una prueba automatizada nativa ni una comprobación independiente de todos los casos de sesión/aislamiento. El área técnica muestra la URL pública efectiva y errores health controlados; no expone claves, tokens ni respuestas privadas. Si cambia la red del PC, actualizar localmente `EXPO_PUBLIC_API_URL`, reiniciar Expo y abrir el proyecto actual, no uno antiguo del historial.

Las direcciones locales y perfiles `.env` no se publican. API y worker deben mantenerse activos para recibir nuevos códigos. Gmail API continúa como alternativa backend sin activar; no requiere cambios en esta pantalla.
