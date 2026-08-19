/* Service worker: la app abre y funciona sin internet.

   Los datos NO pasan por aquí: viven en IndexedDB. Esto solo guarda los
   archivos de la app (HTML, CSS, JS, iconos) para que el iPad no dependa de
   la red para arrancar.

   Al publicar una versión nueva, sube el número de VERSION: eso invalida el
   caché viejo. Sin ese cambio el iPad se queda con la versión anterior. */

const VERSION = 'v12';
const CACHE = `almacen-licores-${VERSION}`;

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/app.js',
  './js/admin.js',
  './js/db.js',
  './js/cripto.js',
  './js/datos.js',
  './js/importar.js',
  './js/modelo.js',
  './js/ui.js',
  './iconos/icono-180.png',
  './iconos/icono-192.png',
  './iconos/icono-512.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARCHIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Red primero, con respaldo en caché y tope de espera.

   Por qué no al revés: con caché primero, el día que se corrige un error y se
   sube la versión nueva, el iPad sigue abriendo la vieja. Eso ya pasó durante
   las pruebas de este proyecto. Un almacén con wifi normal no gana nada con
   ahorrarse 200 ms de carga, y sí pierde mucho corriendo código viejo.

   El tope de ESPERA_MS existe porque una wifi a medias es peor que no tener:
   sin el tope, una petición colgada dejaría la pantalla en blanco. Pasado ese
   tiempo se sirve la copia guardada y la app abre igual. */

const ESPERA_MS = 2500;

function conTope(promesa, respaldo) {
  return new Promise((resolve) => {
    let resuelto = false;
    const listo = (r) => { if (!resuelto && r) { resuelto = true; resolve(r); } };
    const reloj = setTimeout(() => respaldo.then(listo), ESPERA_MS);
    promesa.then((r) => { clearTimeout(reloj); listo(r); })
      .catch(() => { clearTimeout(reloj); respaldo.then((r) => (r ? listo(r) : resolve(Response.error()))); });
  });
}

self.addEventListener('fetch', (ev) => {
  const { request } = ev;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const guardado = caches.match(request);

  /* `cache: 'reload'` no es adorno: sin él, "red primero" no iba a la red.
     GitHub Pages sirve todo con `cache-control: max-age=600`, y un `fetch()`
     normal —también dentro del service worker— se sirve de la caché HTTP del
     navegador. Resultado: durante diez minutos después de publicar, el iPad
     creía estar pidiendo a la red y le devolvían el archivo viejo. Con
     'reload' la petición salta esa caché y de paso la deja al día.

     Se construye una petición nueva desde la URL en vez de pasarle opciones a
     `request`: heredar un `mode: 'navigate'` con opciones encima revienta la
     construcción en algunos navegadores. Acá solo hay GET del mismo origen,
     así que no se pierde nada. */
  const red = fetch(new Request(request.url, {
    cache: 'reload',
    credentials: 'same-origin',
  })).then((respuesta) => {
    if (respuesta && respuesta.ok) {
      const copia = respuesta.clone();
      caches.open(CACHE).then((c) => c.put(request, copia));
    }
    return respuesta;
  });

  ev.respondWith(conTope(red, guardado));
});
