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
js/importar.js      Carga del catálogo desde CSV: lectura, revisión y escritura
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
- **Los códigos de los empleados de ejemplo se sortean al instalar** y se
  muestran una vez. Antes estaban escritos en claro en `datos.js`, dentro de un
  repositorio público, y la pantalla de instalación trae el catálogo de ejemplo
  marcado por omisión: quien encontrara el repo tenía ocho códigos válidos.

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
- **La app se llama "Inventario", no "Almacén".** El nombre del icono está en
  `apple-mobile-web-app-title` y en `name`/`short_name` del manifiesto: los tres
  tienen que decir lo mismo o el iPad muestra un nombre y la app otro.
- **Barra de estado `black`, no `black-translucent`.** Con translucent el
  contenido pasa por debajo de la barra de iOS y el reloj y la batería del iPad
  quedan flotando sobre la app. Con `black` iOS reserva esa franja. Las barras
  llevan además `env(safe-area-inset-*)` para no pegarse al borde físico.
- **Reloj propio en la barra** (`pintarRelojes` en `app.js`): como la hora de
  iOS queda fuera del área de la app, el empleado no la vería. Se pinta en hora
  de Puerto Rico, la misma que se guarda en el historial, para que no haya dos
  horas distintas en pantalla si el iPad quedara en otra zona.
- **El historial agrupa por lote, no por línea.** Una salida de seis licores es
  una fila que se abre, no seis renglones. Además el botón "Revertir" siempre
  llamó a `revertirLote()`, o sea que deshacía la operación entera: la fila por
  línea mentía sobre lo que hacía ese botón. El CSV sí se exporta línea por
  línea, que es como sirve en Excel.
- **Las tarjetas del resumen abren el detalle.** Un número suelto ("3 agotados")
  obliga a irse a otra pestaña a averiguar cuáles son. Son `<button>` de verdad,
  no `div` con `onclick`, para que el iPad les dé el resaltado al tocar.
- **La recepción no se limita a lo que está bajo el par.** `vistaCompra` se
  construía solo desde `listaCompra()`, así que un producto que llegara sin
  estar bajo su nivel no aparecía y no había forma de recibirlo — la salida era
  meterlo por conteo físico, y el historial decía "ajuste" en vez de "llegó
  mercancía". Con el inventario entero en nivel, la pantalla ni siquiera se
  dibujaba. Ahora la lista de compra es la sugerencia y el buscador deja añadir
  cualquier producto activo a la recepción.
- **La importación de catálogo nunca borra y nunca pisa existencias.** Crea los
  productos que faltan y actualiza los que están, emparejando por nombre
  normalizado. La existencia solo se fija al **crear**: si se pisara, reimportar
  el catálogo corregido en marzo devolvería el inventario a los números de
  enero. La existencia inicial entra como movimiento de `ajuste` con motivo
  "Carga inicial de catálogo" — sin eso, el historial no cuadraría desde el
  primer día y dejaría de servir como evidencia. Todo en una transacción:
  doscientos productos entran completos o no entra ninguno.
- **Los niveles par salen del pedido mensual, no de un estimado de consumo.**
  Lo que se pide está en una factura; lo que se consume hay que adivinarlo 200
  veces. Con el ciclo real del cliente (piden lunes, llega martes o miércoles):
  reorden = mensual ÷ 4.3 × 1.2, par = mensual ÷ 4.3 × 1.7, con pisos de 1 y 2
  y el par siempre por encima del reorden. Las columnas Par y Reorden del
  archivo, si vienen llenas, le ganan al cálculo.
- **El separador del CSV se detecta, no se asume.** Excel en español exporta con
  punto y coma. Un archivo mal leído no da error: da doscientos productos con el
  nombre pegado a la categoría. Igual con la coma decimal (`aNumero`).
- **Buscador que ignora acentos** (`normalizar` en `ui.js`): busca sobre nombre,
  categoría y tamaño, porque "ron" debe traer la categoría completa y "caja" las
  cervezas. Nadie va a escribir "Patrón" con tilde en un almacén.
- **`--acento` es identidad, `--accion` es acción.** El color del restaurante
  pinta la barra y la insignia; el botón de confirmar es siempre verde. Si
  tomara el color del local, en La Grieta saldría rojo y se leería como borrar.
- **Día operativo desde las 5:00 a.m.** Un bar cierra a las 2. Con día calendario,
  un turno se parte en dos fechas y los reportes no cuadran con la realidad.
- **Cierre de sesión a los 180 segundos** (`INACTIVIDAD_EMPLEADO`), 300 para la
  gerencia. Sin cierre automático el registro de auditoría no vale nada: las
  botellas del siguiente quedarían a nombre del anterior. Arrancó en 60 y se
  subió a 3 minutos: con un minuto, buscar seis licores en el almacén cerraba la
  sesión a media compra.
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


## Decisiones de agosto 2026

### Confirmación antes de registrar, en vez de deshacer después
El empleado veía un botón «Deshacer» durante 15 segundos después de registrar la
salida. Ahora ve la lista completa —productos, cantidades, su nombre y su
restaurante— **antes** de registrar, y el deshacer desapareció.

Lo que se gana: el error se evita en vez de corregirse, y no depende de que la
persona reaccione en 15 segundos con el bar por abrir. Lo que se pierde: la red
de seguridad. Un error registrado ahora solo lo corrige un gerente desde el
Historial. Por eso la confirmación muestra la lista entera y no un «¿Confirmar?»
genérico: un modal que no se lee no evita nada y solo añade un toque.

Detalle de implementación que costó un fallo: `cerrarModal()` dispara `alCerrar`,
así que en los botones hay que resolver la promesa **antes** de cerrar. Al revés,
`alCerrar` resolvía en `false` y la salida nunca se registraba.

### El empleado ya no cambia su propio código
Se quitó «Cambiar mi código» del panel y se borró `modalCambiarCodigo`. Los
códigos los asigna y los cambia un gerente desde Administración → Empleados.

Consecuencia que hay que decir en voz alta y que está escrita en el manual: **la
gerencia conoce el código de cada empleado.** El registro prueba desde qué código
salió cada botella, no quién lo tecleó. Sirve para saber a quién preguntarle, no
para acusar por sí solo. Decisión del dueño del producto, tomada a sabiendas.

### «Par» y «punto de reorden» pasaron a «Máximo» y «Mínimo»
Solo cambiaron las etiquetas visibles, el manual, las propuestas y las columnas
de la plantilla. **Los campos de la base siguen llamándose `par` y
`puntoReorden`**: renombrarlos obligaría a migrar los datos de los iPads que ya
tienen el sistema instalado y no cambia nada para nadie.

«Par» venía del inglés de la industria hotelera y en español no dice nada. Ojo
con el malentendido natural: el máximo **no** es un mínimo — el inventario baja
de él constantemente y eso es lo que arma la lista de compra. El que es un
mínimo de verdad es el punto de reorden.

`importar.js` acepta los dos juegos de nombres de columna, porque hay plantillas
repartidas con los títulos viejos.

### Una prueba que solo fallaba de madrugada
`pruebas.html` consultaba con `fechaPR()` movimientos archivados por
`diaOperativo`. Entre medianoche y las 5:00 a.m. el día operativo es el anterior,
la consulta salía vacía y la prueba reventaba en `[0].unidades`. Corregido a
`diaOperativo(new Date(), 5)`. Cualquier prueba que consulte movimientos por
fecha tiene que usar el día operativo, nunca la fecha del calendario.

### Salida manual desde gerencia
Hasta ahora las botellas solo salían por el panel del empleado, y un gerente no
puede entrar ahí: su código lo manda directo a Administración. Si el propio
gerente bajaba una caja a un restaurante, lo único que le reducía el inventario
era el conteo físico — y ese ajuste **no se le carga a ningún restaurante**. La
botella desaparecía del almacén sin aparecer en el consumo de nadie, y el
reparto de costos entre los cuatro locales quedaba corto.

Administración → **Salida manual** cierra ese hueco: escoge restaurante,
motivo (obligatorio) y productos, y registra un `salida` normal a nombre del
gerente con la sesión abierta.

**Campo `origen` en cada movimiento** (`'empleado'` por defecto, `'admin'` en la
salida manual y en toda reversión). Existe porque acá el gerente **escoge** el
restaurante y en el panel del empleado no se escoge nada — el código lo
resuelve. Son dos cosas distintas y el historial tiene que decirlo, o esta
pantalla se vuelve la única puerta para mover inventario a mano y que se lea
igual que el registro honesto, en el producto cuyo argumento de venta es saber
quién sacó qué. Se marca **solo en las salidas**: entradas, ajustes,
devoluciones y reversiones únicamente ocurren en gerencia, así que etiquetarlas
no diría nada.

En `revertirLote` el `origen: 'admin'` va escrito explícito. El espejo se
construye con `...orig`, así que sin esa línea la reversión de la salida de un
mesero quedaría marcada como hecha por un empleado. Hay prueba de eso.

**Sin existencia no se fuerza el negativo.** En el panel del empleado un gerente
puede autorizar la excepción porque son dos personas; acá el gerente se
autorizaría a sí mismo y eso no es un control. Si el número no cuadra, lo que
está mal es el conteo, y el mensaje manda a Conteo físico.

Efecto colateral que hubo que arreglar: la columna Restaurante del reporte «Por
empleado» mostraba el restaurante del **primer** movimiento de la persona. Con
un empleado da igual, pertenece a uno solo; un gerente escoge el local en cada
salida manual, así que la celda decía «La Madre» sobre un total que incluía
otros tres locales. Ahora dice «Varios (n)» cuando hay más de uno.

El CSV de movimientos lleva columna **«Registrado desde»**. Los movimientos
anteriores a este campo no lo tienen y se declaran como del panel del empleado,
que era el único origen que existía entonces.

### Tequila y Mezcal son dos categorías
Estaban fusionadas en «Tequila y Mezcal». Se separaron en `tequila` (orden 4) y
`mezcal` (orden 5), y se renumeró de ginebra (6) hasta otros (12) — doce
categorías. La plantilla `.xlsx`, su menú desplegable y la guía impresa dicen lo
mismo. No hizo falta migrar nada: ninguna instalación real tenía el catálogo
cargado todavía.


### Hallazgos del chequeo de seguridad (agosto 2026)

**El respaldo era la puerta trasera del historial.** `importarTodo` vaciaba
todos los stores antes de escribir, `movimientos` incluido. El archivo de
respaldo es JSON legible, así que bastaba con exportarlo, quitarle a mano la
línea de una salida incómoda, cuadrar la existencia del producto y restaurar:
la salida desaparecía y el inventario cuadraba solo, sin dejar rastro.
Demostrado sobre la app corriendo: de tres movimientos quedaban dos.

`DB.borrar` ya se negaba a borrar movimientos; esta función lo saltaba por
detrás. Ahora el historial **no se reemplaza, solo se le añade**, y cada
restauración queda anotada en `config.restauraciones` con quién la hizo y
cuántos movimientos había antes y después. Si el conteo baja, se ve en una
banda arriba del Historial. Restaurar en un iPad nuevo funciona igual.

Importa porque la propuesta le promete al cliente, por escrito, que «eso
convierte el historial en evidencia y no en una lista editable».

**El respaldo lleva todo en claro y la app decía que lo mandaras por correo.**
El archivo contiene nombres del personal, historial completo y los códigos
cifrados. Con la sal compartida, un solo recorrido de las 100.000
combinaciones de 5 dígitos los rompe todos a la vez: medido, 22,4 ms por
derivación, 37 minutos para el espacio entero. El aviso ahora manda guardarlo
en el iCloud del negocio y advierte de no mandarlo por correo ni WhatsApp.
**Cifrar el respaldo con una frase sigue pendiente** y es una decisión con
costo: si se pierde la frase, el respaldo no se recupera.

**Límite aceptado, sin arreglo posible sin servidor:** el bloqueo por intentos
fallidos vive en el IndexedDB del propio aparato. Se puede reescribir con el
iPad desbloqueado y el Inspector de Safari conectado. La cerradura real es el
código de bloqueo del iPad, y eso va en el manual.

**Revisado y limpio:** sin XSS (probado con un nombre de producto con marcado,
sale como texto porque `el()` usa `textContent` en todas partes), sin secretos
en el historial de git, sin inyección posible (no hay SQL ni comandos), sin
dependencias externas, y ningún dato sale del iPad.
