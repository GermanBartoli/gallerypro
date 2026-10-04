# Arquitectura

GalleryPRO usa Manifest V3 sin servidor ni dependencias de ejecución. La compilación reúne módulos JavaScript en una función aislada; no descarga ni ejecuta código remoto.

## Flujo

1. El usuario inicia el análisis desde un panel con Shadow DOM.
2. El adaptador toma el contexto de la cuenta activa y consulta exclusivamente las operaciones de lectura de álbumes, contenido de álbum y biblioteca.
3. El núcleo recorre las páginas, detecta cursores repetidos y reúne claves de pertenencia.
4. Las fotos de biblioteca se comparan por identificador y clave de equivalencia. Solo al finalizar todas las lecturas se habilitan los resultados definitivos.
5. El filtro y la galería utilizan el mismo índice en memoria.

## Separación

- **Integración:** sobres RPC, validación de respuestas y cuenta. Las únicas operaciones de red implementadas son `Z5xsfc`, `snAcKc` y `lcxiM`, de lectura aunque utilicen HTTP POST.
- **Núcleo:** no depende del DOM ni de Chrome. Inyecta un adaptador, señal de cancelación y callback de progreso.
- **Interfaz:** panel y diálogo propios; el filtro conserva dimensiones de la cuadrícula virtual de Google.
- **Preferencias:** script aislado con acceso a `chrome.storage.local`. Solo intercambia un booleano con la página.

El código principal se ejecuta en el contexto de la página para usar su sesión; ningún token se copia al almacenamiento de la extensión, al repositorio ni a los registros. Los errores visibles omiten respuestas privadas.

## Extensión futura

Las nuevas herramientas pueden reutilizar el adaptador y el índice. Las funcionalidades que escriban en Google Fotos requieren una decisión de alcance y permisos independiente; no forman parte de esta versión.
