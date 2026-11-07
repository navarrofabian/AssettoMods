# Assetto Corsa Mods: publicación en GitHub Pages

Esta carpeta es una versión independiente para publicar. La aplicación original y sus datos siguen en `../assetto-library`. GitHub Pages sirve archivos estáticos: la página pública permite consultar, buscar, filtrar y navegar las galerías. Los botones de descarga abren Drive; Google puede pedir inicio de sesión o confirmar archivos grandes. Los visitantes necesitan permiso de Drive para cada archivo; no se modifican permisos ni se publican automáticamente los archivos.

El catálogo, los nombres, los identificadores de Drive y las imágenes incluidas en esta carpeta serán públicos. No subas esta carpeta si no querés que esa información sea visible. Las portadas se optimizaron y copiaron, sin borrar las originales. Las dos cuentas administradoras pueden editar metadatos y portadas desde la web pública mediante Google y las reglas de Firebase; esos cambios no modifican los archivos de Drive. No hay subida pública de archivos de mods. La aplicación local actual permite subir imágenes, pero no implementa la subida de archivos de mods desde la web.

## Publicar

1. Creá un repositorio **público** en GitHub. No incluyas la carpeta `assetto-library` ni su carpeta `data`.
2. Subí el contenido de esta carpeta, incluida `.github`, a la rama `main`. No subas `node_modules`, `dist`, `.runtime`, archivos `.env` ni credenciales. El `.gitignore` los excluye al usar Git. Revisá lo que vas a publicar antes de confirmar.
3. En el repositorio, abrí **Settings → Pages → Build and deployment → Source → GitHub Actions**.
4. En **Settings → Secrets and variables → Actions → New repository secret**, creá estos cuatro secretos (copiá los valores directamente en GitHub; nunca en un archivo del repositorio ni en un mensaje):
   - `GOOGLE_CLIENT_ID`: propiedad `web.client_id` del archivo `client_secret…json` que descargaste de Google Cloud.
   - `GOOGLE_CLIENT_SECRET`: propiedad `web.client_secret` del mismo archivo.
   - `GOOGLE_REFRESH_TOKEN`: propiedad `refresh_token` del archivo `data/token.json` de la aplicación local original.
   - `DRIVE_ROOT_ID`: `1hy86MXbxl-ctKyhfetA4Dmdcn8J461Dt`.
5. En la pestaña **Actions**, elegí **Publicar biblioteca** y ejecutá **Run workflow**, seleccionando `main`. Verificá que termine correctamente. En **Settings → Pages** aparecerá la dirección pública. Abrila y probá búsqueda, portadas y un enlace de descarga con una cuenta autorizada en Drive.

Sin secretos se publica la copia actual, pero no se actualiza desde Drive. Si solo falta alguno, la publicación falla para evitar resultados incompletos. Las credenciales se usan solo en el proceso privado de GitHub Actions y no se copian al sitio. Un administrador del repositorio puede cambiar los procesos: compartí ese acceso solo con personas de confianza. Google puede revocar el permiso o la institución puede restringir la aplicación; en ese caso revisá el error de Actions y los permisos de Workspace.

## Actualizaciones

Cada cambio en `main`, ejecución manual o ejecución programada (aproximadamente cada 5 minutos) consulta Drive en modo lectura. GitHub puede retrasar o desactivar tareas programadas; no hay garantía de horario exacto. Las modificaciones manuales del catálogo publicado se conservan usando la copia del repositorio como base. Si falla la consulta, no se reemplaza la página anterior. No se borra ni modifica nada en Drive.

El botón «Sincronizar con Drive» del menú abre la ejecución manual en GitHub. Para iniciarla, hay que acceder a GitHub con una cuenta autorizada en el repositorio y elegir «Run workflow» y luego confirmar «Run workflow». La sesión de Google de la biblioteca no concede permisos de GitHub. La sincronización periódica funciona aunque no se use el botón.

Para publicar cambios de nombres, categorías o imágenes hechos después en tu PC: iniciá primero la biblioteca local, abrí una terminal en esta carpeta y ejecutá `npm install` y luego `npm run export:local`. Revisá los cambios en `snapshot` y subilos a `main`. Si los archivos se cambiaron en Drive pero no editaste metadatos o imágenes locales, no hace falta hacer esto: la tarea programada los detecta.

## Probar en la PC

Instalá Node.js 22 o posterior y ejecutá `npm install`, `npm test` y `npm run build`. La carpeta `dist` contiene la web lista para publicar. Servila mediante un servidor HTTP estático: abrir `index.html` directamente con doble clic no permite cargar el catálogo en todos los navegadores. Para volver a importar la biblioteca local, usá `npm run export:local` con el servidor original iniciado.

GitHub Pages y Actions tienen límites gratuitos y sus condiciones pueden cambiar. Para editar desde Internet o subir mods sin depender de la PC se necesitará un backend con almacenamiento persistente y acceso protegido; no hay una forma segura de proporcionar operaciones de escritura anónimas usando únicamente Pages.

## Favoritos compartidos en la web pública

La web admite una base **Firebase Realtime Database dedicada exclusivamente a favoritos**. No usa credenciales de Drive ni exige registro a los visitantes. La URL de la base es pública y no es una contraseña. Como no hay identificación, **cualquier visitante o programa puede agregar o quitar favoritos** y consumir la cuota; las reglas únicamente limitan el formato y las rutas accesibles. No guardes información privada en esa base. Si se necesita impedir cambios de terceros, habrá que agregar control de acceso.

1. Creá un proyecto de Firebase y una Realtime Database con el plan gratuito disponible. Si tu institución limita Firebase, puede hacer falta otra cuenta o autorización institucional.
2. En la consola de Realtime Database, abrí **Rules / Reglas**, copiá el contenido exacto de `firebase-favoritos.rules.json` y publicalo. La configuración por defecto bloquea el acceso hasta que se publiquen las reglas.
3. Copiá la URL HTTPS que aparece en **Data / Datos**, sin la barra final. En GitHub, abrí **Settings → Secrets and variables → Actions → Variables → New repository variable**. Creá `FAVORITES_DATABASE_URL` con esa URL. Es una variable pública de configuración, no un secreto.
4. En **Actions → Publicar biblioteca → Run workflow**, iniciá una publicación manual. Una vez terminada, abrí la web pública en dos dispositivos, marcá un mod como favorito y comprobá que aparece en el otro al recargar. Luego desmarcalo si era una prueba.

Los favoritos públicos y los de la versión local son independientes. El cliente público vuelve a consultar los cambios periódicamente. Si falla la conexión o las reglas rechazan una operación, la página muestra un error. Firebase aplica límites al plan gratuito y puede restringir el servicio si se exceden.

La sincronización también busca vistas previas en hasta tres mods recientes sin portada por ejecución. Lee únicamente fragmentos limitados del comprimido, optimiza las imágenes encontradas y conserva las portadas existentes. ZIP64, archivos cifrados, algunos RAR/7z sólidos y mods sin un archivo `preview` compatible pueden quedar sin portada. Los resultados se guardan en el repositorio público como imágenes optimizadas; los archivos originales no se modifican.
