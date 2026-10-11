# TRANSMISSION · Archivo musical personal

Repositorio publicado en https://salempro123a-sudo.github.io/

## Diseño

La identidad gráfica procede de la primera versión editorial inspirada en la composición de NTS Radio (recuperable en Git history desde el commit `1da6e7b8b69bab262d7ea4590db678709e7f7eb5`). No debe sustituirse por un reproductor genérico: conservar la portada, la barra superior, la columna de mixtapes, las tarjetas, el bloque abstracto, las colecciones y el cierre editorial.

## Implementación

- `index.html`: página principal y estructura visual.
- `spotify-auth.js`: inicio de sesión mediante Authorization Code con PKCE, permisos mínimos y renovación de token. Por ser una aplicación estática, se guarda la sesión de Spotify en el almacenamiento local del propio navegador; una vulnerabilidad XSS podría exponerla. No se guarda ninguna credencial en GitHub.
- `spotify-editorial.js`: fuentes separadas para la colección pública del propietario y la reproducción privada de cada visitante; carátulas, búsqueda, playlists, estación de canciones, reproducción por SDK.
- `spotify-controls.js` y `spotify-controls.css`: controles de volumen, transporte, cola, dispositivos, repetición, aleatorio, progreso y diagnóstico.
- `musica.html`: única página de retorno OAuth; no es una página musical alternativa.
- `featured.json`: selección pública autorizada; mientras tenga `status: pending_authorization`, la web **no** puede mostrar canciones reales del propietario a usuarios sin sesión.

## Publicar las carátulas del propietario sin exigir inicio de sesión a los visitantes

1. Abrir https://salempro123a-sudo.github.io/ y conectar con Spotify Premium mediante el botón oficial.
2. La cuenta principal tendrá un control discreto en la sección final de la web: **PREPARAR PORTADA PÚBLICA**.
3. Revisar la información que se compartirá. Se incluyen canciones y artistas principales, y únicamente playlists marcadas públicas en Spotify. Las escuchas recientes son opcionales y están desactivadas por defecto.
4. Descargar el archivo `featured.json`. Entregarlo para sustituir el `featured.json` del repositorio mediante un commit a la rama `main`.
5. Los invitados sin cuenta verán el archivo de metadatos público. Para escuchar dentro de nuestra web, deberán autorizar su propia cuenta Premium.

**Importante:** jamás incluir refresh tokens, access tokens, Client Secrets ni credenciales en `featured.json`. El archivo generado contiene solo metadatos musicales destinados a ser públicos.

## Lo que todavía requiere infraestructura

GitHub Pages es alojamiento estático. No puede leer en segundo plano la cuenta del propietario cuando este tiene la web cerrada. Para hacer que «Estoy escuchando ahora» se actualice automáticamente para visitantes sin cuenta, hace falta una función programada en un servicio seguro externo que refresque una autorización del propietario y publique *solo* la información aprobada (no tokens). La instalación y la autorización de ese servicio **no están activadas** en este proyecto.

La API de Spotify de las aplicaciones nuevas no permite acceder a las recomendaciones algorítmicas antiguas, análisis de audio ni letras completas. Para mostrar letras dentro de la web necesitaríamos derechos de un proveedor licenciado, como Musixmatch; no reutilizar interfaces internas o no oficiales de Spotify.

## Pruebas antes de declarar finalizada la reproducción

- Confirmar Redirect URI exacta `https://salempro123a-sudo.github.io/musica.html` en Spotify Developer Dashboard.
- Conectar la cuenta y aceptar los permisos nuevos, especialmente `streaming`.
- Comprobar el menú **DIAGNÓSTICO DEL REPRODUCTOR**; Spotify debe reconocer Premium, el SDK y un dispositivo activo.
- Pulsar directamente ▶ en una canción real (gesto necesario en algunos navegadores).
- Comprobar volumen, pausa, avance, anterior/siguiente, repetición, aleatorio, cola y dispositivos.
- En otra cuenta Premium autorizada, verificar que sus canciones privadas **no alteran la portada** del propietario.
- En una ventana de incógnito sin Spotify, verificar la colección pública publicada en `featured.json`.

No afirmar audio verificado solo con pruebas de sintaxis: requiere una sesión Premium real.
