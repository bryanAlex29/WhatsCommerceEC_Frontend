# WhatsCommerce EC · móvil

Cliente Android/iOS con Expo 58.0.23, React 19.3.0, React Native 0.88.1, Expo SecureStore 58.0.2 y TypeScript ~6.0.3 estricto. Node >=22.18.0 y npm; usar `npm ci` con el lock incluido.

## Alcance aprobado

Subfase 1.4: login, restauración **explícita**, selector paginado de empresas vinculadas, consulta empresarial mínima BASIC/FULL y logout. Componentes reutilizables aprobados de primitivas React Native con composición inspirada en shadcn, sin componentes web ni kit visual tercero, router o soporte web. Áreas seguras, teclado, etiquetas accesibles, foco y objetivos táctiles mínimos de 48 puntos. Paleta centralizada en `src/theme.ts`; logo oficial sin transformación en `assets/logo.png`, mostrado completo mediante `contain`, no como icono/splash.

Cobertura parcial de RF-01/RF-02, RNF-01/RNF-02 y mantenibilidad: el backend sigue siendo autoridad de identidad, pertenencia, permisos y estado. No hay CRUD de plataforma/usuarios, aceptación de invitaciones, productos, WebSockets ni otros módulos comerciales. No hay usuarios/empresas simulados en ejecución. Fuentes vigentes del workspace de contexto distribuido por separado: `../AGENTS.md`, `../docs/DERCAS.md` §16, `../docs/CONTRATO-DETALLADO-PROPUESTA.md` y `../docs/OPERACION-LOCAL-PROPUESTA.md`; solicitarlas si faltan. Publicación inicial autorizada en rama de trabajo y PR a `develop`, sin integración automática. **Ni pruebas simuladas ni cliente puro bajo Node acreditan aceptación nativa o cierre completo de los RF.**

## Estado de verificación antes de publicación

- Tipos/lint correctos; **66 pruebas Jest y 3 de setup** aprobadas. Incluye regresión explícita de contraseña con números enviada intacta, sin persistirla. Los números se permiten; se conservan las demás reglas aprobadas.
- El runner backend `npm run test:auth:real` pasó **21 casos reales PostgreSQL/Redis/API**, incluido este cliente `Session`/fetch bajo Node para login, paginación 20+2, BASIC, rechazo de empresa ajena y logout con revocación persistida. En ese caso únicamente el almacenamiento seguro se simula.
- Exportación Android/iOS y configuración Expo verificadas en la entrega anterior. **Pendientes:** ejecución de estas pantallas en dispositivo/emulador, SecureStore nativo, lector de pantalla y foco/contraste visual. La apertura histórica Android del bootstrap no acepta automáticamente estas pantallas nuevas.
- Auditoría de producción reportó cinco avisos moderados transitivos de Expo; no se aplicaron actualizaciones forzadas ni cambios de SDK.

## Configuración y ejecución

Desde este checkout, con Node >=22.18.0 y npm (verificados: Node 22.18.0/npm 10.9.3):

1. En una preparación nueva y sin servicios usando estas dependencias, ejecutar `npm ci`. Instala exactamente el lock; no sustituir por actualizaciones o `npm audit fix --force`.
2. Ejecutar `npm run setup:local`: copia `.env.example` a `.env` **solo si no existe**, sin sobrescribirlo ni iniciar servicios. No requiere dependencias adicionales. Revisar manualmente `EXPO_PUBLIC_API_URL` en `.env` (base HTTP(S), sin `/api`, credenciales, consulta ni fragmento). El ejemplo usa Android Emulator; no detecta automáticamente tu plataforma/red ni cambia variables del proceso.
3. Solo si no hay Metro activo y el responsable de servicios lo autoriza: `npm start`. Para abrir la plataforma se puede usar `npm run android` o `npm run ios` en lugar de ese comando; no iniciar varios Metro. Si ya está activo, reutilizar su QR/URL y coordinar cualquier reinicio con su responsable.

- Android Emulator: `http://10.0.2.2:3000`.
- iOS Simulator (requiere macOS/Xcode): `http://localhost:3000`.
- Dispositivo físico: `http://IP_LAN_DEL_EQUIPO:3000`; compartir red, permitir puerto 3000 en firewall y hacer accesible el servidor en LAN. `localhost` en el teléfono apunta al teléfono, no al equipo.
- Cambiar `.env` no reconfigura un Metro ya activo: coordinar un **reinicio explícito** del proceso Expo y recargar la app (si hay caché obsoleta, iniciar de nuevo con `npm start -- --clear`, después de detener el anterior). No hay URL predeterminada silenciosa: falta de configuración produce error al comprobar. No usar `NODE_ENV` para seleccionar direcciones; definir `EXPO_PUBLIC_API_URL` explícitamente para cada entorno.
- Toda variable `EXPO_PUBLIC_*` se incorpora al bundle: **no es secreta**. No colocar tokens ni credenciales. HTTP es solo para desarrollo local; entornos publicados requieren HTTPS y configuración nativa aprobada.
- Para LAN, reemplazar `IP_LAN_DEL_EQUIPO` por la dirección actual del equipo backend (puede cambiar). El backend y Metro deben ser alcanzables desde el teléfono; evitar redes invitadas/aislamiento Wi-Fi. La URL de Metro (puerto 8081 normalmente) no es la URL API (puerto 3000 en desarrollo). No cambiar firewall ni arrancar backend desde este checkout sin autorización.
- `.env`, `.env.*` salvo `.env.example`, `node_modules/`, `.expo/`, `dist/` y `coverage/` se ignoran en Git. Comprobar con `git check-ignore -v .env .env.local node_modules/ .expo/ dist/ coverage/`; `.env.example` debe permanecer versionable.

## Contrato técnico consumido

API centralizada en `src/api/client.ts`; tipos y validadores de frontera en `src/api/contracts.ts`, derivados del contrato compartido (no un contrato alternativo). `EXPO_PUBLIC_API_URL` es el origen **sin `/api`**. Se consumen exclusivamente:

- `POST /api/auth/login` con `{email,password}` y `POST /api/auth/refresh` con `{refreshToken}` → `200 SessionTokens` exacto.
- `POST /api/auth/logout` con `{refreshToken}` → `204`, sin depender de access vigente.
- `GET /api/auth/me` → `UserSelf`; `GET /api/me/companies?cursor=...` → páginas hasta 20, `items` y `nextCursor`.
- `GET /api/companies/{companyId}` → representación discriminada BASIC/FULL completa. Identificador solicitado en ruta, sin cabecera/body empresarial paralelo.

El selector ofrece «Cargar más empresas» hasta `nextCursor: null`; un cursor inválido elimina las páginas y reinicia una sola vez. Empresa ajena/inexistente tiene el mismo mensaje genérico. Estados bloqueados conservan la identidad, no la vista empresarial. Permisos no se deducen de JWT ni del selector. Foco de app revalida el contexto; al pasar a segundo plano se elimina la representación empresarial. No se promete detección instantánea de suspensión/revocación.

### Sesión y seguridad

`src/auth/session.ts` es el único propietario de credenciales y datos privados, con adaptador seguro inyectable. Access solo en memoria; **solo refresh** se persiste en SecureStore, nunca AsyncStorage, contraseñas, permisos o datos empresariales. Guardado seguro antes de publicar sesión; fallo de guardado no presenta sesión válida. Opciones iOS `WHEN_UNLOCKED_THIS_DEVICE_ONLY`; sin biometría añadida. La documentación oficial [SecureStore SDK58](https://docs.expo.dev/versions/latest/sdk/securestore/) recomienda ~58.0.2 y soporta Android/iOS. El módulo fijado se incorporó con `EXPO_NO_DOTENV=1 npx expo install expo-secure-store@58.0.2 --npm`; el plugin configura exclusión del backup Android. Keychain iOS puede sobrevivir reinstalación: no restaurar automáticamente ni asumir logout por desinstalación. Compatibilidad estática comprobada; cifrado y comportamiento real del sistema aún requieren dispositivo.

- Restauración solo al pulsar su acción. Sin refresh seguro se pide login; no hay permisos/cachés persistidos que restaurar.
- Renovación single-flight únicamente ante `401 ACCESS_TOKEN_EXPIRED`; GET se repite como máximo una vez. Login/refresh/logout nunca se reproducen automáticamente; `403/404/409` no renuevan. Incertidumbre solicita login, limpia e intenta revocar sin prometer éxito remoto.
- Se validan DTO completos, claves desconocidas/faltantes, formatos de tokens/fechas/UUID y discriminante. La firma/claims JWT, autorización y vigencia de 15 minutos/7 días absolutos corresponden al servidor; el móvil no extiende vencimientos ni autoriza mediante claims.
- Almacenamiento/logout serializados, AbortSignal y generaciones de sesión/contexto impiden repoblar datos con respuestas antiguas. FULL→BASIC siempre reemplaza, nunca fusiona datos fiscales. Una respuesta de credenciales tardía intenta revocarse sin volver a persistirla.
- Logout elimina primero memoria/contextos y borra SecureStore aun si falla red; revoca con token actual/guardado, incluido histórico reconocido por servidor. Si falla el borrado nativo, se advierte y se bloquea restauración/login hasta un nuevo borrado explícito. No se puede garantizar borrado físico si falla el sistema operativo.
- Mensajes en español propios, nunca excepción/cuerpo privado del servidor; sin tokens en logs/URL ni cookies. Límite de espera de API: 15 segundos, sin reintentos de red automáticos. IDNA y reglas finales del login se validan en backend; la contraseña no se transforma ni se vuelve a exigir la composición de contraseña nueva.

Las entradas de contraseña admiten números y los envían intactos. Para contraseña nueva,
el backend mantiene 15–128 caracteres, mayúscula y símbolo, sin espacios/controles/invisibles;
los números están permitidos, no exigidos. Esta aclaración no modifica credenciales guardadas.

### Área técnica pública preservada

`GET {EXPO_PUBLIC_API_URL}/api/health`, sin cuerpo ni credenciales de sesión. Respuesta exitosa JSON aprobada:

```json
{ "status": "ok", "service": "whatscommerceec-backend" }
```

El cliente valida ambos valores en ejecución, rechaza HTTP no exitoso/JSON inválido/contrato distinto y limita toda la operación a 5 segundos con cancelación. No presupone formato de errores del servidor ni muestra su cuerpo. Sin reintentos automáticos. El botón bloquea solicitudes simultáneas; estados inicial/carga/error/última comprobación exitosa, nunca falso «conectado» permanente. No realiza peticiones al abrir la app.

## Verificación

```sh
npm run typecheck
npm run lint
npm test
.\node_modules\.bin\expo.cmd install --check
npx expo-doctor
npx expo export --platform all --max-workers 1
```

El comando local de Expo mostrado es para PowerShell/Windows; en macOS/Linux usar `./node_modules/.bin/expo install --check`. Doctor puede requerir red y descargar su herramienta mediante npx; no aplicar correcciones/actualizaciones automáticamente. Para configuración pública aislada: `npm run test:setup` (también incluido en `npm test`), que prueba copia exacta, idempotencia, no sobrescritura y plantilla ausente sin tocar el `.env` real.

Jest se ejecuta en serie. Las pruebas de cliente/configuración/pantalla usan **simulaciones explícitas** de fetch, health, SecureStore, sesión/empresas y áreas seguras; no acreditan integración real ni ejecución nativa. `jest.config.js` resuelve el core interno desde Expo para no instalarlo directamente. La exportación genera bundles Android/iOS en `dist/`, no binarios instalables ni prueba en emulador/dispositivo. La respuesta de Metro/manifiestos Expo Go tampoco demuestra ejecución nativa: hace falta Expo Go compatible con SDK 58 en cada plataforma (iOS Simulator requiere macOS/Xcode); si el cliente disponible no admite ese SDK, coordinar una alternativa aprobada, no degradar dependencias silenciosamente.

La auditoría completada durante el bootstrap reportó 38 avisos transitivos; `npm audit --omit=dev` reportó cinco moderados en la cadena Expo CLI/fingerprint/glob/minimatch. La propuesta automática de npm implica bajar a Expo 52, incompatible con este SDK, por lo que no se aplicó. Esto no acredita ausencia de riesgo: revisar antes de distribución, sin `npm audit fix --force` ni overrides no evaluados. Quedan pendientes UI móvil con backend real, Android e iOS en dispositivo/emulador, lector de pantalla y aceptación funcional.

En el workspace coordinado, `npm run integration:workspace` desde `../WhatsCommerceEC_Adminweb` comprueba este cliente TypeScript puro contra NestJS real bajo Node. Requiere los checkouts preparados y el backend compilado; no ejecuta la pantalla ni acredita conectividad desde un dispositivo. Las solicitudes de health omiten expresamente credenciales.

Evidencia histórica del bootstrap: 23 pruebas unitarias aprobadas, tipos/lint correctos y exportación Android/iOS regenerada tras el ajuste de credenciales. La prueba integrada del cliente puro contra NestJS también pasó; no implica aceptación nativa ni de RF empresariales.

### Subfase 1.2 · verificación técnica (5 de noviembre de 2026)

- Node 22.18.0/npm 10.9.3; `npm ls --depth=0` sin dependencias faltantes, manifiesto y lock v3 coherentes. No se cambiaron dependencias ni se reinstalaron paquetes con Metro activo.
- Expo CLI local `install --check`: dependencias actualizadas; `npx --yes expo-doctor`: 20/20 comprobaciones correctas. Esto verifica el conjunto instalado, no garantiza compatibilidad de cualquier versión de Expo Go distribuida en las tiendas.
- `npm run typecheck`, `npm run lint` y `npm test`: correctos (23 pruebas Jest simuladas + 3 pruebas de setup con archivos aislados). `git diff --check` e ignorados de entorno/dependencias/exportaciones comprobados; `.env.example` no está ignorado.
- Metro ya activo en 8081: `/status` responde `packager-status:running`. Manifiestos solicitados con `expo-platform: android` y `ios`: HTTP 200, SDK `58.0.0`, URLs de bundle para ambas plataformas, accesibles desde este equipo tanto por loopback como por LAN. No se descargaron/ejecutaron bundles nativos en esta subfase.
- No se inició, detuvo ni reinició ningún servicio. `setup:local` no se ejecutó sobre el checkout real y no se creó `.env`: se preservó la configuración del Metro activo, gestionado por el coordinador. El procedimiento queda disponible para una preparación nueva o un cambio de entorno coordinado.
- No se repitieron aquí la exportación ni integración HTTP con backend; tampoco hubo emulador, simulador o dispositivo físico. Quedan pendientes ejecución Android/iOS, conectividad desde el teléfono, accesibilidad y aceptación funcional futura.

Después de la revisión del especialista, el coordinador ejecutó `setup:local` una vez sobre el checkout y configuró únicamente la URL pública LAN en el nuevo `.env` ignorado. El proceso Expo existente ya usaba esa misma URL, por lo que no se reinició. El ejemplo versionable sigue orientado a Android Emulator; ajustar la URL local cuando cambie la red o plataforma. Las ejecuciones posteriores de setup deben preservar esta configuración.

### Subfase 1.4 · cliente de acceso y contexto (6 de noviembre de 2026)

- `npm run typecheck`, `npm run lint`, `npm test`: 63 pruebas Jest y 3 de setup; verificación automatizada de DTO, formulario/selección, contraseña protegida, fallo de credenciales, restore explícito, refresh single-flight, no replay de escrituras, expiración/revocación, fallo de almacenamiento, logout/red, carreras de guardado/logout/login, contexto tardío, foco, FULL→BASIC y cursores. Fixtures exclusivamente sintéticos; no datos/cuentas reales.
- Expo `install --check`: dependencias compatibles; Expo Doctor: 20/20. Exportación Android/iOS correcta y logo original. SHA-256 del asset coincide con el recurso fuente. No se adaptó ni recortó el logo.
- Comandos Expo ejecutados con `EXPO_NO_DOTENV=1`; exportación con `EXPO_PUBLIC_API_URL=http://localhost:3000` solo en el proceso para no leer configuración privada. No se inició/reinició Metro de desarrollo, backend ni base de datos; el bundler de exportación es una comprobación de compilación.
- Instalación informó 31 avisos totales (1 bajo, 30 moderados); auditoría explícita posterior `npm audit --omit=dev`: 5 moderados transitivos existentes, salida 1. Sin correcciones masivas ni cambios de SDK.
- Pendiente integración real contra backend preparado y autorizado, con cuentas sintéticas autorizadas; Android/iOS en dispositivo/emulador, persistencia/backup nativos, lector de pantalla, contraste/foco visual y conectividad real. Ninguna prueba API real, SQL, cuenta, pago, publicación ni funcionalidad fuera del alcance fue ejecutada.

Verificación final del coordinador: tipos/lint correctos, **65 Jest + 3 setup aprobadas** y
exportación Android/iOS correcta, sin leer `.env`. Regresiones adicionales: reloj del
dispositivo desfasado no sustituye vigencia autorizada por servidor; refresh no puede
cambiar el vencimiento absoluto recibido. El foco de entrada usa verde profundo y borde
de 4 puntos con contraste calculado ≥3, sin añadir colores; se mantiene pendiente su
verificación visual nativa. Logo comprobado idéntico al original por SHA-256.
