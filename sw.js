/* Service worker: la app abre y funciona sin internet.

   Los datos NO pasan por aquí: viven en IndexedDB. Esto solo guarda los
   archivos de la app (HTML, CSS, JS, iconos) para que el iPad no dependa de
   la red para arrancar.

   Al publicar una versión nueva, sube el número de VERSION: eso invalida el
   caché viejo. Sin ese cambio el iPad se queda con la versión anterior. */

const VERSION = 'v36';
const CACHE = `almacen-licores-${VERSION}`;

const ARCHIVOS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/estilos.css',
  './js/app.js',
  './js/borradores.js',
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
  /* Las pantallas de arranque también se guardan: sin internet, iOS no puede
     ir a buscarlas y volvería el blanco. */
  './iconos/arranque-2048x2732.png',
  './iconos/arranque-2732x2048.png',
  './iconos/arranque-1668x2388.png',
  './iconos/arranque-2388x1668.png',
  './iconos/arranque-1640x2360.png',
  './iconos/arranque-2360x1640.png',
  './iconos/arranque-1620x2160.png',
  './iconos/arranque-2160x1620.png',
  './iconos/arranque-1536x2048.png',
  './iconos/arranque-2048x1536.png',
  './iconos/arranque-1488x2266.png',
  './iconos/arranque-2266x1488.png',
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

/* Dos estrategias, según lo que se pida.

   LA PÁGINA (la navegación) va a la RED PRIMERO. Es lo que dispara que el
   navegador compruebe si hay un service worker nuevo, o sea que es la pieza
   que hace que una corrección publicada llegue al iPad. Con caché primero
   aquí, el aparato podía quedarse con la versión vieja: ya pasó en este
   proyecto y por eso esto no se toca.

   LOS ARCHIVOS de la app —estilos, módulos, iconos— van a la CACHÉ PRIMERO, y
   se sirven al instante. No hace falta preguntarle a la red por cada uno: la
   copia entera se renueva de golpe cuando se instala una versión nueva del
   service worker, que es lo que ocurre al abrir con internet después de
   publicar. Preguntar archivo por archivo solo añadía espera.

   Esto salió del almacén: con el wifi flojo de allá, la app tardaba varios
   segundos en abrir. Un wifi a medias es peor que no tener ninguno — sin
   señal, la petición falla enseguida y se usa la copia; con señal débil, se
   queda colgando hasta el tope. Ahora los archivos ni esperan.

   Lo que esto exige a cambio, y no es negociable: **subir el número de
   VERSION en cada publicación**. Es lo que instala la copia nueva. Sin eso, el
   iPad se queda con la anterior y no hay aviso. */

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

  /* Caché primero para todo lo que no sea la página. Si está guardado se
     entrega sin tocar la red; si no está —un archivo nuevo que esta versión
     todavía no conocía— se va a la red y se guarda para la próxima. */
  const esNavegacion = request.mode === 'navigate';
  if (!esNavegacion) {
    ev.respondWith(guardado.then((copia) => copia || fetch(request).then((respuesta) => {
      if (respuesta && respuesta.ok) {
        const clon = respuesta.clone();
        caches.open(CACHE).then((c) => c.put(request, clon));
      }
      return respuesta;
    })));
    return;
  }

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
