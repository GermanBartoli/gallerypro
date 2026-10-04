# Verificación de la versión 0.1.0

## Automatizada

Se ejecutaron `npm test` y `npm run build` con éxito. Las pruebas cubren clasificación conservadora, equivalencias entre álbum y biblioteca, álbumes compartidos, deduplicación, varias páginas, respuestas terminales con cursor vacío u omitido, errores parciales, cancelación, paginación repetida, bibliotecas vacías, dominios de miniaturas y cambio de cuenta durante una solicitud.

## Google Fotos real

Se probó el código compilado en una sesión autenticada mediante las herramientas de desarrollo del navegador integrado:

- Lectura paginada de álbumes y biblioteca hasta su finalización.
- Correspondencia de identificadores con los enlaces de la cuadrícula.
- Cancelación y posterior actualización del análisis.
- Galería con resultados completos y miniaturas cargadas desde Google.
- Apertura del original de una foto de la galería.
- Ocultación al cargar fotos mediante desplazamiento y desactivación del filtro.
- Manejo de errores de integración sin declarar resultados completos.

Las pruebas no modificaron fotos ni álbumes. No se publican capturas, identificadores, cantidades ni respuestas de la biblioteca utilizada.

## Pendiente de comprobación manual

La automatización no permite abrir `chrome://extensions`. La carga del paquete mediante **Cargar descomprimida** y la persistencia real de preferencias de Chrome deben verificarse manualmente. La prueba del código compilado dentro de Google Fotos no sustituye esa verificación de instalación.

El cambio de cuenta durante una solicitud está cubierto con datos ficticios; no se realizó una prueba manual completa cambiando de cuenta con la extensión instalada. También queda pendiente comprobar una galería real de más de 100 resultados.

## Comprobación manual de instalación

1. Compilar y cargar `dist` desde `chrome://extensions`.
2. Recargar Google Fotos y confirmar la aparición del panel sin inyección manual.
3. Activar el filtro, recargar y comprobar que la preferencia se conserva, pero el análisis debe iniciarse de nuevo.
4. Analizar, abrir la galería y desactivar el filtro.
5. Cambiar de cuenta y comprobar que ningún resultado anterior permanece disponible.

## Versión 0.3.0 preliminar

Se verificaron 13 pruebas automáticas, compilación y lectura completa de una biblioteca real desde el navegador integrado. La nueva interfaz se probó mediante un canal local de prueba; el panel nativo instalado y su comportamiento al cambiar de pestaña requieren validación manual en Chrome. La Release se publica como preliminar hasta completar esa comprobación.
