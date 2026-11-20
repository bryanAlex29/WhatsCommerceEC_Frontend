# Login y navegación nativa — rediseño aprobado

## Decisión actual del propietario

Se aprobó React Navigation/native-stack y sus dependencias compatibles con Expo. El propietario pidió quitar las invitaciones del acceso: **el único inicio de sesión visible es correo y contraseña proporcionados por el administrador**. No hay Google, redes sociales, registro público, enlace de invitaciones ni creación de cuentas desde el móvil.

La recuperación de contraseña se conserva. No se incorpora «Recordarme» ni se ofrece restaurar una sesión como otro acceso: al abrir la app se presenta bienvenida/login y no se lee/renueva automáticamente el refresh guardado. Se mantienen el refresh seguro durante una sesión iniciada, las comprobaciones del servidor, el borrado local/logout y la política de no guardar contraseñas.

Este cambio sustituye **la interfaz** de restauración/invitaciones anterior. No elimina tablas, datos, contratos ni módulos del backend, que siguen pausados; tampoco implementa un nuevo sistema de alta administrativa por inferencia. Los módulos móviles de invitaciones y sus pruebas previas se conservan como WIP aislado, **sin importación de su pantalla ni ruta en la aplicación**. Su eliminación completa y el aprovisionamiento administrativo del producto requieren una revisión funcional separada del DERCAS. La documentación anterior de1.5 es evidencia histórica, no una función disponible en este login.

## Composición visual

- Fondo corporativo claro en una superficie con esquinas superiores redondeadas y marco verde profundo.
- Logo oficial en su variante monocromática autorizada; no se adopta otra marca ni se modifica el archivo original.
- Ajuste posterior de espaciado: el login usa `logo-monochrome-compact.png` (1454×435), que elimina únicamente márgenes transparentes del derivado. Conserva todos los píxeles visibles y proporciones del dibujo. Se adapta al ratio del recurso, ancho máximo280 y separación efectiva de12 antes del título; la bienvenida conserva su variante de lienzo completo. No se cambia navegación/autenticación. Regresión:129 Jest,3 setup,5 pruebas del recurso, tipos/lint y exportaciones Android/iOS correctos; revisión visual en dispositivo pendiente.
- Ajuste adaptable posterior: el logo sube al retirar la fila de retorno superior (ahora al final); tamaños, columnas y separaciones responden a la ventana y escala de fuente. Ver [adaptación móvil](responsive-mobile.md), que detalla el alcance y las pruebas sin prometer todos los dispositivos.
- Título «Iniciar sesión», campos de correo/contraseña etiquetados, iconos con primitivas nativas, mostrar/ocultar contraseña, recuperación y botón «Ingresar».
- La acción principal usa esmeralda con texto claro grande de20 en negrita. Foco ámbar con contorno verde profundo adicional para no depender de ámbar sobre fondo claro.
- Sin datos de ejemplo prellenados; inputs y controles se bloquean durante el envío. La contraseña se envía intacta y se limpia al enviar, salir de la pantalla o pasar a segundo plano. La visibilidad vuelve a oculta.
- Diagnóstico de backend separado bajo «Comprobar conexión», no mezclado dentro del formulario ni solicitado automáticamente. No cambia el contrato REST.
- Contenido desplazable, teclado/áreas seguras y objetivos de pulsación de al menos48 puntos. Foco ámbar; etiquetas/estados accesibles. La revisión de contraste, fuente ampliada, lector y layout en dispositivo sigue siendo manual pendiente.

## Navegación y retroceso

Dependencias añadidas: `@react-navigation/native@7.5.2`, `@react-navigation/native-stack@7.21.1` y `react-native-screens~4.30.1` seleccionado por `expo install` para SDK58. Se reutiliza SafeArea existente. No se añade otro kit visual, Router web, WebView, reanimated ni gesture-handler.

- Invitado: **Bienvenida → Login → Recuperación/Diagnóstico**.
- Autenticado: **Empresas → Empresa** y diagnóstico separado.
- Pila nativa con `gestureEnabled`: deslizamiento de retroceso en **iOS**; en **Android**, retroceso del sistema según la configuración de botones/gestos del dispositivo. No se promete un pan personalizado de pantalla completa ni validación de predictive back.
- Al iniciar sesión se reemplaza la pila pública; volver no muestra login detrás del espacio autenticado. Logout/invalidez retira las rutas privadas y vuelve al login limpio. No se almacenan estados de navegación ni secretos en params, URLs o logs.
- POP de empresa limpia/invalida contexto y peticiones pendientes sin cerrar la sesión. Una respuesta tardía no devuelve una empresa descartada. No se agrega autoridad local ni se modifica aislamiento multiempresa.
- Durante un login pendiente se bloquea la salida (`usePreventRemove`/gesto deshabilitado) para no aceptar una respuesta después de abandonar intencionalmente el acceso. Ese bloqueo se conserva al pasar a segundo plano. Al confirmar o fallar vuelve a estar disponible.
- Recuperación se desmonta al retroceder por botón o POP nativo: su `dispose` cancela trabajo local y borra campos al retirar la pantalla; no promete deshacer una operación que el servidor pudo haber confirmado.

El uso de estados condicionales y claves de pila evita conservar historial privado. Un problema hallado en las pruebas hizo que logout volviera a bienvenida por `initialRouteName` capturado: se corrigió remontando el navegador al cambiar de rama de autenticación. Otra guarda evita que la limpieza de una pantalla de empresa libere el bloqueo del logout antes de borrar SecureStore.

## Verificación y límites

Las pruebas usan el navegador/router real y vistas nativas, API y almacenamiento simulados. Las acciones POP verifican el historial y limpieza, **no ejecutan un gesto físico en Android/iOS**. Incluyen ida/vuelta de recuperación, diagnóstico, login pendiente/doble envío, fallo, separación de historial, POP empresarial y logout con almacenamiento demorado.

Resultado final: **129 pruebas Jest (14 suites)**, **3 de setup** y **3 del recurso de marca**, todas correctas. Typecheck, ESLint y `git diff --check` correctos. Exportaciones Android/iOS con el stack nuevo correctas, sin atribuirles ejecución en dispositivos. Metro activo sirvió el bundle Android nuevo porHTTP200; `/status` de Expo y `/api/health` de la API anterior respondieron200 en la IP LAN existente. No se reiniciaron servicios, no se migró SQL ni se hicieron commits/push.

Auditoría de dependencias: el entorno resultante reportó29 vulnerabilidades moderadas, ninguna alta/crítica; la revisión del lock anterior reportó28. La diferencia de paquetes señalados es `eslint-config-expo` dentro de herramientas ya existentes, no una alerta directa de React Navigation/screens. No se ejecutó `npm audit fix` ni una degradación de Expo/Jest sugerida por el auditor. Esta evidencia no equivale a una auditoría de seguridad completa.

`expo install --check` detectó recomendaciones de parches para dependencias **ya existentes**: Expo58.0.23→~58.0.26, SecureStore58.0.2→~58.0.3 y jest-expo58.0.14→~58.0.15. No se aplicaron automáticamente ni se presentó ese chequeo como aprobado; la versión de screens fue seleccionada por Expo y no quedó señalada. Revisar esas actualizaciones en una tarea separada, sin atribuirles un fallo nativo observado.

Fuentes oficiales revisadas:
- https://reactnavigation.org/docs/native-stack-navigator/
- https://reactnavigation.org/docs/testing/

Pendiente en dispositivo: entrar con credenciales propias sin compartirlas por chat; probar teclado/texto ampliado, mostrar/ocultar, recuperación, gesto/botón de retroceso, cambio de empresa, fondo/regreso y logout sin recuperar pantallas privadas. iOS sin dispositivo no se declara aceptado.
