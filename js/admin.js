/* Área de administración: catálogo, entradas, ajustes por conteo, devoluciones,
   lista de compra, reportes, historial, empleados y respaldos.

   Nada de lo que se hace aquí borra historial. Corregir siempre suma un
   movimiento nuevo. */

import { DB, nuevoId } from './db.js';
import { derivarCodigo, igualesConstante, codigoDebil, LARGO_CODIGO } from './cripto.js';
import { productosIniciales, empleadosEjemplo } from './datos.js';
import {
  estadoStock, registrarLote, revertirLote, productosActivos, listaCompra,
  movimientosPeriodo, porRestaurante, porEmpleado, porProducto, consumoSemanal,
  resumenAlertas, fechaPR, sumarDias, fechaHoraPR, TIPOS,
} from './modelo.js';
import {
  $, el, mostrarPantalla, abrirModal, cerrarModal, confirmar,
  brindis, dinero, numero, descargar, aCSV,
} from './ui.js';

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
  ['reportes', 'Reportes'],
  ['historial', 'Historial'],
  ['empleados', 'Empleados'],
  ['sistema', 'Sistema'],
];

let ctx = null;
let tabActual = 'resumen';

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
  const vistas = {
    resumen: vistaResumen,
    inventario: vistaInventario,
    compra: vistaCompra,
    conteo: vistaConteo,
    devolucion: vistaDevolucion,
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

async function vistaResumen() {
  const [alertas, compra] = await Promise.all([resumenAlertas(), listaCompra()]);
  const hoy = fechaPR();
  const movsHoy = await movimientosPeriodo(hoy, hoy);
  const salidasHoy = movsHoy.filter((m) => m.restauranteId).reduce((s, m) => s + (-m.delta), 0);

  const dato = (valor, etiqueta, clase = '') => el('div', { clase: `tarjeta-dato ${clase}` }, [
    el('div', { clase: 'v', texto: valor }),
    el('div', { clase: 'e', texto: etiqueta }),
  ]);

  return el('div', {}, [
    await bandaRespaldo(),
    el('div', { clase: 'tarjetas-resumen' }, [
      dato(numero(alertas.total), 'productos en catálogo'),
      dato(numero(alertas.agotados), 'agotados', alertas.agotados ? 'alerta' : ''),
      dato(numero(alertas.criticos), 'hay que ordenar', alertas.criticos ? 'alerta' : ''),
      dato(numero(alertas.bajos), 'bajo el par', alertas.bajos ? 'aviso' : ''),
      dato(numero(salidasHoy), 'botellas salieron hoy'),
      dato(dinero(alertas.valorInventario), 'valor del inventario'),
    ]),
    seccion('Acciones rápidas', null, el('div', { estilo: { display: 'flex', gap: '12px', flexWrap: 'wrap' } }, [
      el('button', { clase: 'btn btn-primario', texto: 'Recibir orden', onclick: () => { tabActual = 'compra'; pintarTabs(); render(); } }),
      el('button', { clase: 'btn', texto: 'Conteo físico', onclick: () => { tabActual = 'conteo'; pintarTabs(); render(); } }),
      el('button', { clase: 'btn', texto: 'Agregar producto', onclick: () => modalProducto(null) }),
      el('button', { clase: 'btn', texto: 'Respaldar', onclick: exportarRespaldo }),
    ])),
    compra.length
      ? seccion('Hay que ordenar', `${compra.length} ${compra.length === 1 ? 'producto está' : 'productos están'} bajo el nivel par.`,
        tabla(['Producto', { t: 'Quedan', num: true }, { t: 'Par', num: true }, { t: 'Ordenar', num: true }, 'Estado'],
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
      ['Producto', 'Categoría', { t: 'Existencia', num: true }, { t: 'Par', num: true },
        { t: 'Reorden', num: true }, { t: 'Consumo/sem', num: true }, { t: 'Costo', num: true }, 'Estado', ''],
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
      'La columna Consumo/sem es el promedio real de las últimas cuatro semanas. Si el proveedor tarda una semana en entregar, el par debe cubrir al menos ese número más un colchón.',
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
  const categoria = el('select', {}, categorias.map((c) => el('option', {
    value: c.id, texto: c.nombre, selected: c.id === p.categoriaId,
  })));
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
      el('div', { clase: 'fila-campos-3' }, [
        campo('Nivel par', par, 'Cuánto debe haber'),
        campo('Punto de reorden', reorden, 'Se pone en rojo aquí'),
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
          if (!Number.isInteger(vPar) || vPar < 0) { err.textContent = 'El nivel par debe ser un entero de cero o más.'; return; }
          if (!Number.isInteger(vReorden) || vReorden < 0) { err.textContent = 'El punto de reorden debe ser un entero de cero o más.'; return; }
          if (vReorden > vPar) { err.textContent = 'El punto de reorden no puede ser mayor que el par: se pondría en rojo permanentemente.'; return; }
          if (esNuevo && (!Number.isInteger(vExistencia) || vExistencia < 0)) { err.textContent = 'La existencia inicial debe ser un entero de cero o más.'; return; }

          const guardado = {
            ...p,
            id: p.id || nuevoId('p'),
            nombre: n,
            categoriaId: categoria.value,
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
        },
      },
    ].filter(Boolean),
  });
}

/* ------------------------------------------------------------------ */
/* Lista de compra y recepción                                         */
/* ------------------------------------------------------------------ */

async function vistaCompra() {
  const lista = await listaCompra();
  if (!lista.length) {
    return seccion('Lista de compra', 'Todo el inventario está en nivel. No hay nada que ordenar.');
  }
  const totalUnidades = lista.reduce((s, p) => s + p.aOrdenar, 0);
  const totalCosto = lista.reduce((s, p) => s + p.costoOrden, 0);

  const entradas = new Map(lista.map((p) => [p.id, p.aOrdenar]));

  const cuerpoTabla = tabla(
    ['Producto', 'Estado', { t: 'Quedan', num: true }, { t: 'Par', num: true },
      { t: 'Sugerido', num: true }, { t: 'Recibido', num: true }, { t: 'Costo', num: true }],
    lista.map((p) => {
      const entrada = el('input', {
        type: 'number', min: '0', step: '1', value: String(p.aOrdenar),
        estilo: { width: '92px', minHeight: '48px', textAlign: 'right' },
        oninput: () => entradas.set(p.id, Math.max(0, parseInt(entrada.value, 10) || 0)),
      });
      return el('tr', {}, [
        el('td', { texto: p.nombre }),
        el('td', {}, [etiquetaEstado(p.estado)]),
        el('td', { clase: 'num', texto: String(p.existencia) }),
        el('td', { clase: 'num', texto: String(p.par) }),
        el('td', { clase: 'num', texto: String(p.aOrdenar) }),
        el('td', { clase: 'num' }, [entrada]),
        el('td', { clase: 'num', texto: dinero(p.costoOrden) }),
      ]);
    }),
  );

  const proveedor = el('input', { type: 'text', maxlength: String(LARGO.referencia), placeholder: 'Proveedor o número de factura' });

  return el('div', {}, [
    seccion('Lista de compra',
      `${lista.length} productos bajo el par · ${totalUnidades} unidades sugeridas · ${dinero(totalCosto)} estimado a costo.`,
      el('div', { clase: 'seccion-barra' }, [
        el('span', { clase: 'crece' }),
        el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Exportar CSV', onclick: () => exportarCompra(lista) }),
        el('button', { clase: 'btn btn-chico btn-fantasma', texto: 'Imprimir', onclick: () => window.print() }),
      ]),
      cuerpoTabla),
    seccion('Recibir la orden',
      'Cuando llegue el pedido, ajusta la columna Recibido con lo que de verdad entró y confirma. Entra al almacén solo lo que escribas aquí.',
      campo('Referencia', proveedor, 'Queda en el historial junto a la entrada.'),
      el('button', {
        clase: 'btn btn-primario',
        texto: 'Registrar entrada al almacén',
        onclick: async () => {
          const lineas = [...entradas.entries()]
            .filter(([, c]) => c > 0)
            .map(([productoId, cantidad]) => ({ productoId, cantidad }));
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
  const filas = [['Producto', 'Existencia', 'Par', 'A ordenar', 'Costo unitario', 'Costo total']];
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
/* Reportes                                                            */
/* ------------------------------------------------------------------ */

const PRESETS = [
  ['hoy', 'Hoy'],
  ['ayer', 'Ayer'],
  ['7', 'Últimos 7 días'],
  ['30', 'Últimos 30 días'],
  ['mes', 'Este mes'],
];

function rangoPreset(clave) {
  const hoy = fechaPR();
  if (clave === 'hoy') return [hoy, hoy];
  if (clave === 'ayer') { const a = sumarDias(hoy, -1); return [a, a]; }
  if (clave === 'mes') return [`${hoy.slice(0, 7)}-01`, hoy];
  return [sumarDias(hoy, -(parseInt(clave, 10) - 1)), hoy];
}

let rangoReporte = rangoPreset('7');

async function vistaReportes() {
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
          const suyo = movs.find((m) => m.empleadoId === e.clave);
          return el('tr', {}, [
            el('td', { texto: nombreEmp(e.clave) }),
            el('td', { texto: nombreRest(suyo?.restauranteId) }),
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
  const filas = [['Fecha y hora', 'Dia operativo', 'Tipo', 'Producto', 'Cantidad', 'Restaurante',
    'Empleado', 'Existencia antes', 'Existencia despues', 'Costo unitario', 'Motivo', 'Autorizado por']];
  for (const m of movs) {
    filas.push([
      fechaHoraPR(m.fechaISO), m.diaOperativo, TIPOS[m.tipo]?.etiqueta || m.tipo,
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
  const [desde, hasta] = rangoReporte;
  const [movs, restaurantes] = await Promise.all([
    movimientosPeriodo(desde, hasta), DB.todos('restaurantes'),
  ]);
  const nombreRest = (id) => restaurantes.find((r) => r.id === id)?.nombre || '—';

  return el('div', {}, [
    seccion('Historial de movimientos',
      'Registro completo y sin borrar. Una corrección no elimina nada: suma una reversión que también queda aquí.',
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
      movs.length
        ? tabla(['Fecha y hora', 'Tipo', 'Producto', { t: 'Cambio', num: true }, 'Restaurante', 'Quién', 'Motivo', ''],
          movs.slice(0, 400).map((m) => el('tr', {}, [
            el('td', { texto: fechaHoraPR(m.fechaISO) }),
            el('td', {}, [el('span', {
              clase: `etiqueta ${m.tipo === 'salida' ? 'critico' : (m.tipo === 'reversion' ? 'agotado' : 'ok')}`,
              texto: TIPOS[m.tipo]?.etiqueta || m.tipo,
            })]),
            el('td', { texto: m.productoNombre }),
            el('td', { clase: 'num', texto: m.delta > 0 ? `+${m.delta}` : String(m.delta) }),
            el('td', { texto: m.restauranteId ? nombreRest(m.restauranteId) : '—' }),
            el('td', { texto: m.empleadoNombre }),
            el('td', { texto: [m.motivo, m.autorizadoPor ? `Autorizó ${m.autorizadoPor}` : ''].filter(Boolean).join(' · ') || '—' }),
            el('td', { clase: 'num' }, [
              m.tipo === 'reversion' ? null : el('button', {
                clase: 'btn btn-chico btn-fantasma',
                texto: 'Revertir',
                onclick: () => revertir(m),
              }),
            ].filter(Boolean)),
          ])))
        : el('p', { clase: 'vacio', texto: 'No hay movimientos en este período.' })),
  ]);
}

async function revertir(mov) {
  if (!await confirmar({
    titulo: 'Revertir movimiento',
    mensaje: `Se va a deshacer el movimiento completo de ${fechaHoraPR(mov.fechaISO)} `
      + `(${TIPOS[mov.tipo]?.etiqueta}, ${mov.productoNombre}). No se borra nada: `
      + 'se registra una reversión a tu nombre y el original queda visible en el historial.',
    textoSi: 'Revertir',
    peligro: true,
  })) return;
  try {
    await revertirLote(mov.loteId, {
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
    brindis({
      texto: 'Respaldo generado',
      sub: 'Guárdalo en iCloud Drive o mándalo por correo. Si se queda solo en este iPad, no es un respaldo.',
      tipo: 'exito',
      segundos: 9,
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
            mensaje: 'Se va a borrar todo lo que hay ahora en este iPad (inventario, empleados e historial) y se reemplaza por el contenido del archivo. Esto no se puede deshacer.',
            textoSi: 'Restaurar',
            peligro: true,
          })) return;
          try {
            const paquete = JSON.parse(await f.text());
            await DB.importarTodo(paquete);
            await ctx.refrescarCache();
            brindis({ texto: 'Respaldo restaurado', tipo: 'exito' });
            render();
          } catch (e) {
            brindis({ texto: 'No se pudo restaurar', sub: e.message, tipo: 'error', segundos: 10 });
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
  ].filter(Boolean));
}

export { abrirAdmin, salirAdmin };
