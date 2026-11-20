# Bienvenida móvil — rediseño

Referencia del propietario: bienvenida verde con ilustración de tienda y botón «Comenzar». Confirmó conservar el logo oficial y luego aprobó una adaptación monocromática más sutil, sin sustituir la identidad.

## Implementación

- `App.tsx` muestra `WelcomeScreen` antes del acceso; «Comenzar» presenta el flujo existente. No modifica autenticación, recuperación, invitaciones, contexto empresarial ni backend.
- Actualización posterior: el acceso se rediseñó y migró a pila nativa; ya no expone invitaciones ni restauración alternativa. Ver [login y navegación](login-navigation-design.md), que prevalece para las rutas actuales. La bienvenida y la variante del logo se conservan.
- Usa exclusivamente la paleta de `src/theme.ts`. Fondo verde profundo, detalle esmeralda, textos claros y acción clara con foco ámbar.
- `assets/logo.png` permanece intacto. La bienvenida usa la variante autorizada `assets/logo-monochrome.png`, transparente y monocromática, con el lienzo/proporciones/composición del original; sin tarjeta blanca. Se tiñe con el token claro corporativo al85% para integrarla sobre el verde. El acceso rediseñado también usa la variante, teñida con verde profundo sobre fondo claro. No se adopta el logo alternativo del mockup.
- `StoreIllustration` es una decoración independiente con primitivas nativas, sin imágenes generadas, nuevas dependencias ni colores adicionales.
- Lema: «Automatiza tus ventas y la atención por WhatsApp». No promete IA generativa no implementada.
- Una sola bienvenida, sin indicadores ficticios de tres páginas ni temporizadores. Se muestra al montar la app, también si hay credenciales guardadas; no se persiste una marca de onboarding completado. La restauración continúa siendo explícita tras acceder.
- Contenido desplazable para pantallas pequeñas/texto ampliado; áreas seguras y barra de estado clara. Ilustración excluida del árbol accesible, logo identificado y botón con rol/estado/foco.

## Verificación

- TypeScript y ESLint correctos.
- 121 pruebas Jest y 3 de setup correctas. Incluye bienvenida inicial sin acceso a almacenamiento/health, transición a acceso y regresión del comprobador de backend. Son pruebas con mocks, no ejecución nativa.
- Exportación Expo Android e iOS correcta, a directorio temporal externo al repositorio. No acredita inspección visual ni accesibilidad nativa en un dispositivo.
- No se modificó el archivo del logo original, dependencias ni contratos. WIP previo de invitaciones preservado. Sin commit/push.

La adaptación se reproduce con `node scripts/prepare-monochrome-logo.cjs`, usando `pngjs` disponible en el árbol de desarrollo existente. Extrae cobertura de tinta verde/oscura y elimina el fondo casi blanco, conservando bordes suavizados, huecos y todo el lienzo; no sustituye una fuente vectorial. La comparación visual en dispositivo sigue pendiente. Pruebas de recurso: `node --test scripts/prepare-monochrome-logo.test.cjs`.

Después de la adaptación pasaron nuevamente tipos, ESLint, 121 Jest, 3 de setup y las 3 pruebas del recurso (transparencia/tinta, alpha original y reproducción exacta sin cambiar dimensiones). En esa entrega Android/iOS exportaron ambos assets correctamente. El rediseño posterior de login usa solo la variante monocromática en ejecución, conservando el archivo original en assets. Se inspeccionó una composición PNG del recurso sobre verde, no la interfaz en un dispositivo.

Pendiente revisión manual en Expo Go: disposición con pantalla pequeña y fuente ampliada, lector de pantalla, «Comenzar» y funcionamiento del acceso. iOS sin dispositivo no se declara probado.
