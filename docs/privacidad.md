# Privacidad

GalleryPRO analiza datos de Google Fotos solamente cuando se pulsa **Analizar biblioteca** o **Actualizar análisis**.

- Los resultados permanecen en memoria de la pestaña y se descartan al recargar, cerrar o cambiar de cuenta.
- Se persiste únicamente un booleano: la preferencia de ocultar fotos con álbum.
- No se leen contraseñas ni se solicitan claves API.
- La sesión existente autoriza consultas a Google Fotos. Las miniaturas se cargan desde servidores de Google.
- No existen servidores de GalleryPRO, estadísticas de uso, rastreadores ni transferencias a terceros adicionales.
- No se accede a la carpeta privada, papelera ni archivo.
- El código público y las pruebas contienen únicamente datos ficticios.

El permiso `storage` guarda preferencias locales. Los scripts se ejecutan exclusivamente en `https://photos.google.com/*`; no se solicita acceso general al historial, cookies ni otras páginas.

Desactivar la extensión y recargar Google Fotos elimina los controles y cualquier efecto visual del filtro.
