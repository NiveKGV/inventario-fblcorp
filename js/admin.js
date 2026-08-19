/* Área de administración: catálogo, entradas, ajustes por conteo, devoluciones,
   lista de compra, reportes, historial, empleados y respaldos.

   Nada de lo que se hace aquí borra historial. Corregir siempre suma un
   movimiento nuevo. */

import { DB, nuevoId } from './db.js';
import { derivarCodigo, igualesConstante, codigoDebil, LARGO_CODIGO } from './cripto.js';
import { productosIniciales, empleadosEjemplo, alinearCategorias } from './datos.js';
import {
  estadoStock, registrarLote, revertirLote, productosActivos, listaCompra,
  movimientosPeriodo, porRestaurante, porEmpleado, porProducto, consumoSemanal,
  resumenAlertas, fechaPR, diaOperativoActual, sumarDias, fechaHoraPR, TIPOS,
} from './modelo.js';
import {
  $, el, mostrarPantalla, abrirModal, cerrarModal, confirmar,
  brindis, dinero, numero, descargar, aCSV, normalizar,
} from './ui.js';
import { interpretar as interpretarCatalogo, aplicar as aplicarCatalogo } from './importar.js';

/* Topes de longitud. No son cosmética: la lista de compra tiene botón de
   imprimir, y un nombre de producto sin límite se convierte en papel saliendo
   de la impresora del restaurante. También rompe las tarjetas del panel. */
const LARGO = {
  nombre: 60, tamano: 20, empleado: 50, motivo: 120, referencia: 80,
};

const TABS = [
  ['resumen', 'Resumen'],
  ['inventario', 'Inventario'],
  ['compra', 'Lista de compra'],
  ['conteo', 'Conteo físico'],
  ['devolucion', 'Devoluciones'],
  ['salida', 'Salida manual'],
  ['reportes', 'Reportes'],
  ['historial', 'Historial'],
  ['empleados', 'Empleados'],
  ['sistema', 'Sistema'],
];

let ctx = null;
let tabActual = 'resumen';

/* En qué día operativo estamos. Se guarda acá porque leerlo exige consultar la
   configuración —y eso es asíncrono—, mientras que los rangos de fecha se
   calculan dentro de manejadores que no pueden esperar. `render()` lo refresca
   antes de pintar cualquier vista, así que siempre está al día.

   Arranca en la fecha del calendario solo como valor provisional, para que
   nada quede en nulo si algo pregunta antes del primer render. */
let hoyOperativo = fechaPR();

function abrirAdmin(gerente, opciones) {
  ctx = { gerente, ...opciones };
  tabActual = 'resumen';
  $('#admin-sub').textContent = `${gerente.nombre} · almacén central`;
  document.documentElement.style.setProperty('--acento', '#e0a34a');
  pintarTabs();
  mostrarPantalla('admin');
  render();
}

function salirAdmin() { ctx = null; }

function pintarTabs() {
  $('#admin-tabs').replaceChildren(...TABS.map(([id, etiqueta]) => el('button', {
    clase: `admin-tab${id === tabActual ? ' sel' : ''}`,
    texto: etiqueta,
    onclick: () => { tabActual = id; pintarTabs(); render(); },
  })));
}

async function render() {
  if (!ctx) return;
  const cuerpo = $('#admin-cuerpo');
  cuerpo.replaceChildren(el('p', { clase: 'vacio', texto: 'Cargando…' }));
  // Antes de pintar nada: si la sesión quedó abierta y cruzó las 5:00 a.m., el
  // día operativo cambió mientras el gerente miraba la pantalla.
  hoyOperativo = await diaOperativoActual();
  const vistas = {
    resumen: vistaResumen,
    inventario: vistaInventario,
    compra: vistaCompra,
    conteo: vistaConteo,
    devolucion: vistaDevolucion,
    salida: vistaSalidaManual,
    reportes: vistaReportes,
    historial: vistaHistorial,
    empleados: vistaEmpleados,
    sistema: vistaSistema,
  };
  try {
    const nodo = await vistas[tabActual]();
    cuerpo.replaceChildren(nodo);
    cuerpo.scrollTop = 0;
  } catch (e) {
    cuerpo.replaceChildren(el('p', { clase: 'vacio', texto: `Error: ${e.message}` }));
  }
}

/* ------------------------------------------------------------------ */
/* Piezas comunes                                                      */
/* ------------------------------------------------------------------ */

function seccion(titulo, descripcion, ...contenido) {
  return el('div', { clase: 'seccion' }, [
    titulo ? el('h2', { texto: titulo }) : null,
    descripcion ? el('p', { clase: 'desc', texto: descripcion }) : null,
    ...contenido,
  ].filter(Boolean));
}

function tabla(encabezados, filas) {
  return el('div', { clase: 'tabla-envoltura' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, encabezados.map(
        (h) => el('th', { clase: typeof h === 'object' && h.num ? 'num' : '' }, [typeof h === 'object' ? h.t : h]),
      ))]),
      el('tbody', {}, filas),
    ]),
  ]);
}

function etiquetaEstado(e) {
  return el('span', { clase: `etiqueta ${e.clave}`, texto: e.etiqueta });
}

function campo(etiqueta, control, ayuda) {
  return el('div', { clase: 'campo' }, [
    el('label', { texto: etiqueta }),
    control,
    ayuda ? el('p', { clase: 'ayuda', texto: ayuda }) : null,
  ].filter(Boolean));
}

async function diasSinRespaldo() {
  const ultimo = await DB.leerConfig('ultimo_respaldo', null);
  if (!ultimo) return null;
  return Math.floor((Date.now() - new Date(ultimo).getTime()) / 86400000);
}

async function bandaRespaldo() {
  const dias = await diasSinRespaldo();
  if (dias !== null && dias < 7) return null;
  return el('div', { clase: `aviso-banda${dias === null || dias >= 14 ? ' rojo' : ''}` }, [
    el('div', { clase: 'crece' }, [
      el('b', { texto: dias === null ? 'Nunca se ha hecho un respaldo' : `Último respaldo hace ${dias} días` }),
      'Todo vive en este iPad. Si se pierde o se borra, se va el inventario y el historial completo.',
    ]),
    el('button', {
      clase: 'btn btn-primario btn-chico',
      texto: 'Respaldar ahora',
      onclick: exportarRespaldo,
    }),
  ]);
}

/* ------------------------------------------------------------------ */
/* Resumen                                                             */
/* ------------------------------------------------------------------ */

/* Abre el detrás de una tarjeta del resumen. Existe porque un número suelto
   ("3 agotados") obliga a irse a otra pestaña a averiguar cuáles son; el gerente
   está parado frente al almacén y necesita el nombre, no la cuenta. */
function modalProductos(titulo, subtitulo, lista, { conOrden = false } = {}) {
  const contenido = lista.length
    ? tabla(
      [
        'Producto',
        { t: 'Quedan', num: true },
        { t: 'Máximo', num: true },
        ...(conOrden ? [{ t: 'Ordenar', num: true }] : []),
        'Estado',
      ],
      lista.map((p) => el('tr', {}, [
        el('td', {}, [
          el('div', { texto: p.nombre }),
          p.tamano ? el('div', { clase: 'desc', estilo: { margin: '0' }, texto: p.tamano }) : null,
        ].filter(Boolean)),
        el('td', { clase: 'num', texto: String(p.existencia) }),
        el('td', { clase: 'num', texto: String(p.par) }),
        ...(conOrden ? [el('td', { clase: 'num', texto: String(Math.max(0, p.par - p.existencia)) })] : []),
        el('td', {}, [etiquetaEstado(estadoStock(p))]),
      ])),
    )
    : el('p', { clase: 'vacio', texto: 'No hay productos en esta condición ahora mismo.' });

  abrirModal({
    titulo,
    subtitulo,
    contenido,
    ancho: true,
    botones: [{ texto: 'Cerrar', accion: cerrarModal }],
  });
}

/* Lo que salió hoy, sumado por producto. Se usa -delta y no el conteo de
   movimientos para que una devolución del mismo día se reste sola, igual que en
   los reportes. Por eso puede haber un producto en 0: salió y volvió. */
function modalSalidasHoy(movsHoy) {
  const porProducto = new Map();
  for (const m of movsHoy.filter((mv) => mv.restauranteId)) {
    porProducto.set(m.productoNombre, (porProducto.get(m.productoNombre) || 0) + (-m.delta));
  }
  const filas = [...porProducto.entries()]
    .filter(([, n]) => n !== 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'));

  abrirModal({
    titulo: 'Salió hoy del almacén',
    subtitulo: `${numero(filas.reduce((s, [, n]) => s + n, 0))} botellas en total, del día operativo de hoy.`,
    ancho: true,
    contenido: filas.length
      ? tabla(['Producto', { t: 'Botellas', num: true }],
        filas.map(([nombre, n]) => el('tr', {}, [
          el('td', { texto: nombre }),
          el('td', { clase: 'num', texto: String(n) }),
        ])))
      : el('p', { clase: 'vacio', texto: 'Todavía no ha salido nada hoy.' }),
    botones: [{ texto: 'Cerrar', accion: cerrarModal }],
  });
}

async function vistaResumen() {
  const [alertas, compra, productos] = await Promise.all([
    resumenAlertas(), listaCompra(), productosActivos(),
  ]);
  // Día operativo, no fecha de calendario: a la 1:00 a.m. el turno que acaba
  // de cerrar está archivado bajo el día anterior, y con `fechaPR()` esta
  // tarjeta decía cero botellas sobre una noche entera de trabajo.
  const hoy = hoyOperativo;
  const movsHoy = await movimientosPeriodo(hoy, hoy);
  const salidasHoy = movsHoy.filter((m) => m.restauranteId).reduce((s, m) => s + (-m.delta), 0);

  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
  const enEstado = (clave) => productos.filter((p) => estadoStock(p).clave === clave).sort(porNombre);

  /* Una tarjeta con acción es un botón de verdad, no un div con onclick: en el
     iPad eso es lo que le da el toque resaltado y lo hace alcanzable con teclado. */
  const dato = (valor, etiqueta, clase = '', alTocar = null) => el(
    alTocar ? 'button' : 'div',
    {
      clase: `tarjeta-dato ${clase} ${alTocar ? 'tocable' : ''}`,
      ...(alTocar ? { type: 'button', onclick: alTocar, title: `Ver ${etiqueta}` } : {}),
    },
    [
      el('div', { clase: 'v', texto: valor }),
      el('div', { clase: 'e', texto: etiqueta }),
    ],
  );

  return el('div', {}, [
    await bandaRespaldo(),
    el('div', { clase: 'tarjetas-resumen' }, [
      dato(numero(alertas.total), 'productos en catálogo', '', () => modalProductos(
        'Catálogo completo', `${alertas.total} productos activos.`,
        [...productos].sort(porNombre),
      )),
      dato(numero(alertas.agotados), 'agotados', alertas.agotados ? 'alerta' : '', () => modalProductos(
        'Agotados', 'No queda ni una unidad en el almacén.',
        enEstado('agotado'), { conOrden: true },
      )),
      dato(numero(alertas.criticos), 'hay que ordenar', alertas.criticos ? 'alerta' : '', () => modalProductos(
        'Hay que ordenar', 'Llegaron al mínimo. Piden ya.',
        enEstado('critico'), { conOrden: true },
      )),
      dato(numero(alertas.bajos), 'bajo el máximo', alertas.bajos ? 'aviso' : '', () => modalProductos(
        'Bajo el máximo', 'Todavía alcanzan, pero están por debajo de lo que debería haber.',
        enEstado('bajo'), { conOrden: true },
      )),
      dato(numero(salidasHoy), 'botellas salieron hoy', '', () => modalSalidasHoy(movsHoy)),
      dato(dinero(alertas.valorInventario), 'valor del inventario', '', () => modalProductos(
        'Valor del inventario', `${dinero(alertas.valorInventario)} a costo, de mayor a menor.`,
        [...productos].sort((a, b) => (b.existencia * (b.costo || 0)) - (a.existencia * (a.costo || 0))),
      )),
    ]),
    seccion('Acciones rápidas', null, el('div', { estilo: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
      el('button', { clase: 'btn btn-primario', texto: 'Recibir orden', onclick: () => { tabActual = 'compra'; pintarTabs(); render(); } }),
      el('button', { clase: 'btn', texto: 'Conteo físico', onclick: () => { tabActual = 'conteo'; pintarTabs(); render(); } }),
      el('button', { clase: 'btn', texto: 'Agregar producto', onclick: () => modalProducto(null) }),
      el('button', { clase: 'btn', texto: 'Respaldar', onclick: exportarRespaldo }),
    ])),
    compra.length
      ? seccion('Hay que ordenar', `${compra.length} ${compra.length === 1 ? 'producto está' : 'productos están'} bajo su máximo.`,
        tabla(['Producto', { t: 'Quedan', num: true }, { t: 'Máximo', num: true }, { t: 'Ordenar', num: true }, 'Estado'],
          compra.slice(0, 12).map((p) => el('tr', {}, [
            el('td', { texto: p.nombre }),
            el('td', { clase: 'num', texto: String(p.existencia) }),
            el('td', { clase: 'num', texto: String(p.par) }),
            el('td', { clase: 'num', texto: String(p.aOrdenar) }),
            el('td', {}, [etiquetaEstado(p.estado)]),
          ]))))
      : seccion('Inventario', 'Todo está en nivel. No hay nada que ordenar hoy.'),
  ].filter(Boolean));
}

/* ------------------------------------------------------------------ */
/* Inventario                                                          */
/* ------------------------------------------------------------------ */

async function vistaInventario() {
  const [productos, categorias, semanal] = await Promise.all([
    productosActivos(), DB.todos('categorias'), consumoSemanal(28),
  ]);
  const buscador = el('input', { type: 'search', placeholder: 'Buscar producto…', autocomplete: 'off' });
  const contenedor = el('div', { clase: 'tabla-envoltura' });

  const pintar = () => {
    const q = buscador.value.trim().toLowerCase();
    const lista = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q));
    contenedor.replaceChildren(tabla(
      ['Producto', 'Categoría', { t: 'Existencia', num: true }, { t: 'Máximo', num: true },
        { t: 'Mínimo', num: true }, { t: 'Consumo/sem', num: true }, { t: 'Costo', num: true }, 'Estado', ''],
      lista.map((p) => {
        const cat = categorias.find((c) => c.id === p.categoriaId);
        const cs = semanal.get(p.id) || 0;
        return el('tr', {}, [
          el('td', { texto: p.nombre }),
          el('td', { texto: cat ? cat.nombre : '—' }),
          el('td', { clase: 'num', texto: String(p.existencia) }),
          el('td', { clase: 'num', texto: String(p.par) }),
          el('td', { clase: 'num', texto: String(p.puntoReorden) }),
          el('td', { clase: 'num', texto: cs ? cs.toFixed(1) : '—' }),
          el('td', { clase: 'num', texto: p.costo ? dinero(p.costo) : '—' }),
          el('td', {}, [etiquetaEstado(estadoStock(p))]),
          el('td', { clase: 'num' }, [
            el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Editar', onclick: () => modalProducto(p) }),
          ]),
        ]);
      }),
    ).firstChild);
  };
  buscador.oninput = pintar;
  pintar();

  return el('div', {}, [
    seccion('Catálogo del almacén',
      'El máximo es cuánto debe haber con el almacén completo; el mínimo es el número al que hay que pedir ya. La columna Consumo/sem es el promedio real de las últimas cuatro semanas: si el proveedor tarda una semana en entregar, el máximo debe cubrir al menos ese número más un colchón.',
      el('div', { clase: 'seccion-barra' }, [
        el('div', { clase: 'crece campo', estilo: { marginBottom: '0' } }, [buscador]),
        el('button', { clase: 'btn btn-primario btn-chico', texto: 'Agregar producto', onclick: () => modalProducto(null) }),
      ]),
      contenedor),
  ]);
}

async function modalProducto(producto) {
  const categorias = (await DB.todos('categorias')).sort((a, b) => a.orden - b.orden);
  const esNuevo = !producto;
  const p = producto || {
    nombre: '', categoriaId: categorias[0]?.id, tamano: '750 ml',
    existencia: 0, par: 6, puntoReorden: 3, costo: 0,
  };

  const nombre = el('input', {
    type: 'text', value: p.nombre, autocapitalize: 'words', maxlength: String(LARGO.nombre),
  });
  /* Crear una categoría se hace aquí y no en una pantalla aparte: el momento
     en que hace falta una nueva es justo cuando estás dando de alta un producto
     que no encaja en ninguna. Mandar a la persona a otra pantalla, crearla y
     volver es el camino que nadie recorre —se escoge «Otros» y se pierde el
     dato para siempre. */
  const CATEGORIA_NUEVA = '__nueva__';
  const categoria = el('select', {}, [
    ...categorias.map((c) => el('option', {
      value: c.id, texto: c.nombre, selected: c.id === p.categoriaId,
    })),
    el('option', { value: CATEGORIA_NUEVA, texto: '＋ Escribir una categoría nueva…' }),
  ]);
  const categoriaNueva = el('input', {
    type: 'text', maxlength: '30', placeholder: 'Sake, Cordiales sin alcohol…', autocapitalize: 'words',
  });
  const campoNueva = campo('Nombre de la categoría nueva', categoriaNueva);
  campoNueva.hidden = true;
  categoria.onchange = () => {
    campoNueva.hidden = categoria.value !== CATEGORIA_NUEVA;
    if (!campoNueva.hidden) categoriaNueva.focus();
  };
  const tamano = el('input', { type: 'text', value: p.tamano || '', maxlength: String(LARGO.tamano) });
  const par = el('input', { type: 'number', min: '0', step: '1', value: String(p.par) });
  const reorden = el('input', { type: 'number', min: '0', step: '1', value: String(p.puntoReorden) });
  const costo = el('input', { type: 'number', min: '0', step: '0.01', value: String(p.costo || 0) });
  const existencia = el('input', { type: 'number', min: '0', step: '1', value: String(p.existencia) });
  const err = el('p', { clase: 'mensaje-error' });

  abrirModal({
    titulo: esNuevo ? 'Nuevo producto' : p.nombre,
    subtitulo: esNuevo ? null : 'La existencia no se edita aquí: se corrige con un conteo físico, que sí queda en el historial.',
    contenido: el('div', {}, [
      campo('Nombre', nombre),
      el('div', { clase: 'fila-campos' }, [campo('Categoría', categoria), campo('Tamaño', tamano)]),
      campoNueva,
      el('div', { clase: 'fila-campos-3' }, [
        campo('Máximo', par, 'Cuánto debe haber cuando el almacén está completo'),
        campo('Mínimo', reorden, 'Al llegar aquí se pone en rojo: hay que pedir'),
        campo('Costo por unidad', costo, 'USD, opcional'),
      ]),
      esNuevo ? campo('Existencia inicial', existencia, 'Lo que hay físicamente hoy en el almacén.') : null,
      err,
    ].filter(Boolean)),
    botones: [
      { texto: 'Cancelar', accion: cerrarModal },
      !esNuevo ? {
        texto: 'Retirar del catálogo',
        clase: 'btn-peligro',
        accion: async () => {
          cerrarModal();
          if (!await confirmar({
            titulo: 'Retirar del catálogo',
            mensaje: `${p.nombre} deja de aparecer en el panel de los empleados. El historial de movimientos se conserva completo.`,
            textoSi: 'Retirar',
            peligro: true,
          })) return;
          await DB.guardar('productos', { ...p, activo: false });
          await ctx.refrescarCache();
          brindis({ texto: 'Producto retirado', tipo: 'exito' });
          render();
        },
      } : null,
      {
        texto: 'Guardar',
        clase: 'btn-primario',
        accion: async () => {
          const n = nombre.value.trim();
          const vPar = parseInt(par.value, 10);
          const vReorden = parseInt(reorden.value, 10);
          const vExistencia = parseInt(existencia.value, 10);
          if (n.length < 2) { err.textContent = 'Escribe el nombre del producto.'; return; }
          if (n.length > LARGO.nombre) {
            err.textContent = `El nombre no puede pasar de ${LARGO.nombre} caracteres: no cabe en las teclas del panel ni en la lista impresa.`;
            return;
          }
          if (!Number.isInteger(vPar) || vPar < 0) { err.textContent = 'El máximo debe ser un entero de cero o más.'; return; }
          if (!Number.isInteger(vReorden) || vReorden < 0) { err.textContent = 'El mínimo debe ser un entero de cero o más.'; return; }
          if (vReorden > vPar) { err.textContent = 'El mínimo no puede ser mayor que el máximo: el producto se pondría en rojo permanentemente.'; return; }
          if (esNuevo && (!Number.isInteger(vExistencia) || vExistencia < 0)) { err.textContent = 'La existencia inicial debe ser un entero de cero o más.'; return; }

          /* Todo el guardado va en un try. Antes no lo tenía: si la escritura
             fallaba, la promesa se rechazaba sin que nada se lo dijera a la
             persona —ni aviso, ni cierre del modal, ni cambio en pantalla—. Se
             tocaba Guardar y no pasaba absolutamente nada, con lo que lo normal
             era volver a tocar. */
          try {
            /* La categoría nueva se crea antes de guardar el producto, para que
               este no quede apuntando a una que no existe. Se compara sin
               acentos ni mayúsculas: «Sake» y «sake» son la misma, y dos
               categorías con el mismo nombre parten el inventario en dos
               montones que nadie sabe por qué están separados. */
            let categoriaId = categoria.value;
            if (categoriaId === CATEGORIA_NUEVA) {
              const nom = categoriaNueva.value.trim();
              if (nom.length < 2) { err.textContent = 'Escribe el nombre de la categoría nueva.'; return; }
              /* Se relee de la base y no se usa el `categorias` capturado al
                 abrir el modal: ese es una foto vieja, y si por cualquier
                 camino ya existe una categoría con ese nombre, la foto no la
                 ve y se crea la duplicada que este mismo mensaje intenta
                 evitar. La comprobación tiene que ser contra lo que hay ahora. */
              const alDia = await DB.todos('categorias');
              const repetida = alDia.find((c) => normalizar(c.nombre) === normalizar(nom));
              if (repetida) {
                err.textContent = `Ya existe una categoría «${repetida.nombre}». Escógela en la lista.`;
                return;
              }
              const nueva = {
                id: nuevoId('c'),
                nombre: nom,
                color: '#7a8290',
                orden: Math.max(0, ...alDia.map((c) => c.orden)) + 1,
                activa: true,
              };
              await DB.guardar('categorias', nueva);
              categoriaId = nueva.id;
            }

            const guardado = {
              ...p,
              id: p.id || nuevoId('p'),
              nombre: n,
              categoriaId,
              tamano: tamano.value.trim(),
              par: vPar,
              puntoReorden: vReorden,
              costo: Math.max(0, Number(costo.value) || 0),
              existencia: esNuevo ? vExistencia : p.existencia,
              activo: true,
              ejemplo: false,
              orden: p.orden ?? 999,
              creado: p.creado || new Date().toISOString(),
            };
            await DB.guardar('productos', guardado);
            await ctx.refrescarCache();
            cerrarModal();
            brindis({ texto: esNuevo ? 'Producto agregado' : 'Producto actualizado', tipo: 'exito' });
            render();
          } catch (e) {
            err.textContent = `No se pudo guardar: ${e.message}`;
          }
        },
      },
    ].filter(Boolean),
  });
}

/* ------------------------------------------------------------------ */
/* Lista de compra y recepción                                         */
/* ------------------------------------------------------------------ */

/* La recepción NO se limita a lo que está bajo el par.

   Antes esta pantalla se construía solo desde listaCompra(), así que un producto
   que llegara sin estar bajo su nivel —una caja de más, algo para un evento, un
   producto nuevo— no aparecía y no había forma de recibirlo. La salida era
   meterlo por conteo físico, y entonces el historial decía "ajuste" en vez de
   "llegó mercancía del proveedor". Peor: con el inventario entero en nivel, la
   pantalla se rendía con un "no hay nada que ordenar" y no dejaba recibir nada.

   Ahora la lista de compra es la sugerencia, y el buscador deja añadir cualquier
   producto a la recepción. */
async function vistaCompra() {
  const [lista, productos] = await Promise.all([listaCompra(), productosActivos()]);
  const totalUnidades = lista.reduce((s, p) => s + p.aOrdenar, 0);
  const totalCosto = lista.reduce((s, p) => s + p.costoOrden, 0);

  /* productoId -> { producto, cantidad, sugerido } */
  const filas = new Map(lista.map((p) => [p.id, { producto: p, cantidad: p.aOrdenar, sugerido: p.aOrdenar }]));

  const contenedorTabla = el('div');
  const buscador = el('input', {
    type: 'search', placeholder: 'Buscar cualquier producto para añadirlo…',
    autocomplete: 'off', autocorrect: 'off', autocapitalize: 'none', spellcheck: 'false',
  });
  const resultados = el('div', { clase: 'resultados-busqueda' });

  const pintarTabla = () => {
    const items = [...filas.values()];
    contenedorTabla.replaceChildren(items.length
      ? tabla(
        ['Producto', 'Estado', { t: 'Quedan', num: true }, { t: 'Máximo', num: true },
          { t: 'Sugerido', num: true }, { t: 'Recibido', num: true }, ''],
        items.map(({ producto: p, cantidad, sugerido }) => {
          const entrada = el('input', {
            type: 'number', min: '0', step: '1', value: String(cantidad),
            estilo: { width: '92px', minHeight: '48px', textAlign: 'right' },
            oninput: () => {
              filas.get(p.id).cantidad = Math.max(0, parseInt(entrada.value, 10) || 0);
            },
          });
          return el('tr', {}, [
            el('td', { texto: p.nombre }),
            el('td', {}, [etiquetaEstado(estadoStock(p))]),
            el('td', { clase: 'num', texto: String(p.existencia) }),
            el('td', { clase: 'num', texto: String(p.par) }),
            el('td', { clase: 'num', texto: sugerido ? String(sugerido) : '—' }),
            el('td', { clase: 'num' }, [entrada]),
            el('td', { clase: 'num' }, [el('button', {
              clase: 'btn btn-chico btn-fantasma',
              texto: 'Quitar',
              onclick: () => { filas.delete(p.id); pintarTabla(); },
            })]),
          ]);
        }),
      )
      : el('p', { clase: 'vacio', texto: 'No hay nada en la recepción. Busca un producto arriba para añadirlo.' }));
  };

  const pintarResultados = () => {
    const q = normalizar(buscador.value.trim());
    if (q.length < 2) { resultados.replaceChildren(); return; }
    const encontrados = productos
      .filter((p) => !filas.has(p.id) && normalizar(`${p.nombre} ${p.tamano || ''}`).includes(q))
      .slice(0, 8);
    resultados.replaceChildren(...(encontrados.length
      ? encontrados.map((p) => el('button', {
        clase: 'btn btn-chico',
        texto: `${p.nombre}${p.tamano ? ` · ${p.tamano}` : ''}  (quedan ${p.existencia})`,
        onclick: () => {
          filas.set(p.id, { producto: p, cantidad: 0, sugerido: 0 });
          buscador.value = '';
          resultados.replaceChildren();
          pintarTabla();
        },
      }))
      : [el('p', { clase: 'ayuda', texto: 'Ningún producto con ese nombre.' })]));
  };

  buscador.oninput = pintarResultados;
  pintarTabla();

  const proveedor = el('input', { type: 'text', maxlength: String(LARGO.referencia), placeholder: 'Proveedor o número de factura' });

  return el('div', {}, [
    seccion('Lista de compra',
      lista.length
        ? `${lista.length} productos bajo el máximo · ${totalUnidades} unidades sugeridas · ${dinero(totalCosto)} estimado a costo.`
        : 'Todo el inventario está en nivel: no hay nada que ordenar hoy. Si aun así llega mercancía, se recibe abajo.',
      lista.length ? el('div', { clase: 'seccion-barra' }, [
        el('span', { clase: 'crece' }),
        el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Exportar CSV', onclick: () => exportarCompra(lista) }),
        el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Imprimir', onclick: () => window.print() }),
      ]) : null),

    seccion('Recibir la orden',
      'Ajusta la columna Recibido con lo que de verdad entró —no con lo que se pidió— y confirma. Entra al almacén solo lo que escribas aquí. Si llegó algo que no estaba en la lista, búscalo y añádelo.',
      campo('Añadir un producto que no está en la lista', buscador),
      resultados,
      contenedorTabla,
      campo('Referencia', proveedor, 'Queda en el historial junto a la entrada.'),
      el('button', {
        clase: 'btn btn-primario',
        texto: 'Registrar entrada al almacén',
        onclick: async () => {
          const lineas = [...filas.values()]
            .filter(({ cantidad }) => cantidad > 0)
            .map(({ producto, cantidad }) => ({ productoId: producto.id, cantidad }));
          if (!lineas.length) { brindis({ texto: 'No hay cantidades que registrar', tipo: 'error' }); return; }
          const total = lineas.reduce((s, l) => s + l.cantidad, 0);
          if (!await confirmar({
            titulo: 'Registrar entrada',
            mensaje: `Van a entrar ${total} unidades al almacén en ${lineas.length} productos. Esto suma al inventario y queda en el historial a tu nombre.`,
            textoSi: 'Registrar',
          })) return;
          try {
            await registrarLote({
              tipo: 'entrada',
              lineas,
              empleadoId: ctx.gerente.id,
              empleadoNombre: ctx.gerente.nombre,
              motivo: proveedor.value.trim() || 'Entrada de mercancía',
            });
            await ctx.refrescarCache();
            brindis({ texto: `Entrada registrada: ${total} unidades`, tipo: 'exito' });
            render();
          } catch (e) {
            brindis({ texto: 'No se registró', sub: e.message, tipo: 'error', segundos: 8 });
          }
        },
      })),
  ]);
}

function exportarCompra(lista) {
  const filas = [['Producto', 'Existencia', 'Maximo', 'A ordenar', 'Costo unitario', 'Costo total']];
  for (const p of lista) filas.push([p.nombre, p.existencia, p.par, p.aOrdenar, p.costo || 0, p.costoOrden.toFixed(2)]);
  descargar(`lista-compra-${fechaPR()}.csv`, aCSV(filas), 'text/csv');
}

/* ------------------------------------------------------------------ */
/* Conteo físico                                                       */
/* ------------------------------------------------------------------ */

async function vistaConteo() {
  const productos = await productosActivos();
  const contados = new Map();
  const motivo = el('input', { type: 'text', maxlength: String(LARGO.motivo), placeholder: 'Conteo semanal, rotura, merma…' });
  const resumen = el('p', { clase: 'desc', texto: 'Ningún producto tiene diferencia todavía.' });

  const actualizar = () => {
    const dif = [...contados.entries()].filter(([id, v]) => {
      const p = productos.find((x) => x.id === id);
      return p && v !== p.existencia;
    });
    resumen.textContent = dif.length
      ? `${dif.length} ${dif.length === 1 ? 'producto tiene' : 'productos tienen'} diferencia con el sistema.`
      : 'Ningún producto tiene diferencia todavía.';
  };

  const filas = productos.map((p) => {
    const entrada = el('input', {
      type: 'number', min: '0', step: '1', placeholder: String(p.existencia),
      estilo: { width: '100px', minHeight: '48px', textAlign: 'right' },
      oninput: () => {
        const v = parseInt(entrada.value, 10);
        if (Number.isInteger(v) && v >= 0) contados.set(p.id, v); else contados.delete(p.id);
        const d = contados.has(p.id) ? contados.get(p.id) - p.existencia : 0;
        celdaDif.textContent = contados.has(p.id) && d !== 0 ? (d > 0 ? `+${d}` : String(d)) : '—';
        celdaDif.style.color = d > 0 ? 'var(--ok)' : (d < 0 ? 'var(--critico)' : 'var(--texto-3)');
        actualizar();
      },
    });
    const celdaDif = el('td', { clase: 'num', texto: '—', estilo: { color: 'var(--texto-3)' } });
    return el('tr', {}, [
      el('td', { texto: p.nombre }),
      el('td', { clase: 'num', texto: String(p.existencia) }),
      el('td', { clase: 'num' }, [entrada]),
      celdaDif,
    ]);
  });

  return el('div', {}, [
    seccion('Conteo físico',
      'Escribe lo que hay de verdad en la tara. Solo se registran los productos donde escribas algo distinto a lo que dice el sistema. Los demás no se tocan.',
      resumen,
      campo('Motivo del ajuste', motivo, 'Obligatorio. Queda en el historial junto a cada diferencia.'),
      tabla(['Producto', { t: 'Según el sistema', num: true }, { t: 'Contado', num: true }, { t: 'Diferencia', num: true }], filas),
      el('div', { estilo: { marginTop: '18px' } }, [
        el('button', {
          clase: 'btn btn-primario',
          texto: 'Registrar el conteo',
          onclick: async () => {
            if (!motivo.value.trim()) { brindis({ texto: 'Falta el motivo del ajuste', tipo: 'error' }); return; }
            const lineas = [...contados.entries()]
              .filter(([id, v]) => {
                const p = productos.find((x) => x.id === id);
                return p && v !== p.existencia;
              })
              .map(([productoId, nuevaExistencia]) => ({ productoId, nuevaExistencia, cantidad: 1 }));
            if (!lineas.length) { brindis({ texto: 'No hay ninguna diferencia que registrar', tipo: 'error' }); return; }
            if (!await confirmar({
              titulo: 'Registrar conteo físico',
              mensaje: `Se van a ajustar ${lineas.length} productos. El inventario queda igual a lo contado y la diferencia se guarda en el historial a tu nombre.`,
              textoSi: 'Registrar',
            })) return;
            try {
              await registrarLote({
                tipo: 'ajuste',
                lineas,
                empleadoId: ctx.gerente.id,
                empleadoNombre: ctx.gerente.nombre,
                motivo: motivo.value.trim(),
              });
              await ctx.refrescarCache();
              brindis({ texto: 'Conteo registrado', sub: `${lineas.length} productos ajustados`, tipo: 'exito' });
              render();
            } catch (e) {
              brindis({ texto: 'No se registró', sub: e.message, tipo: 'error', segundos: 8 });
            }
          },
        }),
      ])),
  ]);
}

/* ------------------------------------------------------------------ */
/* Devoluciones                                                        */
/* ------------------------------------------------------------------ */

async function vistaDevolucion() {
  const [productos, restaurantes] = await Promise.all([productosActivos(), DB.todos('restaurantes')]);
  const cantidades = new Map();
  const restaurante = el('select', {}, restaurantes.sort((a, b) => a.orden - b.orden)
    .map((r) => el('option', { value: r.id, texto: r.nombre })));
  const motivo = el('input', { type: 'text', maxlength: String(LARGO.motivo), placeholder: 'Botella sin abrir, pedido cancelado…' });
  const buscador = el('input', { type: 'search', placeholder: 'Buscar producto…', autocomplete: 'off' });
  const contenedor = el('div');

  const pintar = () => {
    const q = buscador.value.trim().toLowerCase();
    const lista = productos.filter((p) => !q || p.nombre.toLowerCase().includes(q)).slice(0, 40);
    contenedor.replaceChildren(tabla(
      ['Producto', { t: 'En almacén', num: true }, { t: 'Devuelven', num: true }],
      lista.map((p) => {
        const entrada = el('input', {
          type: 'number', min: '0', step: '1', value: String(cantidades.get(p.id) || ''),
          estilo: { width: '100px', minHeight: '48px', textAlign: 'right' },
          oninput: () => {
            const v = parseInt(entrada.value, 10);
            if (Number.isInteger(v) && v > 0) cantidades.set(p.id, v); else cantidades.delete(p.id);
          },
        });
        return el('tr', {}, [
          el('td', { texto: p.nombre }),
          el('td', { clase: 'num', texto: String(p.existencia) }),
          el('td', { clase: 'num' }, [entrada]),
        ]);
      }),
    ));
  };
  buscador.oninput = pintar;
  pintar();

  return el('div', {}, [
    seccion('Devolución al almacén',
      'Un restaurante baja una botella sin abrir y la regresa. Suma al almacén y descuenta del consumo de ese restaurante, con registro de quién la trajo.',
      el('div', { clase: 'fila-campos' }, [
        campo('Restaurante que devuelve', restaurante),
        campo('Motivo', motivo, 'Obligatorio.'),
      ]),
      campo('Buscar', buscador),
      contenedor,
      el('div', { estilo: { marginTop: '18px' } }, [
        el('button', {
          clase: 'btn btn-primario',
          texto: 'Registrar devolución',
          onclick: async () => {
            if (!motivo.value.trim()) { brindis({ texto: 'Falta el motivo', tipo: 'error' }); return; }
            const lineas = [...cantidades.entries()].map(([productoId, cantidad]) => ({ productoId, cantidad }));
            if (!lineas.length) { brindis({ texto: 'No hay cantidades', tipo: 'error' }); return; }
            try {
              await registrarLote({
                tipo: 'devolucion',
                lineas,
                empleadoId: ctx.gerente.id,
                empleadoNombre: ctx.gerente.nombre,
                restauranteId: restaurante.value,
                motivo: motivo.value.trim(),
              });
              await ctx.refrescarCache();
              brindis({ texto: 'Devolución registrada', tipo: 'exito' });
              render();
            } catch (e) {
              brindis({ texto: 'No se registró', sub: e.message, tipo: 'error', segundos: 8 });
            }
          },
        }),
      ])),
  ]);
}

/* ------------------------------------------------------------------ */
/* Salida manual                                                       */
/* ------------------------------------------------------------------ */

/* Por qué existe: hasta ahora las botellas solo salían por el panel del
   empleado, y un gerente no puede entrar ahí —su código lo manda directo a
   Administración—. Si el propio gerente bajaba una caja a La Madre, lo único
   que le reducía el inventario era el conteo físico, y ese ajuste no se le
   carga a ningún restaurante: la botella desaparecía del almacén sin aparecer
   en el consumo de nadie, y el reparto de costos entre los cuatro locales
   quedaba corto.

   Por qué queda marcada: acá el gerente ESCOGE el restaurante. En el panel del
   empleado no se escoge nada, lo resuelve el código. Son dos cosas distintas y
   el historial tiene que decirlo, o esta pantalla se convierte en la única
   puerta para mover inventario a mano y que se lea igual que el registro
   honesto. De ahí `origen: 'admin'` y la etiqueta en el historial.

   Por qué el motivo es obligatorio aunque el modelo no lo exija para las
   salidas: la salida de un empleado se explica sola (bajó al almacén en su
   turno). Esta no. */
async function vistaSalidaManual() {
  const [productos, restaurantes] = await Promise.all([productosActivos(), DB.todos('restaurantes')]);
  const cantidades = new Map();
  const restaurante = el('select', {}, restaurantes.sort((a, b) => a.orden - b.orden)
    .map((r) => el('option', { value: r.id, texto: r.nombre })));
  const motivo = el('input', {
    type: 'text',
    maxlength: String(LARGO.motivo),
    placeholder: 'Bajé una caja para el servicio de la noche…',
  });
  const buscador = el('input', { type: 'search', placeholder: 'Buscar producto…', autocomplete: 'off' });
  const contenedor = el('div');

  const pintar = () => {
    const q = normalizar(buscador.value.trim());
    const lista = productos
      .filter((p) => !q || normalizar(`${p.nombre} ${p.tamano || ''}`).includes(q))
      .slice(0, 40);
    contenedor.replaceChildren(tabla(
      ['Producto', { t: 'En almacén', num: true }, { t: 'Sacan', num: true }],
      lista.map((p) => {
        const entrada = el('input', {
          type: 'number', min: '0', step: '1', max: String(p.existencia),
          value: String(cantidades.get(p.id) || ''),
          estilo: { width: '100px', minHeight: '48px', textAlign: 'right' },
          oninput: () => {
            const v = parseInt(entrada.value, 10);
            if (Number.isInteger(v) && v > 0) cantidades.set(p.id, v); else cantidades.delete(p.id);
          },
        });
        return el('tr', {}, [
          el('td', { texto: p.nombre }),
          el('td', { clase: 'num', texto: String(p.existencia) }),
          el('td', { clase: 'num' }, [entrada]),
        ]);
      }),
    ));
  };
  buscador.oninput = pintar;
  pintar();

  const registrar = async () => {
    if (!motivo.value.trim()) { brindis({ texto: 'Falta el motivo', tipo: 'error' }); return; }
    const lineas = [...cantidades.entries()].map(([productoId, cantidad]) => ({ productoId, cantidad }));
    if (!lineas.length) { brindis({ texto: 'No hay cantidades', tipo: 'error' }); return; }

    /* Sin existencia no se fuerza el negativo. En el panel del empleado un
       gerente puede autorizar la excepción porque son dos personas; acá el
       gerente se autorizaría a sí mismo y eso no es un control. Si el número
       no cuadra, lo que está mal es el conteo. */
    const faltan = lineas
      .map((l) => ({ l, p: productos.find((x) => x.id === l.productoId) }))
      .filter(({ l, p }) => p && l.cantidad > p.existencia);
    if (faltan.length) {
      const detalle = faltan.map(({ l, p }) => `${p.nombre}: sacas ${l.cantidad}, quedan ${p.existencia}`).join('. ');
      brindis({
        texto: 'No hay suficiente en el almacén',
        sub: `${detalle}. Si el almacén sí las tiene, el conteo del sistema está mal: corrígelo en Conteo físico y vuelve.`,
        tipo: 'error',
        segundos: 12,
      });
      return;
    }

    const nombreLocal = restaurantes.find((r) => r.id === restaurante.value)?.nombre || '';
    if (!await confirmarLineas({
      lineas,
      productos,
      titulo: 'salida manual',
      subtitulo: `Sale del almacén hacia ${nombreLocal} y queda registrado a nombre de ${ctx.gerente.nombre}, `
        + 'marcado como salida hecha desde gerencia. Solo se corrige con una reversión, que también queda en el historial.',
    })) return;

    try {
      await registrarLote({
        tipo: 'salida',
        lineas,
        empleadoId: ctx.gerente.id,
        empleadoNombre: ctx.gerente.nombre,
        restauranteId: restaurante.value,
        motivo: motivo.value.trim(),
        origen: 'admin',
      });
      await ctx.refrescarCache();
      const total = lineas.reduce((s, l) => s + l.cantidad, 0);
      brindis({ texto: `Salida registrada: ${total} ${total === 1 ? 'botella' : 'botellas'}`, tipo: 'exito' });
      render();
    } catch (e) {
      brindis({ texto: 'No se registró', sub: e.message, tipo: 'error', segundos: 8 });
    }
  };

  return el('div', {}, [
    seccion('Salida manual desde gerencia',
      'Para cuando el licor lo baja la gerencia y no un empleado con su código. Descuenta del almacén y se lo carga '
      + 'al restaurante que escojas, igual que una salida normal. En el historial queda marcada como hecha desde '
      + 'gerencia, para que se distinga de las que registra el personal con su código.',
      el('div', { clase: 'fila-campos' }, [
        campo('Restaurante que se lo lleva', restaurante),
        campo('Motivo', motivo, 'Obligatorio. Queda en el historial junto a la salida.'),
      ]),
      campo('Buscar', buscador),
      contenedor,
      el('div', { estilo: { marginTop: '18px' } }, [
        el('button', { clase: 'btn btn-primario', texto: 'Registrar salida', onclick: registrar }),
      ])),
  ]);
}

/* Confirmación con la lista a la vista, no un «¿Estás seguro?» genérico: un
   modal que no se lee no evita ningún error y solo añade un toque. */
function confirmarLineas({ lineas, productos, titulo, subtitulo }) {
  const total = lineas.reduce((s, l) => s + l.cantidad, 0);
  const filas = lineas.map((l) => {
    const p = productos.find((x) => x.id === l.productoId);
    return el('div', { clase: 'linea-confirmar' }, [
      el('span', { clase: 'n', texto: p ? p.nombre : 'Producto' }),
      el('span', { clase: 'q', texto: String(l.cantidad) }),
    ]);
  });

  return new Promise((resolver) => {
    let decidido = false;
    const responder = (v) => { if (!decidido) { decidido = true; resolver(v); } };
    abrirModal({
      titulo: `¿Registrar ${titulo} de ${total} ${total === 1 ? 'botella' : 'botellas'}?`,
      subtitulo,
      contenido: el('div', { clase: 'lista-confirmar' }, filas),
      botones: [
        { texto: 'Revisar', accion: () => { responder(false); cerrarModal(); } },
        {
          texto: 'Sí, registrar',
          clase: 'btn-primario',
          // Se responde ANTES de cerrar: cerrarModal dispara alCerrar, y al
          // revés ese alCerrar resuelve en false y no se registra nada.
          accion: () => { responder(true); cerrarModal(); },
        },
      ],
      alCerrar: () => responder(false),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Reportes                                                            */
/* ------------------------------------------------------------------ */

const PRESETS = [
  ['hoy', 'Hoy'],
  ['ayer', 'Ayer'],
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['mes', 'Este mes'],
];

/* Los rangos se cuentan desde el día operativo, no desde la fecha del
   calendario. Con `fechaPR()`, a la 1:00 a.m. «Hoy» salía vacío y la noche que
   el gerente acababa de cerrar aparecía bajo «Ayer»: exactamente al revés de lo
   que dice el resto del sistema. */
function rangoPreset(clave) {
  const hoy = hoyOperativo;
  if (clave === 'hoy') return [hoy, hoy];
  if (clave === 'ayer') { const a = sumarDias(hoy, -1); return [a, a]; }
  if (clave === 'mes') return [`${hoy.slice(0, 7)}-01`, hoy];
  return [sumarDias(hoy, -(parseInt(clave, 10) - 1)), hoy];
}

/* Se resuelve al pintar y no al cargar el módulo: acá arriba todavía no se ha
   leído la configuración, y el rango habría quedado clavado a la fecha del
   calendario para toda la sesión. */
let rangoReporte = null;

async function vistaReportes() {
  if (!rangoReporte) rangoReporte = rangoPreset('7');
  const [desde, hasta] = rangoReporte;
  const [movs, restaurantes, empleados] = await Promise.all([
    movimientosPeriodo(desde, hasta), DB.todos('restaurantes'), DB.todos('empleados'),
  ]);

  const nombreRest = (id) => restaurantes.find((r) => r.id === id)?.nombre || '—';
  const nombreEmp = (id) => empleados.find((e) => e.id === id)?.nombre || '—';

  const rest = porRestaurante(movs);
  const emp = porEmpleado(movs);
  const prod = porProducto(movs);
  const totalUnidades = rest.reduce((s, r) => s + r.unidades, 0);
  const totalValor = rest.reduce((s, r) => s + r.valor, 0);

  const entradaDesde = el('input', { type: 'date', value: desde });
  const entradaHasta = el('input', { type: 'date', value: hasta });
  const aplicar = () => {
    if (entradaDesde.value && entradaHasta.value && entradaDesde.value <= entradaHasta.value) {
      rangoReporte = [entradaDesde.value, entradaHasta.value];
      render();
    }
  };
  entradaDesde.onchange = aplicar;
  entradaHasta.onchange = aplicar;

  const nombreProd = (id) => movs.find((m) => m.productoId === id)?.productoNombre || '—';

  return el('div', {}, [
    seccion(null, null, el('div', { clase: 'seccion-barra' }, [
      ...PRESETS.map(([clave, etiqueta]) => el('button', {
        clase: 'btn btn-chico btn-fantasma',
        texto: etiqueta,
        onclick: () => { rangoReporte = rangoPreset(clave); render(); },
      })),
      el('div', { clase: 'campo', estilo: { marginBottom: '0' } }, [entradaDesde]),
      el('div', { clase: 'campo', estilo: { marginBottom: '0' } }, [entradaHasta]),
      el('span', { clase: 'crece' }),
      el('button', {
        clase: 'btn btn-chico btn-fantasma',
        texto: 'Exportar CSV',
        onclick: () => exportarMovimientos(movs, nombreRest),
      }),
    ])),

    el('div', { clase: 'tarjetas-resumen' }, [
      el('div', { clase: 'tarjeta-dato' }, [
        el('div', { clase: 'v', texto: numero(totalUnidades) }),
        el('div', { clase: 'e', texto: `botellas salidas · ${desde} a ${hasta}` }),
      ]),
      el('div', { clase: 'tarjeta-dato' }, [
        el('div', { clase: 'v', texto: dinero(totalValor) }),
        el('div', { clase: 'e', texto: 'valor a costo de lo que salió' }),
      ]),
      el('div', { clase: 'tarjeta-dato' }, [
        el('div', { clase: 'v', texto: numero(movs.length) }),
        el('div', { clase: 'e', texto: 'movimientos registrados' }),
      ]),
    ]),

    seccion('Consumo por restaurante', 'Esto es reparto de costos: cuánto licor se llevó cada local en el período.',
      rest.length
        ? tabla(['Restaurante', { t: 'Botellas', num: true }, { t: 'Valor a costo', num: true }, { t: 'Salidas', num: true }],
          rest.map((r) => el('tr', {}, [
            el('td', { texto: nombreRest(r.clave) }),
            el('td', { clase: 'num', texto: numero(r.unidades) }),
            el('td', { clase: 'num', texto: dinero(r.valor) }),
            el('td', { clase: 'num', texto: numero(r.movimientos) }),
          ])))
        : el('p', { clase: 'vacio', texto: 'No hubo salidas en este período.' })),

    emp.length ? seccion('Por empleado', null,
      tabla(['Empleado', 'Restaurante', { t: 'Botellas', num: true }, { t: 'Valor', num: true }],
        emp.map((e) => {
          const suyos = movs.filter((m) => m.empleadoId === e.clave);
          /* Esta columna mostraba el restaurante del primer movimiento. Con un
             empleado da igual —pertenece a uno solo—, pero un gerente escoge el
             local en cada salida manual, y entonces la celda decía «La Madre»
             sobre un total que incluía otros tres locales. */
          const locales = [...new Set(suyos.map((m) => m.restauranteId).filter(Boolean))];
          return el('tr', {}, [
            el('td', {}, [
              el('span', { texto: nombreEmp(e.clave) }),
              suyos.some((m) => m.origen === 'admin')
                ? el('span', { clase: 'etiqueta origen-admin', estilo: { marginLeft: '8px' }, texto: 'Desde gerencia' })
                : null,
            ].filter(Boolean)),
            el('td', { texto: locales.length > 1 ? `Varios (${locales.length})` : nombreRest(locales[0]) }),
            el('td', { clase: 'num', texto: numero(e.unidades) }),
            el('td', { clase: 'num', texto: dinero(e.valor) }),
          ]);
        }))) : null,

    prod.length ? seccion('Por producto', null,
      tabla(['Producto', { t: 'Botellas', num: true }, { t: 'Valor', num: true }],
        prod.slice(0, 25).map((p) => el('tr', {}, [
          el('td', { texto: nombreProd(p.clave) }),
          el('td', { clase: 'num', texto: numero(p.unidades) }),
          el('td', { clase: 'num', texto: dinero(p.valor) }),
        ])))) : null,
  ].filter(Boolean));
}

function exportarMovimientos(movs, nombreRest) {
  const filas = [['Fecha y hora', 'Dia operativo', 'Tipo', 'Registrado desde', 'Producto', 'Cantidad',
    'Restaurante', 'Empleado', 'Existencia antes', 'Existencia despues', 'Costo unitario',
    'Motivo', 'Autorizado por']];
  for (const m of movs) {
    filas.push([
      fechaHoraPR(m.fechaISO), m.diaOperativo, TIPOS[m.tipo]?.etiqueta || m.tipo,
      // Los movimientos de antes de este campo no lo tienen. Se declaran como
      // del panel del empleado, que es el único origen que existía entonces.
      m.origen === 'admin' ? 'Gerencia' : 'Panel del empleado',
      m.productoNombre, m.delta, m.restauranteId ? nombreRest(m.restauranteId) : '',
      m.empleadoNombre, m.existenciaAntes, m.existenciaDespues,
      m.costoUnitario || 0, m.motivo || '', m.autorizadoPor || '',
    ]);
  }
  descargar(`movimientos-${fechaPR()}.csv`, aCSV(filas), 'text/csv');
}

/* ------------------------------------------------------------------ */
/* Historial                                                           */
/* ------------------------------------------------------------------ */

async function vistaHistorial() {
  if (!rangoReporte) rangoReporte = rangoPreset('7');
  const [desde, hasta] = rangoReporte;
  const [movs, restaurantes, restauraciones] = await Promise.all([
    movimientosPeriodo(desde, hasta), DB.todos('restaurantes'),
    DB.leerConfig('restauraciones', []),
  ]);
  const nombreRest = (id) => restaurantes.find((r) => r.id === id)?.nombre || '—';

  /* Los movimientos vienen ya ordenados de más nuevo a más viejo, y Map
     conserva el orden de inserción: agrupar no altera el orden de la lista. */
  const lotes = new Map();
  for (const m of movs) {
    let g = lotes.get(m.loteId);
    if (!g) {
      g = {
        loteId: m.loteId,
        fechaISO: m.fechaISO,
        tipo: m.tipo,
        empleadoNombre: m.empleadoNombre,
        restauranteId: m.restauranteId,
        motivo: m.motivo,
        autorizadoPor: m.autorizadoPor,
        origen: m.origen,
        lineas: [],
      };
      lotes.set(m.loteId, g);
    }
    g.lineas.push(m);
  }
  const grupos = [...lotes.values()];

  return el('div', {}, [
    /* Va arriba del historial y no escondido en Sistema: quien viene a leer
       este registro como evidencia es justo quien tiene que enterarse de que
       alguien restauró un respaldo, porque es la única operación que puede
       cambiar lo que hay aquí. */
    restauraciones.length ? el('div', { clase: 'aviso-banda' }, [
      el('div', { clase: 'crece' }, [
        el('b', {
          texto: restauraciones.length === 1
            ? 'Se restauró un respaldo en este iPad'
            : `Se restauraron ${restauraciones.length} respaldos en este iPad`,
        }),
        el('span', {
          texto: restauraciones.slice(-3).reverse().map((r) => (
            `${fechaHoraPR(r.fechaISO)} · ${r.gerente} · el historial pasó de ${r.movimientosAntes} a ${r.movimientosDespues} movimientos`
          )).join('\n'),
          estilo: { whiteSpace: 'pre-line' },
        }),
      ]),
    ]) : null,

    seccion('Historial de movimientos',
      'Cada fila es una operación completa: quién, cuándo y para qué restaurante. Tócala para ver qué se llevó. '
      + 'Registro sin borrar: una corrección no elimina nada, suma una reversión que también queda aquí.',
      el('div', { clase: 'seccion-barra' }, [
        ...PRESETS.map(([clave, etiqueta]) => el('button', {
          clase: 'btn btn-chico btn-fantasma',
          texto: etiqueta,
          onclick: () => { rangoReporte = rangoPreset(clave); render(); },
        })),
        el('span', { clase: 'crece' }),
        el('button', {
          clase: 'btn btn-chico btn-fantasma',
          texto: 'Exportar CSV',
          onclick: () => exportarMovimientos(movs, nombreRest),
        }),
      ]),
      grupos.length
        ? tabla(['Fecha y hora', 'Tipo', 'Quién', 'Restaurante', 'Se llevó', 'Motivo', ''],
          grupos.slice(0, 300).flatMap((g) => filaLote(g, nombreRest)))
        : el('p', { clase: 'vacio', texto: 'No hay movimientos en este período.' })),
  ].filter(Boolean));
}

/* Una operación = una fila, no una fila por botella.

   Antes se listaba movimiento por movimiento, y quien sacaba seis licores
   ocupaba seis renglones idénticos salvo el nombre del producto. Peor: el botón
   "Revertir" de cada renglón llamaba a revertirLote(), o sea que deshacía la
   salida entera y no esa línea. La fila agrupada dice la verdad sobre lo que
   hace ese botón. Al tocarla se abre el desglose. */
function filaLote(g, nombreRest) {
  const botellas = g.lineas.reduce((s, m) => s + Math.abs(m.delta), 0);
  const detalle = el('tr', { clase: 'fila-detalle', hidden: true }, [
    el('td', { colspan: '7' }, [
      el('div', { clase: 'desglose' }, [
        tabla(['Producto', { t: 'Cambio', num: true }],
          g.lineas.map((m) => el('tr', {}, [
            el('td', { texto: m.productoNombre }),
            el('td', { clase: 'num', texto: m.delta > 0 ? `+${m.delta}` : String(m.delta) }),
          ]))),
      ]),
    ]),
  ]);

  const fila = el('tr', {
    clase: 'fila-lote',
    onclick: () => {
      detalle.hidden = !detalle.hidden;
      fila.classList.toggle('abierta', !detalle.hidden);
    },
  }, [
    el('td', { texto: fechaHoraPR(g.fechaISO) }),
    el('td', {}, [
      el('span', {
        clase: `etiqueta ${g.tipo === 'salida' ? 'critico' : (g.tipo === 'reversion' ? 'agotado' : 'ok')}`,
        texto: TIPOS[g.tipo]?.etiqueta || g.tipo,
      }),
      /* Solo en las salidas. Entradas, ajustes, devoluciones y reversiones
         únicamente ocurren en el panel de gerencia, así que marcarlas no diría
         nada. La salida es el único movimiento con dos orígenes posibles, y
         por eso es el único donde hace falta distinguirlos. */
      g.tipo === 'salida' && g.origen === 'admin'
        ? el('span', { clase: 'etiqueta origen-admin', texto: 'Desde gerencia' })
        : null,
    ].filter(Boolean)),
    el('td', { texto: g.empleadoNombre }),
    el('td', { texto: g.restauranteId ? nombreRest(g.restauranteId) : '—' }),
    el('td', {}, [
      el('span', { clase: 'resumen-lote', texto: `${botellas} ${botellas === 1 ? 'botella' : 'botellas'}` }),
      el('span', {
        clase: 'desc',
        estilo: { margin: '0' },
        texto: `${g.lineas.length} ${g.lineas.length === 1 ? 'producto' : 'productos'} · tocar para ver`,
      }),
    ]),
    el('td', { texto: [g.motivo, g.autorizadoPor ? `Autorizó ${g.autorizadoPor}` : ''].filter(Boolean).join(' · ') || '—' }),
    el('td', { clase: 'num' }, [
      g.tipo === 'reversion' ? null : el('button', {
        clase: 'btn btn-chico btn-fantasma',
        texto: 'Revertir',
        onclick: (ev) => { ev.stopPropagation(); revertir(g); },
      }),
    ].filter(Boolean)),
  ]);

  return [fila, detalle];
}

async function revertir(g) {
  const cuantos = `${g.lineas.length} ${g.lineas.length === 1 ? 'producto' : 'productos'}`;
  if (!await confirmar({
    titulo: 'Revertir la operación completa',
    mensaje: `Se va a deshacer la ${TIPOS[g.tipo]?.etiqueta.toLowerCase()} de ${fechaHoraPR(g.fechaISO)} `
      + `a nombre de ${g.empleadoNombre}, con ${cuantos}. Se deshace entera, no por producto. `
      + 'No se borra nada: se registra una reversión a tu nombre y el original queda visible en el historial.',
    textoSi: 'Revertir',
    peligro: true,
  })) return;
  try {
    await revertirLote(g.loteId, {
      empleadoId: ctx.gerente.id,
      empleadoNombre: ctx.gerente.nombre,
      motivo: 'Reversión desde administración',
    });
    await ctx.refrescarCache();
    brindis({ texto: 'Movimiento revertido', tipo: 'exito' });
    render();
  } catch (e) {
    brindis({ texto: 'No se pudo revertir', sub: e.message, tipo: 'error', segundos: 8 });
  }
}

/* ------------------------------------------------------------------ */
/* Empleados                                                           */
/* ------------------------------------------------------------------ */

async function vistaEmpleados() {
  const [empleados, restaurantes] = await Promise.all([DB.todos('empleados'), DB.todos('restaurantes')]);
  const activos = empleados.filter((e) => e.activo);
  const gerentes = activos.filter((e) => e.rol === 'gerente');

  const bloques = restaurantes.sort((a, b) => a.orden - b.orden).map((r) => {
    const suyos = activos.filter((e) => e.restauranteId === r.id && e.rol === 'empleado')
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    return seccion(r.nombre, `${suyos.length} ${suyos.length === 1 ? 'empleado' : 'empleados'}`,
      el('div', { clase: 'lista-simple' }, suyos.length
        ? suyos.map((e) => filaEmpleado(e, r))
        : [el('p', { clase: 'vacio', texto: 'Sin empleados registrados.' })]),
      el('button', {
        clase: 'btn btn-chico btn-fantasma',
        texto: `Agregar empleado a ${r.nombre}`,
        estilo: { marginTop: '12px' },
        onclick: () => modalEmpleado(null, r.id),
      }));
  });

  return el('div', {}, [
    gerentes.length < 2 ? el('div', { clase: 'aviso-banda' }, [
      el('div', { clase: 'crece' }, [
        el('b', { texto: 'Solo hay un gerente registrado' }),
        'El día que esa persona no esté, nadie puede recibir mercancía, ajustar el conteo ni sacar reportes. Registra un segundo gerente.',
      ]),
      el('button', { clase: 'btn btn-primario btn-chico', texto: 'Agregar gerente', onclick: () => modalEmpleado(null, null, 'gerente') }),
    ]) : null,
    seccion('Gerencia', `Con su código entran directo a Administración. Mismo teclado que el personal, ${LARGO_CODIGO} dígitos.`,
      el('div', { clase: 'lista-simple' }, gerentes.map((g) => filaEmpleado(g, null))),
      el('button', {
        clase: 'btn btn-chico btn-fantasma',
        texto: 'Agregar gerente',
        estilo: { marginTop: '12px' },
        onclick: () => modalEmpleado(null, null, 'gerente'),
      })),
    ...bloques,
  ].filter(Boolean));
}

function filaEmpleado(e, restaurante) {
  return el('div', { clase: 'item-lista' }, [
    el('div', { clase: 'crece' }, [
      el('div', { clase: 't', texto: e.nombre }),
      el('div', {
        clase: 's',
        texto: [
          e.rol === 'gerente' ? 'Gerencia' : (restaurante ? restaurante.nombre : ''),
          e.codigo ? 'código asignado' : 'SIN CÓDIGO: no puede entrar',
          e.ejemplo ? 'de ejemplo' : '',
        ].filter(Boolean).join(' · '),
      }),
    ]),
    el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Editar', onclick: () => modalEmpleado(e) }),
  ]);
}

async function modalEmpleado(empleado, restauranteId = null, rolFijo = null) {
  const restaurantes = await DB.todos('restaurantes');
  const esNuevo = !empleado;
  const rol = rolFijo || empleado?.rol || 'empleado';

  const nombre = el('input', {
    type: 'text', value: empleado?.nombre || '', autocapitalize: 'words', maxlength: String(LARGO.empleado),
  });
  const selRest = el('select', {}, restaurantes.sort((a, b) => a.orden - b.orden).map((r) => el('option', {
    value: r.id, texto: r.nombre, selected: r.id === (empleado?.restauranteId || restauranteId),
  })));
  const codigo = el('input', {
    type: 'text', inputmode: 'numeric', maxlength: String(LARGO_CODIGO),
    autocomplete: 'off', placeholder: '0'.repeat(LARGO_CODIGO),
    estilo: { fontSize: '24px', letterSpacing: '.16em', fontVariantNumeric: 'tabular-nums' },
  });
  const err = el('p', { clase: 'mensaje-error' });

  abrirModal({
    titulo: esNuevo ? (rol === 'gerente' ? 'Nuevo gerente' : 'Nuevo empleado') : empleado.nombre,
    subtitulo: esNuevo
      ? 'El código es la llave y el nombre a la vez: con él, el sistema sabe quién es y de qué restaurante. '
        + 'Anótalo y dáselo a la persona; después queda cifrado y no hay forma de volver a verlo.'
      : 'Deja el código en blanco para no cambiarlo.',
    contenido: el('div', {}, [
      campo('Nombre completo', nombre),
      rol === 'empleado' ? campo('Restaurante', selRest) : null,
      campo(esNuevo ? `Código de ${LARGO_CODIGO} dígitos` : `Código nuevo de ${LARGO_CODIGO} dígitos`, codigo,
        esNuevo
          ? 'Se muestra a la vista para que lo anotes bien. No puede repetirse con el de otra persona.'
          : 'Úsalo solo si la persona lo olvidó o si alguien más lo vio.'),
      err,
    ].filter(Boolean)),
    botones: [
      { texto: 'Cancelar', accion: cerrarModal },
      !esNuevo ? {
        texto: 'Dar de baja',
        clase: 'btn-peligro',
        accion: async () => {
          cerrarModal();
          if (!await confirmar({
            titulo: 'Dar de baja',
            mensaje: `${empleado.nombre} deja de poder entrar al sistema. Todo lo que sacó se conserva en el historial.`,
            textoSi: 'Dar de baja',
            peligro: true,
          })) return;
          await DB.guardar('empleados', { ...empleado, activo: false });
          await ctx.refrescarCache();
          brindis({ texto: 'Empleado dado de baja', tipo: 'exito' });
          render();
        },
      } : null,
      {
        texto: 'Guardar',
        clase: 'btn-primario',
        accion: async () => {
          const n = nombre.value.trim();
          const c = codigo.value.trim();
          if (n.length < 3) { err.textContent = 'Escribe el nombre completo.'; return; }
          if (esNuevo && !c) { err.textContent = 'Sin código la persona no puede entrar al sistema.'; return; }
          if (c && !new RegExp(`^\\d{${LARGO_CODIGO}}$`).test(c)) {
            err.textContent = `El código debe tener exactamente ${LARGO_CODIGO} dígitos.`; return;
          }
          if (c && codigoDebil(c)) {
            err.textContent = 'Ese código es demasiado fácil de adivinar. Escoge otro.'; return;
          }

          const sal = await DB.leerConfig('sal_codigos', null);
          let hash = empleado?.codigo || null;
          if (c) {
            hash = await derivarCodigo(c, sal);
            // Sin esta comprobación, dos personas con el mismo código harían que
            // el sistema le cargue las botellas a la equivocada. Es la regla que
            // sostiene todo el registro.
            const todos = await DB.todos('empleados');
            const choque = todos.find((e) => e.activo && e.id !== empleado?.id
              && e.codigo && igualesConstante(e.codigo, hash));
            if (choque) {
              err.textContent = `Ese código ya lo tiene ${choque.nombre}. Escoge otro.`; return;
            }
          }

          const base = empleado || {
            id: nuevoId(rol === 'gerente' ? 'g' : 'e'),
            rol,
            activo: true,
            ejemplo: false,
            codigo: null,
            creado: new Date().toISOString(),
          };
          await DB.guardar('empleados', {
            ...base,
            nombre: n,
            restauranteId: rol === 'gerente' ? null : selRest.value,
            codigo: hash,
          });
          await ctx.refrescarCache();
          cerrarModal();
          brindis({
            texto: esNuevo ? `${n} registrado` : 'Actualizado',
            sub: c ? `Su código es ${c}. Anótalo ahora: no se puede volver a ver.` : '',
            tipo: 'exito',
            segundos: c ? 12 : 4,
          });
          render();
        },
      },
    ].filter(Boolean),
  });
}

/* ------------------------------------------------------------------ */
/* Sistema y respaldos                                                 */
/* ------------------------------------------------------------------ */

async function exportarRespaldo() {
  try {
    const paquete = await DB.exportarTodo();
    descargar(`respaldo-almacen-${fechaPR()}.json`, JSON.stringify(paquete, null, 2));
    await DB.escribirConfig('ultimo_respaldo', new Date().toISOString());
    /* Este aviso decía «mándalo por correo». El archivo lleva los nombres del
       personal, el historial completo y los códigos cifrados de todos —y con
       una sal compartida, un solo recorrido de las 100.000 combinaciones de 5
       dígitos los rompe todos a la vez: medido, 37 minutos en una laptop
       normal. Quien tenga el archivo sabe el código de cada empleado, y con eso
       se sacan botellas a nombre de otro, que es justo lo que este sistema
       existe para impedir. El correo deja copias en servidores ajenos para
       siempre. */
    brindis({
      texto: 'Respaldo generado',
      sub: 'Guárdalo en el iCloud Drive del negocio. No lo mandes por correo ni por WhatsApp: '
        + 'el archivo lleva los datos del personal y sus códigos.',
      tipo: 'exito',
      segundos: 10,
    });
    if (ctx) render();
  } catch (e) {
    brindis({ texto: 'No se pudo respaldar', sub: e.message, tipo: 'error', segundos: 8 });
  }
}

/* Los códigos se muestran una sola vez. Después quedan cifrados y no hay forma
   de recuperarlos: solo reasignarlos. */
function mostrarCodigos(empleados, omitidos = []) {
  abrirModal({
    titulo: 'Códigos de los empleados de prueba',
    subtitulo: 'Anótalos ahora. No se pueden volver a ver.',
    contenido: el('div', {}, [
      el('div', { clase: 'lista-simple' }, empleados.map((emp) => el('div', { clase: 'item-lista' }, [
        el('div', { clase: 'crece' }, [el('div', { clase: 't', texto: emp.nombre })]),
        el('div', {
          texto: emp.codigoVisible,
          estilo: {
            fontSize: '24px', fontWeight: '700', letterSpacing: '.14em', fontVariantNumeric: 'tabular-nums',
          },
        }),
      ]))),
      omitidos.length ? el('p', {
        clase: 'ayuda',
        texto: `No se crearon ${omitidos.join(', ')}: su código de ejemplo ya lo tiene alguien real.`,
        estilo: { marginTop: '16px' },
      }) : null,
    ].filter(Boolean)),
    botones: [{ texto: 'Ya los anoté', clase: 'btn-primario', accion: cerrarModal }],
  });
}

/* Revisión antes de escribir. Cargar doscientos productos a ciegas sobre el
   inventario real es exactamente el tipo de operación que sale mal en silencio:
   aquí se ve qué entra, qué se actualiza, qué categorías se inventan y qué
   filas se saltan, y nada toca la base hasta que el gerente confirma.

   Las filas con error no bloquean al resto: con doscientos productos, una
   celda mal escrita no puede impedir la carga completa. Se saltan y se dicen. */
function modalPrevioCatalogo(plan) {
  const { resumen, errores, categoriasNuevas, lineas } = plan;

  const dato = (valor, etiqueta, clase = '') => el('div', { clase: `tarjeta-dato ${clase}` }, [
    el('div', { clase: 'v', texto: String(valor) }),
    el('div', { clase: 'e', texto: etiqueta }),
  ]);

  const cuerpo = el('div', {}, [
    el('div', { clase: 'tarjetas-resumen' }, [
      dato(resumen.crear, 'productos nuevos'),
      dato(resumen.actualizar, 'se actualizan', resumen.actualizar ? 'aviso' : ''),
      dato(categoriasNuevas.length, 'categorías nuevas', categoriasNuevas.length ? 'aviso' : ''),
      dato(errores.length, 'filas con error', errores.length ? 'alerta' : ''),
    ]),

    categoriasNuevas.length ? el('p', { clase: 'desc' }, [
      el('b', { texto: 'Se van a crear estas categorías: ' }),
      categoriasNuevas.join(', '),
      '. Si alguna es un error de escritura de una que ya existe, cancela y corrígela en el archivo.',
    ]) : null,

    resumen.sinNivel ? el('p', { clase: 'desc', texto:
      `${resumen.sinNivel} ${resumen.sinNivel === 1 ? 'producto queda' : 'productos quedan'} sin máximo `
      + 'porque no traen pedido mensual. Se cargan igual, pero no van a alertar cuando se acaben '
      + 'hasta que se les ponga un par.' }) : null,

    errores.length ? el('div', { clase: 'seccion' }, [
      el('h2', { texto: 'Filas que se van a saltar' }),
      tabla(['Fila', 'Qué pasa'], errores.slice(0, 40).map((e) => el('tr', {}, [
        el('td', { clase: 'num', texto: String(e.fila) }),
        el('td', { texto: e.mensaje }),
      ]))),
    ]) : null,

    lineas.length ? el('div', { clase: 'seccion' }, [
      el('h2', { texto: `Lo que se va a cargar${lineas.length > 30 ? ' (primeros 30)' : ''}` }),
      tabla(
        ['Producto', 'Categoría', { t: 'Existencia', num: true }, { t: 'Máximo', num: true }, { t: 'Mínimo', num: true }, ''],
        lineas.slice(0, 30).map((l) => el('tr', {}, [
          el('td', { texto: l.nombre }),
          el('td', { texto: l.categoriaNombre }),
          el('td', { clase: 'num', texto: l.accion === 'crear' ? String(l.existencia) : '—' }),
          el('td', { clase: 'num', texto: l.par ? String(l.par) : '—' }),
          el('td', { clase: 'num', texto: l.reorden ? String(l.reorden) : '—' }),
          el('td', {}, [el('span', {
            clase: `etiqueta ${l.accion === 'crear' ? 'ok' : 'bajo'}`,
            texto: l.accion === 'crear' ? 'Nuevo' : 'Actualiza',
          })]),
        ])),
      ),
    ]) : el('p', { clase: 'vacio', texto: 'No hay ninguna fila válida que cargar.' }),
  ].filter(Boolean));

  abrirModal({
    titulo: 'Revisión antes de importar',
    subtitulo: 'Todavía no se ha escrito nada. Revisa y confirma.',
    contenido: cuerpo,
    ancho: true,
    botones: [
      { texto: 'Cancelar', accion: cerrarModal },
      ...(lineas.length ? [{
        texto: `Importar ${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'}`,
        clase: 'btn-primario',
        accion: async () => {
          cerrarModal();
          try {
            const r = await aplicarCatalogo(plan, {
              empleadoId: ctx.gerente.id,
              empleadoNombre: ctx.gerente.nombre,
            });
            await ctx.refrescarCache();
            brindis({
              texto: `${r.creados} productos creados, ${r.actualizados} actualizados`,
              sub: r.movimientos
                ? `La existencia inicial quedó en el historial como ajuste, a tu nombre.`
                : 'No había existencias iniciales que registrar.',
              tipo: 'exito',
              segundos: 9,
            });
            render();
          } catch (e) {
            brindis({ texto: 'No se importó nada', sub: e.message, tipo: 'error', segundos: 10 });
          }
        },
      }] : []),
    ],
  });
}

async function vistaSistema() {
  const ultimo = await DB.leerConfig('ultimo_respaldo', null);
  const dias = await diasSinRespaldo();
  const horaInicio = await DB.leerConfig('inicio_dia_operativo', 5);
  const productos = await DB.todos('productos');
  const empleados = await DB.todos('empleados');
  const hayEjemplo = productos.some((p) => p.ejemplo) || empleados.some((e) => e.ejemplo);

  const selHora = el('select', {}, Array.from({ length: 12 }, (_, i) => el('option', {
    value: String(i), texto: `${i === 0 ? '12' : i}:00 ${i < 12 ? 'a.m.' : ''}`.trim(), selected: i === horaInicio,
  })));
  selHora.onchange = async () => {
    await DB.escribirConfig('inicio_dia_operativo', parseInt(selHora.value, 10));
    brindis({ texto: 'Día operativo actualizado', sub: 'Aplica a los movimientos nuevos.', tipo: 'exito', segundos: 6 });
  };

  const archivo = el('input', { type: 'file', accept: '.json,application/json' });
  const archivoCatalogo = el('input', { type: 'file', accept: '.csv,text/csv' });

  return el('div', {}, [
    await bandaRespaldo(),

    seccion('Respaldo',
      'El respaldo es la única copia fuera de este iPad. iOS no permite que una app web lo haga sola: alguien tiene que tocar el botón. Asigna una persona y un día fijo de la semana.',
      el('p', {
        clase: 'desc',
        texto: ultimo
          ? `Último respaldo: ${fechaHoraPR(ultimo)} (hace ${dias} ${dias === 1 ? 'día' : 'días'}).`
          : 'Todavía no se ha generado ningún respaldo.',
      }),
      el('div', { estilo: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
        el('button', { clase: 'btn btn-primario', texto: 'Respaldar ahora', onclick: exportarRespaldo }),
        el('button', {
          clase: 'btn',
          texto: 'Exportar historial completo en CSV',
          onclick: async () => {
            const movs = await movimientosPeriodo('0000-01-01', '9999-12-31');
            const restaurantes = await DB.todos('restaurantes');
            exportarMovimientos(movs, (id) => restaurantes.find((r) => r.id === id)?.nombre || '—');
          },
        }),
      ])),

    seccion('Restaurar un respaldo',
      'Reemplaza TODO el contenido actual por el del archivo. Se usa al montar un iPad nuevo o al recuperar de un desastre, nunca en el día a día.',
      campo('Archivo de respaldo (.json)', archivo),
      el('button', {
        clase: 'btn btn-peligro',
        texto: 'Restaurar y reemplazar todo',
        onclick: async () => {
          const f = archivo.files?.[0];
          if (!f) { brindis({ texto: 'Escoge primero un archivo', tipo: 'error' }); return; }
          if (!await confirmar({
            titulo: 'Restaurar respaldo',
            mensaje: 'Se reemplaza el inventario, el catálogo y los empleados de este iPad por los del archivo. '
              + 'El historial de movimientos no se reemplaza: solo se le suma lo que traiga el archivo, '
              + 'porque es lo que sirve de evidencia. La restauración queda registrada con tu nombre.',
            textoSi: 'Restaurar',
            peligro: true,
          })) return;
          try {
            const paquete = JSON.parse(await f.text());
            const r = await DB.importarTodo(paquete);
            /* Restaurar reemplaza el store de categorías con las del archivo.
               Sin esta línea, un respaldo anterior a la separación de Tequila y
               Mezcal las revivía fusionadas hasta que alguien cerrara y
               reabriera la app —y nada indicaba que hiciera falta reiniciar—.
               Es el caso normal al montar un iPad de reemplazo. */
            await alinearCategorias();
            /* Queda anotado quién restauró y cuántos movimientos había antes y
               después. Sin esto, una restauración es indistinguible de que no
               hubiera pasado nada, y es la operación con más poder del sistema. */
            const previas = await DB.leerConfig('restauraciones', []);
            await DB.escribirConfig('restauraciones', [...previas, {
              fechaISO: new Date().toISOString(),
              gerente: ctx.gerente.nombre,
              archivo: f.name,
              movimientosAntes: r.movimientosAntes,
              movimientosDespues: r.movimientosDespues,
            }].slice(-50));
            await ctx.refrescarCache();
            brindis({
              texto: 'Respaldo restaurado',
              sub: `El historial pasó de ${r.movimientosAntes} a ${r.movimientosDespues} movimientos. Queda anotado a tu nombre.`,
              tipo: 'exito',
              segundos: 8,
            });
            render();
          } catch (e) {
            brindis({ texto: 'No se pudo restaurar', sub: e.message, tipo: 'error', segundos: 10 });
          }
        },
      })),

    seccion('Importar catálogo',
      'Carga productos desde la plantilla llena, guardada como CSV. Nunca borra: crea los que no están y actualiza los que sí, emparejando por nombre. La existencia solo se fija al crear un producto nuevo — la de los que ya existen la manda el inventario, no la hoja.',
      campo('Archivo del catálogo (.csv)', archivoCatalogo),
      el('button', {
        clase: 'btn btn-primario',
        texto: 'Revisar archivo',
        onclick: async () => {
          const f = archivoCatalogo.files?.[0];
          if (!f) { brindis({ texto: 'Escoge primero un archivo', tipo: 'error' }); return; }
          try {
            const [categorias, productos] = await Promise.all([
              DB.todos('categorias'), DB.todos('productos'),
            ]);
            const plan = interpretarCatalogo(await f.text(), { categorias, productos });
            if (plan.fatal) { brindis({ texto: 'No se pudo leer', sub: plan.fatal, tipo: 'error', segundos: 10 }); return; }
            modalPrevioCatalogo(plan);
          } catch (e) {
            brindis({ texto: 'No se pudo leer el archivo', sub: e.message, tipo: 'error', segundos: 8 });
          }
        },
      })),

    seccion('Día operativo',
      'A qué hora empieza a contar un día nuevo. Con las 5:00 a.m., lo que sale a la 1:30 a.m. cuenta en el turno de la noche anterior y no en el día siguiente.',
      campo('Comienza a las', selHora)),

    hayEjemplo ? seccion('Datos de ejemplo',
      'El catálogo y los empleados de prueba que vinieron con la instalación. Bórralos cuando ya tengas cargado lo real.',
      el('button', {
        clase: 'btn btn-peligro',
        texto: 'Borrar todos los datos de ejemplo',
        onclick: async () => {
          if (!await confirmar({
            titulo: 'Borrar datos de ejemplo',
            mensaje: 'Se retiran del catálogo los productos de ejemplo y se dan de baja los empleados de prueba. El historial de movimientos se conserva.',
            textoSi: 'Borrar',
            peligro: true,
          })) return;
          for (const p of productos.filter((x) => x.ejemplo)) await DB.guardar('productos', { ...p, activo: false });
          for (const e of empleados.filter((x) => x.ejemplo)) await DB.guardar('empleados', { ...e, activo: false });
          await ctx.refrescarCache();
          brindis({ texto: 'Datos de ejemplo retirados', tipo: 'exito' });
          render();
        },
      })) : null,

    seccion('Reinstalar el catálogo de ejemplo', 'Solo si necesitas volver a tener productos de prueba para entrenar personal.',
      el('button', {
        clase: 'btn btn-fantasma',
        texto: 'Cargar catálogo y empleados de ejemplo',
        onclick: async () => {
          if (!await confirmar({
            titulo: 'Cargar ejemplos',
            mensaje: 'Se agregan al catálogo los productos y empleados de prueba. No se toca nada de lo que ya existe.',
            textoSi: 'Cargar',
          })) return;
          const sal = await DB.leerConfig('sal_codigos', null);
          const ejemplos = empleadosEjemplo();
          const yaUsados = (await DB.todos('empleados')).filter((e) => e.activo && e.codigo);
          const aGuardar = [];
          const omitidos = [];
          for (const emp of ejemplos) {
            const hash = await derivarCodigo(emp.codigoVisible, sal);
            // Si un código de ejemplo choca con uno real ya en uso, se omite:
            // duplicar un código rompería la atribución de las salidas.
            if (yaUsados.some((e) => igualesConstante(e.codigo, hash))) {
              omitidos.push(emp.nombre);
              continue;
            }
            const { codigoVisible, ...resto } = emp;
            aGuardar.push({ ...resto, codigo: hash });
          }
          await DB.guardarVarios('productos', productosIniciales());
          if (aGuardar.length) await DB.guardarVarios('empleados', aGuardar);
          await ctx.refrescarCache();
          render();
          mostrarCodigos(ejemplos.filter((e) => !omitidos.includes(e.nombre)), omitidos);
        },
      })),

    await seccionVersion(),
  ].filter(Boolean));
}

/* Qué versión está corriendo este aparato, y si de verdad se actualizó.

   Existe porque durante días no hubo forma de saberlo: se publicaba una
   corrección, el iPad seguía igual, y no había manera de distinguir «no llegó»
   de «llegó y el fallo es otro». Se persiguieron fantasmas por eso.

   El dato viene del nombre del caché activo, no de una constante escrita en el
   código. Una constante en el JS podría estar tan vieja como el resto y diría
   la versión equivocada con total seguridad. El caché lo nombra el service
   worker al instalarse, así que dice qué se instaló de verdad. */
async function seccionVersion() {
  let instalada = 'no se pudo leer';
  let controlando = false;
  try {
    const claves = window.caches ? await caches.keys() : [];
    const propio = claves.find((k) => k.startsWith('almacen-licores-'));
    if (propio) instalada = propio.replace('almacen-licores-', '');
    else if (!claves.length) instalada = 'sin instalar (abierta desde la red)';
    controlando = !!navigator.serviceWorker?.controller;
  } catch { /* navegador sin caches o sin permiso: se queda en el aviso */ }

  return seccion('Versión instalada',
    'Para saber si este iPad tiene la última corrección. Si acabas de publicar un cambio y el número '
    + 'no sube, cierra la app por completo y ábrela con wifi: la primera vez trae la versión nueva y '
    + 'la segunda ya la usa.',
    el('p', { clase: 'desc', estilo: { marginBottom: '0' } }, [
      el('strong', { texto: instalada }),
      el('span', {
        texto: controlando
          ? ' · funciona sin internet'
          : ' · todavía no funciona sin internet (falta cerrarla y abrirla una vez)',
      }),
    ]));
}

export { abrirAdmin, salirAdmin };
