# Almacén de Licores

## Las tres preguntas

1. **¿Qué problema resuelve?** Saber quién se llevó qué botella, de qué almacén,
   para qué restaurante y a qué hora — y avisar cuándo hay que reordenar.
2. **¿Quién lo usa?** El personal de cuatro restaurantes (La Madre, La O,
   La Grieta, El Más Allá) que baja al almacén central a buscar licor, y la
   gerencia que administra el catálogo, recibe la mercancía y saca reportes.
3. **¿Primera cosa visible?** Un empleado entra un código de 5 dígitos, toca tres
   botellas y confirma: el inventario baja y queda el registro. Eso funciona hoy.

## Modelo de datos (lo que hay que entender antes de tocar nada)

Existe **un solo inventario**: el del almacén central. El restaurante **no** es
un inventario aparte — es el destino de cada salida. Por eso el reporte de
consumo por restaurante sirve como reparto de costos entre locales.

Cada movimiento guarda un `delta` con el signo ya aplicado al almacén:

| Tipo | delta | Restaurante | Para qué |
|---|---|---|---|
| `salida` | negativo | sí | Un empleado se lleva botellas |
| `entrada` | positivo | no | Llegó la orden del proveedor |
| `devolucion` | positivo | sí | Un restaurante regresa una botella sin abrir |
| `ajuste` | cualquiera | no | Conteo físico: el sistema se iguala a la realidad |
| `reversion` | espejo | hereda el del original | Corrección de un movimiento anterior |

**Consumo de un restaurante = suma de `-delta` de sus movimientos.** Con esa
convención, devoluciones y reversiones se descuentan solas y no hacen falta
casos especiales en los reportes.

**El store `movimientos` es append-only.** `DB.borrar('movimientos', …)` lanza
error a propósito. Un error se corrige creando una reversión, nunca borrando.
Si algún día alguien "optimiza" eso, el historial deja de servir como evidencia.

## Estructura

```
index.html          Todas las pantallas del empleado y el contenedor de admin
pruebas.html        92 pruebas. Abrir en el navegador; no hay runner
css/estilos.css     Todo el estilo. Sin framework
js/db.js            IndexedDB: esquema, transacciones, exportar e importar
js/cripto.js        PBKDF2 para los códigos de acceso
js/datos.js         Los 4 restaurantes, las categorías y el catálogo de ejemplo
js/modelo.js        Reglas de negocio: movimientos, existencias, reportes
js/ui.js            Pantallas, modal, avisos flotantes, formato, descargas
js/app.js           Arranque, sesión, flujo del empleado
js/admin.js         Área de gerencia
sw.js               Service worker (red primero, respaldo en caché)
herramientas/       Servidor de desarrollo y generador de iconos
```

## Acceso: por qué un solo código

No se escoge restaurante ni nombre. Se entra un código de 5 dígitos y el sistema
resuelve por él quién es la persona, a qué restaurante pertenece y si va al panel
de salidas o al área de gerencia.

Eso obliga a dos cosas que no son negociables:

- **Los códigos son únicos en toda la instalación.** Se impone al crearlos y al
  cambiarlos (`admin.js` y `modalCambiarCodigo`). Dos personas con el mismo
  código harían que el sistema le cargue las botellas a la equivocada.
- **La sal del cifrado es una sola para toda la instalación** (`config.sal_codigos`),
  no una por empleado. Con sal por usuario habría que derivar el hash una vez por
  cada persona para saber de quién es el código: con 30 empleados, más de segundo
  y medio por entrada. El razonamiento completo y lo que se pierde con esa
  decisión está escrito en la cabecera de `js/cripto.js`.

Por 5 dígitos y no 4: con 4 hay 10.000 combinaciones y, con 30 empleados, un 4%
de probabilidad de que dos escojan la misma. Con 5 baja a 0,4%. El largo está en
`LARGO_CODIGO`, en `js/cripto.js`, y es lo único que hay que cambiar.

El bloqueo por intentos fallidos es **del aparato**, no de una persona: hasta que
el código no acierta no se sabe quién está intentando. Un código de gerencia
entra durante el bloqueo y lo levanta — sin esa válvula, cinco dedazos dejan el
almacén cerrado en pleno servicio y la gente saca botellas sin registrarlas.

## Comandos

Servidor local para desarrollo y pruebas (hace falta un contexto seguro:
`localhost` cuenta, `file://` no):

```bash
python3 herramientas/servidor-dev.py 8788
```

- App: <http://localhost:8788/index.html>
- Pruebas: <http://localhost:8788/pruebas.html> — deben decir "Ninguna falló"

Usa ese servidor y no `python3 -m http.server`: manda `Cache-Control: no-store`
en todo. Sin eso el navegador sigue sirviendo los módulos viejos después de
editar un archivo, y se pierden horas persiguiendo errores ya corregidos.
Por la misma razón, `app.js` **no registra el service worker en localhost** y
elimina el que hubiera quedado de antes.

Regenerar iconos (solo si cambia el diseño del icono):

```bash
python3 herramientas/generar-iconos.py
```

## Publicación

La app está publicada en <https://nivekgv.github.io/inventario-fblcorp/>
(GitHub Pages, rama `main`, raíz del repo). El iPad la instala desde ahí.

Existe porque **Web Crypto y el service worker solo funcionan en contexto
seguro**: HTTPS o `localhost`. Servir el proyecto desde la red local por
`http://192.168.x.x` carga la pantalla pero deja los códigos de acceso muertos.

Para publicar una corrección:

```bash
git push
```

Sube el número de `VERSION` en `sw.js` en el mismo commit. El service worker es
red primero, así que el iPad toma la versión nueva al abrir con conexión, pero
el cambio de versión es lo que descarta el caché viejo.

Detalles que sostienen esta publicación y no hay que romper:

- **Todas las rutas son relativas** (`./index.html`, `sw.js`, `js/app.js`).
  Pages sirve desde un subdirectorio, no desde la raíz del dominio: una sola
  ruta absoluta rompe el sitio entero.
- **`.nojekyll`** evita que Pages procese el repo como un blog de Jekyll.
- **`noindex` en `index.html` y `robots.txt`** — el repo es público, pero el
  sitio no tiene por qué salir en buscadores.
- **Los códigos de los empleados de ejemplo están en texto claro** en
  `datos.js`. Es data de demostración y el repo es público: en una instalación
  real hay que borrar esos empleados o cambiarles el código.

## Decisiones y sus porqués

- **JavaScript nativo, cero dependencias, sin compilación.** El cliente no tiene
  quien mantenga esto. Sin `npm install` no hay nada que se pudra ni versiones
  que actualizar. Se abre el archivo y funciona.
- **IndexedDB y no localStorage.** Hacen falta transacciones atómicas: un lote de
  salida tiene que entrar completo o no entrar. localStorage no da eso.
- **PWA instalada en la pantalla de inicio, no una pestaña.** Verificado contra
  la documentación de WebKit: el tope de 7 días sobre el almacenamiento escribible
  por scripts (IndexedDB incluido) **no aplica** a las apps añadidas a la pantalla
  de inicio — su dominio se salta el algoritmo de borrado y sus datos quedan
  aislados de Safari, con su propio contador de días de uso. Abierta como pestaña
  de Safari, en cambio, IndexedDB sí se borra tras 7 días sin interacción.
  Matiz que importa: WebKit lo redacta como "no esperamos que se borren", no como
  una garantía, y la expulsión por falta de espacio en el dispositivo sigue
  existiendo. Por eso el respaldo manual no es opcional.
  <https://webkit.org/tracking-prevention/> y
  <https://webkit.org/blog/14403/updates-to-storage-policy/>
- **Red primero en el service worker.** Con caché primero, subir una corrección
  no la aplicaba: el iPad seguía abriendo la versión vieja. Pasó durante el
  desarrollo, y también contaminó la base de datos real con datos de prueba.
- **PBKDF2 con 210.000 iteraciones.** Medido: 50 ms por derivación, que es lo que
  tarda identificar a una persona por su código. Un código de 5 dígitos nunca es
  una contraseña fuerte; esto solo evita que aparezca legible en la base o en un
  respaldo.
- **El gerente asigna el código y el empleado lo cambia.** Con un teclado único no
  hay forma de que alguien sin código se identifique para crear el suyo. El
  gerente lo asigna al registrar a la persona; el empleado lo cambia desde el
  panel con "Cambiar mi código". Hasta que lo cambie, el gerente lo conoce — está
  dicho en el manual, no escondido.
- **Buscador que ignora acentos** (`normalizar` en `ui.js`): busca sobre nombre,
  categoría y tamaño, porque "ron" debe traer la categoría completa y "caja" las
  cervezas. Nadie va a escribir "Patrón" con tilde en un almacén.
- **`--acento` es identidad, `--accion` es acción.** El color del restaurante
  pinta la barra y la insignia; el botón de confirmar es siempre verde. Si
  tomara el color del local, en La Grieta saldría rojo y se leería como borrar.
- **Día operativo desde las 5:00 a.m.** Un bar cierra a las 2. Con día calendario,
  un turno se parte en dos fechas y los reportes no cuadran con la realidad.
- **Cierre de sesión a los 60 segundos.** Sin eso, el registro de auditoría no
  vale nada: las botellas del siguiente quedarían a nombre del anterior.
- **Nombre de base parametrizable** (`globalThis.__ALMACEN_DB_PRUEBAS__`): existe
  solo para que `pruebas.html` no toque el inventario real. La página verifica el
  nombre y se niega a correr si apunta a la base de producción.

## Después

Fuera de alcance en esta versión, viable más adelante (todo esto implica servidor
y costo mensual, menos lo último):

- Sincronización entre varios iPads y vista consolidada en tiempo real.
- Respaldo automático sin intervención humana.
- Órdenes de compra enviadas por correo al proveedor.
- Lectura de códigos de barra con la cámara del iPad.
- Integración con el POS de los restaurantes.
- Sugerencia automática del nivel par a partir del consumo y el plazo de entrega
  (el dato de consumo semanal ya se calcula y se muestra; falta proponerlo).
