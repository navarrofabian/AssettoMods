# Edición de la biblioteca publicada

La edición web requiere Firebase Authentication con Google habilitado, `navarrofabian.github.io` como dominio autorizado, la clave de API de la app web en la variable de GitHub `FIREBASE_WEB_API_KEY` y las reglas de `firebase-admin.rules.json` publicadas en Realtime Database. La clave de API web identifica el proyecto y será pública; nunca se debe publicar una clave privada o un token de servicio.

Las reglas permiten escribir ediciones únicamente a las dos direcciones verificadas y con proveedor Google incluidas en ellas. Los visitantes pueden consultar las ediciones y las portadas; los favoritos siguen siendo editables públicamente como antes. Las ediciones se superponen al catálogo estático y no modifican archivos originales de Drive. La edición de portadas desde la web pública todavía no está implementada.

Antes de activar las reglas, probalas en la zona de pruebas de Firebase: escritura anónima denegada en `libraryEdits`, cuenta distinta denegada, y las dos cuentas autorizadas permitidas. No se deben reemplazar las reglas vigentes hasta conservar su sección `favorites` y comprobar que la sintaxis se acepta. Después se debe comprobar el inicio de sesión y las ediciones reales desde dos navegadores, el comportamiento de una cuenta no autorizada, los favoritos y las portadas existentes.
