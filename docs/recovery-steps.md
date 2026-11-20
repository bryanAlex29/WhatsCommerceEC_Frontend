# Recuperación en tres pantallas

El propietario aprobó mínimo8 y verificación real antes de nueva contraseña. Son tres pantallas nativas con cabecera verde, superficie clara y pictogramas nativos, no un formulario único dividido solo visualmente.

1. **Recuperar contraseña:** correo vacío, Enviar código y Volver al login. Respuesta genérica sin confirmar existencia o entrega.
2. **Verificar código:** ocho casillas visuales y un único input accesible (pegar/ceros iniciales), correo temporal, Verificar y Reenviar con60s mínimo. Verificación realPOST, no solo formato. No abre la nueva contraseña tras un error.
3. **Nueva contraseña:** dos campos con controles de visibilidad, lista de requisitos8–128/mayúscula/símbolo/sin espacios, Cambiar y confirmación sin login automático. Números opcionales.

El code de6 dígitos y45s del mockup no sustituye las reglas vigentes8/60. El contador es orientativo; Redis/PostgreSQL y la API son autoridad, incluido `Retry-After`. La vigencia total sigue15min desde la emisión original; verificar no la amplía.

## Estado y retroceso

- `PasswordRecovery` mantiene correo y pase privados en memoria; snapshots exponen solo etapa/estado/mensaje/espera. Contraseña y código son argumentos locales que se limpian al enviar/salir. No se escriben en SecureStore ni en params/URLs.
- Verificar devuelve `{resetToken,expiresAt}`; el móvil solo presenta la tercera pantalla si el contrato válido llega de la API. Complete recibe correo/pase/contraseña y exige204 vacío.
- Retroceder de la nueva contraseña limpia sus campos, conserva temporalmente el pase privado y permite continuar sin otra verificación. Volver a solicitar correo descarta ese pase; reenvío también, incluso si su resultado quedó incierto.
- Fondo, cancelación y salida del flujo abortan trabajo local, borran pase/datos y descartan respuestas tardías. Un aborto no promete deshacer el servidor. Si la verificación quedó incierta se pide nuevo código; si el cambio quedó incierto, se ofrece volver al login, no un segundoPOST automático.
- Stack nativo anidado, sin cambiar login/empresas. `ScreenFrame` extraído como componente compartido conserva el ajuste de altura explícita del logo. Espaciado denso de recuperación evita repetir mensajes; scroll queda para teclado/fuente grande/altura extrema.

## Comprobaciones

`npm test`, tipos/lint, pruebas de recurso y exportaciónAndroid/iOS. `npm run test:recovery:isolated` requiere Docker local y backend compilado (`BACKEND_DIR`, por defecto worktree1.5). Crea soloPG17/Redis7 nuevos con puertos loopback efímeros, usa Nest/Prisma/Argon2 y clienteTypeScript reales, y retira sus recursos. Ni lee perfiles ni envía email. Obtiene código de un outbox **sintético descifrado**, no de un correo capturado: no atribuir entregaSMTP ni ejecución nativa a esa evidencia.

**Estado operativo actual:** SQL008 y la API nueva fueron habilitados enDEV tras aprobación posterior, respaldo cifrado restaurado/ensayado y recibo atómico. SMTP conserva un único worker y SQL007/invitaciones sigue deshabilitado. El propietario confirmó que el flujo ya funciona tras probar Android y autorizó esta publicación. Es evidencia reportada por el propietario, no ejecución nativa instrumentada ni aceptación exhaustiva de iOS/accesibilidad. No sustituir un404 por validación fingida ni degradar al endpoint legado en otro entorno sin008.

Las pruebas automatizadas no envían correo real. Revisión exhaustiva de tamaño, teclado, TalkBack/VoiceOver y gestos sigue pendiente. Publicación autorizada posteriormente, sin merge automático.

### Resultado verificado

La implementación original pasó174 Jest,3 setup y5 pruebas del recurso de marca; tipos/ESLint y exportaciónAndroid/iOS correctos. La rama de publicación `feature/acceso-recuperacion-nativa` excluye los módulos/contratos/pruebas WIP de invitaciones, preservados en el checkout original; por ello su recuento de pruebas se informa separadamente al verificar esta selección. La regresión incluye tres vistas, error de código sin abrir contraseña, mínimo8 frente a7, incertidumbre sin repetirPOST, reenvío/429, respuestas tardías tras cancelación, fondo que elimina el pase y POP que limpia contraseñas sin secretos en navegación.

`test:recovery:isolated` pasó25 comprobaciones reales con clienteTypeScript/Nest/Prisma/PG17/Redis7. No es React Native ni SecureStore real; el código procede solo del fixture cifrado desechable, no de una captura SMTP. Dependencias: React Navigation/native-stack/screens y parches compatibles SDK58 aprobados; Expo58.0.26, SecureStore58.0.3, jest-expo58.0.15. El PR hacia `develop` depende de los antecedentes de autenticación/recuperación ya publicados y aún pendientes; no los integra automáticamente.

Selección final comprobada antes de publicar:138Jest/14suites,3setup,5assets,tipos/lint,25integradas usando el backend de publicación compilado y exportacionesAndroid/iOS correctos. El menor recuento frente al checkout original corresponde al WIP de invitaciones excluido, no a pruebas fallidas. Auditoría:27moderadas,0altas/críticas; sin auditfixforzado. `npm ci` reproduce las dependencias sin perfiles privados.
