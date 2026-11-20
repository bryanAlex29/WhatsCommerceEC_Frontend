# Adaptación de pantallas móviles

El propietario pidió subir el logo del login y que la interfaz se ajuste a distintos tamaños. Alcance aplicado: **pantallas móviles actuales** (bienvenida, login, recuperación, empresas, detalle y diagnóstico). No modifica AdminWeb, backend, cuentas ni datos.

## Reglas comunes

- `src/layout.ts` centraliza medidas desde `useWindowDimensions`: responde a cambios de ventana/orientación/tamaño de fuente, sin detectar un modelo de teléfono.
- Modo compacto con altura inferior a720, ancho inferior a360, ventana horizontal o `fontScale >1.25`. Reduce espacios e ilustraciones, no fuerza los textos a caber ni deshabilita su escalado.
- Padding lateral16/24/32, columnas centradas acotadas a480 en teléfonos y560 en ventanas amplias. El ancho del logo nunca supera el disponible. No se estiran formularios a todo el ancho de una tablet.
- Marcos comunes de área segura, contenido desplazable y adaptación al teclado. Cuando el contenido no cabe —especialmente con teclado, orientación horizontal o letra ampliada— se permite **scroll**; no se ocultan campos ni se reduce el texto hasta hacerlo ilegible.
- Botones con alturas mínimas, texto centrado y adaptable; tarjetas con padding compacto. Los controles no dependen de posiciones absolutas de un teléfono concreto. Las posiciones absolutas de la tienda siguen siendo una ilustración decorativa interna, no layout de formularios.
- Mostrar/ocultar contraseña usa un ojo con área táctil48×48 y etiquetas accesibles, evitando que un texto «Mostrar» ampliado desplace el input. El símbolo decorativo @ mantiene su tamaño de icono; el contenido de usuario conserva escalado normal.

## Logo y navegación

### Corrección tras capturas reales del login

El propietario mostró que el login requería dos capturas, con un bloque vacío enorme en la marca. Eso **no cumplía** el diseño solicitado. Causa: `Image` de React Native antepone las dimensiones intrínsecas del PNG; declarar ancho/aspectRatio sin altura explícita conservaba los435 puntos de altura del recurso. Las pruebas de reglas y renders anteriores no medían Yoga ni detectaron ese fallo.

El login ahora asigna **ancho y altura explícitos**,200×~60 en compacto o240×~72 normal, usando metadatos reproducibles del recurso. La regresión compone la altura intrínseca435 con los estilos y exige que prevalezca la altura menor a80, manteniendo la proporción. El script de marca genera también el JSON de dimensiones; las pruebas lo contrastan con el PNG.

Se compactaron separaciones y campos (targets48+), se dejó una sola explicación de credenciales en el subtítulo y se agruparon «Comprobar conexión»/«Volver a bienvenida» en una fila. **El login normal, sin teclado y con fuente habitual, debe entrar en una vista**; scroll queda como salvaguarda para teclado, errores adicionales, letra ampliada o ventanas de altura extrema, no para compensar espacios vacíos.

Regresión169 Jest+3 setup+5 recurso, tipos/lint correctos. Falta confirmar visualmente la nueva disposición en el teléfono de las capturas; los renders de Jest no acreditan esa revisión física.

Se quitó la fila superior de retroceso del login, que consumía48 más su separación antes del logo. La marca ahora comienza arriba dentro del área segura, con padding superior4/8. **«Volver a bienvenida» está al final**, no se elimina: botón, gesto iOS y retroceso Android conservan el mismo navegador y sus bloqueos de seguridad.

El login mantiene su recurso compacto completo, con máximo200 en modo compacto/240 normal y proporción del archivo, siempre con altura explícita. La bienvenida ajusta logo, título e ilustración según espacio disponible. No se modifica ningún píxel de los logos en esta tarea.

`app.json` deja `orientation: default` en vez de bloquear vertical e incluye `ios.supportsTablet: true`. La rotación depende también del bloqueo de orientación del dispositivo; el comportamiento de un binario independiente requiere reconstruirlo con esta configuración. Expo Go usa su propio contenedor nativo: no se atribuye una prueba iPad ni una validación nativa a una exportación.

## Verificación

- Matriz de reglas con diez ventanas:240×320,320×568,360×640,390×844,430×932,568×320,844×390,768×1024,1024×768 y1280×800; escalas1/1.5/2. Son comprobaciones de presupuestos/ancho/espaciado, no medición del motor visual nativo.
- Renders de login con cuatro ventanas/fuentes simuladas, conservación de campos y ocultamiento al cambiar medidas, bienvenida/recuperación compactas y datos BASIC/FULL con fuente grande en horizontal. No se simula que una autorización BASIC permita mostrar FULL.
- Regresión de navegación verifica también el botón de retorno movido al final. No se modifica la política de inicio de sesión por credenciales ni se añaden invitaciones.

Resultado de la corrida final: **169 pruebas Jest**,3 de setup y5 del recurso de marca correctas; tipos, ESLint y `git diff --check` correctos. La configuración resuelta de Expo confirmó orientación`default` y soporte tablet iOS. Exportaciones Android/iOS correctas. No se añadieron dependencias ni se publicaron cambios. Estas comprobaciones no certifican tamaños de píxeles reales, teclado físico/virtual ni gestos nativos.

Pendiente de revisión física: pantallas pequeñas/tablets reales, giro, pantalla dividida, teclado, zoom de fuente/lector de pantalla, scroll hasta la acción principal y gestos. No es posible acreditar literalmente todos los dispositivos existentes mediante esta matriz.
