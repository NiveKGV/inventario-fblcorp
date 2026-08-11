/* Arranque, acceso y flujo del empleado.

   Puerta de entrada: un solo código. El sistema identifica por él a la persona
   y el restaurante al que pertenece, y decide si abre el panel de salidas o el
   área de gerencia. Nadie escoge nombre de una lista.

   Consecuencia que sostiene todo el diseño: los códigos tienen que ser únicos
   en toda la instalación. Si dos personas comparten código, el sistema le carga
   las botellas a la equivocada, que es exactamente lo que existe para evitar.
   La unicidad se impone al crearlos, en admin.js. */

import { DB, nuevoId } from './db.js';
import {
  nuevaSal, derivarCodigo, igualesConstante, codigoDebil, contextoSeguro, LARGO_CODIGO,
} from './cripto.js';
import { RESTAURANTES, CATEGORIAS, productosIniciales, empleadosEjemplo } from './datos.js';
import {
  estadoStock, registrarLote, revertirLote, productosActivos, resumenAlertas, fechaHoraPR,
} from './modelo.js';
import {
  $, $$, el, mostrarPantalla, abrirModal, cerrarModal, modalAbierto,
  brindis, ocultarBrindis, numero, normalizar,
} from './ui.js';
import { abrirAdmin, salirAdmin } from './admin.js';

const INACTIVIDAD_EMPLEADO = 60;   // segundos
const INACTIVIDAD_GERENTE = 300;   // el gerente captura datos, 60 s no alcanza
const INTENTOS_MAX = 5;
const SEG_DESHACER = 15;

const estado = {
  restaurantes: [],
  categorias: [],
  productos: [],
  empleados: [],
  restaurante: null,
  empleado: null,
  categoriaSel: null,
  busqueda: '',
  carrito: new Map(),
};

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

async function iniciar() {
  try {
    if (!contextoSeguro()) {
      $('#carga-texto').textContent = 'Esta app debe abrirse por HTTPS (o desde localhost). '
        + 'Sin contexto seguro el navegador no permite cifrar los códigos y el sistema no arranca.';
      return;
    }
    await DB.abrir();
    const configurado = await DB.leerConfig('configurado', false);
    if (!configurado) { prepararConfigInicial(); return; }
    await cargarCache();
    mostrarAcceso();
  } catch (e) {
    $('#carga-texto').textContent = `No se pudo abrir la base de datos: ${e.message}`;
  }
}

async function cargarCache() {
  const [restaurantes, categorias, productos, empleados] = await Promise.all([
    DB.todos('restaurantes'), DB.todos('categorias'), productosActivos(), DB.todos('empleados'),
  ]);
  estado.restaurantes = restaurantes.filter((r) => r.activo).sort((a, b) => a.orden - b.orden);
  estado.categorias = categorias.filter((c) => c.activa).sort((a, b) => a.orden - b.orden);
  estado.productos = productos;
  estado.empleados = empleados.filter((e) => e.activo);
}

/* ------------------------------------------------------------------ */
/* Configuración inicial                                               */
/* ------------------------------------------------------------------ */

function prepararConfigInicial() {
  mostrarPantalla('config');
  $('#cfg-crear').onclick = async () => {
    const error = $('#cfg-error');
    const nombre = $('#cfg-nombre').value.trim();
    const codigo = $('#cfg-pin').value.trim();
    const codigo2 = $('#cfg-pin2').value.trim();
    error.textContent = '';

    if (nombre.length < 3) { error.textContent = 'Escribe el nombre completo del gerente.'; return; }
    if (!new RegExp(`^\\d{${LARGO_CODIGO}}$`).test(codigo)) {
      error.textContent = `El código debe tener exactamente ${LARGO_CODIGO} dígitos.`; return;
    }
    if (codigoDebil(codigo)) {
      error.textContent = 'Ese código es demasiado fácil de adivinar. Usa una combinación menos obvia.';
      return;
    }
    if (codigo !== codigo2) { error.textContent = 'Los dos códigos no coinciden.'; return; }

    $('#cfg-crear').disabled = true;
    $('#cfg-crear').textContent = 'Creando…';
    try {
      const conEjemplo = $('#cfg-ejemplo').value === 'si';
      const sal = nuevaSal();
      await DB.escribirConfig('sal_codigos', sal);

      await DB.guardarVarios('restaurantes', RESTAURANTES);
      await DB.guardarVarios('categorias', CATEGORIAS);

      let ejemplos = [];
      if (conEjemplo) {
        await DB.guardarVarios('productos', productosIniciales());
        ejemplos = empleadosEjemplo();
        for (const emp of ejemplos) emp.codigo = await derivarCodigo(emp.codigoVisible, sal);
        await DB.guardarVarios('empleados', ejemplos.map(({ codigoVisible, ...resto }) => resto));
      }

      await DB.guardar('empleados', {
        id: nuevoId('g'),
        nombre,
        restauranteId: null,
        rol: 'gerente',
        codigo: await derivarCodigo(codigo, sal),
        activo: true,
        ejemplo: false,
        creado: new Date().toISOString(),
      });

      await DB.escribirConfig('inicio_dia_operativo', 5);
      await DB.escribirConfig('nombre_almacen', 'Almacén central');
      await DB.escribirConfig('configurado', true);
      await cargarCache();
      mostrarAcceso();

      if (ejemplos.length) mostrarCodigosEjemplo(ejemplos);
      else {
        brindis({
          texto: 'Sistema listo',
          sub: 'Registra un segundo gerente en Administración: si solo una persona conoce el código, el almacén se queda sin administrar el día que no esté.',
          tipo: 'exito',
          segundos: 12,
        });
      }
    } catch (e) {
      error.textContent = e.message;
      $('#cfg-crear').disabled = false;
      $('#cfg-crear').textContent = 'Crear y empezar';
    }
  };
}

/* Los códigos de ejemplo se muestran una sola vez y nunca más: quedan cifrados
   igual que los reales y no hay forma de recuperarlos después. */
function mostrarCodigosEjemplo(ejemplos) {
  abrirModal({
    titulo: 'Códigos de los empleados de prueba',
    subtitulo: 'Esta lista se muestra una sola vez. Sirve para probar el sistema; bórralos desde '
      + 'Administración → Sistema antes de ponerlo a trabajar de verdad.',
    contenido: el('div', { clase: 'lista-simple' }, ejemplos.map((emp) => el('div', { clase: 'item-lista' }, [
      el('div', { clase: 'crece' }, [
        el('div', { clase: 't', texto: emp.nombre }),
        el('div', {
          clase: 's',
          texto: RESTAURANTES.find((r) => r.id === emp.restauranteId)?.nombre || '',
        }),
      ]),
      el('div', {
        texto: emp.codigoVisible,
        estilo: {
          fontSize: '26px', fontWeight: '700', letterSpacing: '.12em', fontVariantNumeric: 'tabular-nums',
        },
      }),
    ]))),
    botones: [{ texto: 'Ya los anoté', clase: 'btn-primario', accion: cerrarModal }],
  });
}

/* ------------------------------------------------------------------ */
/* Pantalla de acceso: un solo teclado para todos                      */
/* ------------------------------------------------------------------ */

let acceso = null;

async function mostrarAcceso() {
  detenerSesion();
  estado.empleado = null;
  estado.restaurante = null;
  estado.carrito.clear();
  estado.busqueda = '';
  await cargarCache();

  document.documentElement.style.setProperty('--acento', '#e0a34a');
  acceso = { valor: '', ocupado: false };

  $('#acceso-sub').textContent = `Entra tu código de ${LARGO_CODIGO} dígitos`;
  $('#acceso-error').textContent = '';
  $('#acceso-caja').classList.remove('error');

  $('#acceso-puntos').replaceChildren(
    ...Array.from({ length: LARGO_CODIGO }, () => el('span', { clase: 'pin-punto' })),
  );

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'limpiar'];
  $('#acceso-teclado').replaceChildren(...teclas.map((t) => {
    if (t === 'borrar') return el('button', { clase: 'tecla aux', texto: 'Borrar', onclick: () => teclear(null) });
    if (t === 'limpiar') return el('button', { clase: 'tecla aux', texto: 'Limpiar', onclick: () => teclear('reset') });
    return el('button', { clase: 'tecla', texto: t, onclick: () => teclear(t) });
  }));

  const alertas = await resumenAlertas();
  $('#pie-info').textContent = alertas.porOrdenar > 0
    ? `${alertas.porOrdenar} ${alertas.porOrdenar === 1 ? 'producto está' : 'productos están'} bajo el nivel par`
    : 'Todo el inventario está en nivel';

  mostrarPantalla('acceso');
  await pintarBloqueo();
}

function pintarPuntos() {
  $$('#acceso-puntos .pin-punto').forEach((p, i) => p.classList.toggle('lleno', i < acceso.valor.length));
}

function errorAcceso(mensaje) {
  $('#acceso-error').textContent = mensaje;
  $('#acceso-caja').classList.add('error');
}

function teclear(digito) {
  if (!acceso || acceso.ocupado) return;
  $('#acceso-caja').classList.remove('error');
  $('#acceso-error').textContent = '';
  if (digito === null) acceso.valor = acceso.valor.slice(0, -1);
  else if (digito === 'reset') acceso.valor = '';
  else if (acceso.valor.length < LARGO_CODIGO) acceso.valor += digito;
  pintarPuntos();

  if (acceso.valor.length === LARGO_CODIGO) {
    acceso.ocupado = true;
    const valor = acceso.valor;
    setTimeout(async () => {
      try {
        await intentarAcceso(valor);
      } catch (e) {
        console.error('Fallo al procesar el código:', e);
        errorAcceso(e.message || 'Algo falló. Vuelve a intentar.');
      } finally {
        if (acceso) { acceso.valor = ''; acceso.ocupado = false; pintarPuntos(); }
      }
    }, 130);
  }
}

/* El bloqueo es del aparato, no de una persona: hasta que el código no acierta
   no se sabe quién está intentando. Se guarda en la base para que recargar la
   app no lo reinicie. */
async function pintarBloqueo() {
  const hasta = await DB.leerConfig('bloqueado_hasta', null);
  if (!hasta || new Date(hasta) <= new Date()) return false;
  const faltan = Math.ceil((new Date(hasta) - new Date()) / 1000);
  errorAcceso(`Demasiados intentos fallidos. Espera ${faltan} segundos.`);
  if (acceso) acceso.ocupado = true;
  setTimeout(async () => {
    if (acceso) { acceso.ocupado = false; acceso.valor = ''; pintarPuntos(); }
    $('#acceso-error').textContent = '';
    $('#acceso-caja').classList.remove('error');
  }, faltan * 1000);
  return true;
}

async function registrarFallo() {
  const intentos = (await DB.leerConfig('intentos_fallidos', 0)) + 1;
  if (intentos < INTENTOS_MAX) {
    await DB.escribirConfig('intentos_fallidos', intentos);
    errorAcceso(`Código no reconocido. Quedan ${INTENTOS_MAX - intentos} intentos.`);
    return;
  }
  // Cada tanda de fallos duplica la espera, con techo de 5 minutos. El techo es
  // bajo a propósito: un bloqueo largo en pleno servicio termina con alguien
  // sacando botellas sin registrarlas, que es peor que el riesgo que evita.
  const rondas = (await DB.leerConfig('rondas_bloqueo', 0)) + 1;
  const segundos = Math.min(60 * (2 ** (rondas - 1)), 300);
  await DB.escribirConfig('intentos_fallidos', 0);
  await DB.escribirConfig('rondas_bloqueo', rondas);
  await DB.escribirConfig('bloqueado_hasta', new Date(Date.now() + segundos * 1000).toISOString());
  await pintarBloqueo();
}

async function intentarAcceso(codigo) {
  const bloqueado = Boolean(await DB.leerConfig('bloqueado_hasta', null))
    && new Date(await DB.leerConfig('bloqueado_hasta', null)) > new Date();

  const sal = await DB.leerConfig('sal_codigos', null);
  if (!sal) throw new Error('Falta la configuración de seguridad. Restaura un respaldo.');

  const hash = await derivarCodigo(codigo, sal);
  // Se recorren todos y no se corta al primero: el tiempo de respuesta no debe
  // depender de en qué posición está la persona en la lista.
  let encontrado = null;
  for (const emp of estado.empleados) {
    if (emp.codigo && igualesConstante(emp.codigo, hash)) encontrado = emp;
  }

  /* Válvula de escape: durante un bloqueo, un código de gerencia entra igual y
     lo levanta. Sin esto, cinco dedazos de un mesero dejan el almacén cerrado
     en pleno servicio y nadie con autoridad para abrirlo. Al atacante no le
     regala nada: tendría que acertar un código de gerencia, que es tan difícil
     como antes, y los códigos de empleado siguen bloqueados. */
  if (bloqueado && encontrado?.rol !== 'gerente') {
    await pintarBloqueo();
    return;
  }

  if (!encontrado) { await registrarFallo(); return; }

  await DB.escribirConfig('intentos_fallidos', 0);
  await DB.escribirConfig('rondas_bloqueo', 0);
  await DB.escribirConfig('bloqueado_hasta', null);

  if (encontrado.rol === 'gerente') {
    if (bloqueado) {
      brindis({
        texto: 'Bloqueo levantado',
        sub: 'El teclado estaba bloqueado por intentos fallidos. Tu código lo abrió.',
        segundos: 7,
      });
    }
    estado.empleado = encontrado;
    iniciarSesion(INACTIVIDAD_GERENTE, '#admin-sesion');
    abrirAdmin(encontrado, { alSalir: mostrarAcceso, refrescarCache: cargarCache, estado });
    return;
  }

  const restaurante = estado.restaurantes.find((r) => r.id === encontrado.restauranteId);
  if (!restaurante) {
    errorAcceso('Tu restaurante ya no está activo. Habla con el gerente.');
    return;
  }
  await abrirPanel(encontrado, restaurante);
}

/* Pide un código de gerencia dentro de un modal, para autorizar una excepción
   sin que el empleado abandone lo que estaba haciendo. */
function autorizarGerente(motivo) {
  return new Promise((resolve) => {
    const entrada = el('input', {
      type: 'password', inputmode: 'numeric', maxlength: String(LARGO_CODIGO), autocomplete: 'off',
      placeholder: '•'.repeat(LARGO_CODIGO),
    });
    const err = el('p', { clase: 'mensaje-error' });

    abrirModal({
      titulo: 'Autorización de gerencia',
      subtitulo: motivo,
      contenido: el('div', {}, [
        el('div', { clase: 'campo' }, [
          el('label', { texto: `Código de gerencia (${LARGO_CODIGO} dígitos)` }),
          entrada,
        ]),
        err,
      ]),
      botones: [
        { texto: 'Cancelar', accion: () => { cerrarModal(); resolve(null); } },
        {
          texto: 'Autorizar',
          clase: 'btn-primario',
          accion: async () => {
            const sal = await DB.leerConfig('sal_codigos', null);
            const hash = await derivarCodigo(entrada.value.trim(), sal);
            const gerente = estado.empleados.find(
              (e) => e.rol === 'gerente' && e.codigo && igualesConstante(e.codigo, hash),
            );
            if (gerente) { cerrarModal(); resolve(gerente); } else err.textContent = 'Código incorrecto.';
          },
        },
      ],
    });
    setTimeout(() => entrada.focus(), 60);
  });
}

/* ------------------------------------------------------------------ */
/* Panel de salida                                                     */
/* ------------------------------------------------------------------ */

async function abrirPanel(empleado, restaurante) {
  estado.empleado = empleado;
  estado.restaurante = restaurante;
  estado.carrito.clear();
  estado.busqueda = '';
  await cargarCache();
  estado.categoriaSel = estado.categorias.find(
    (c) => estado.productos.some((p) => p.categoriaId === c.id),
  )?.id || null;

  document.documentElement.style.setProperty('--acento', restaurante.color);
  $('#panel-titulo').textContent = restaurante.nombre;
  $('#panel-sub').textContent = empleado.nombre;
  $('#panel-punto').style.background = restaurante.color;
  $('#btn-salir').onclick = () => mostrarAcceso();
  $('#btn-codigo').onclick = () => modalCambiarCodigo(empleado);
  $('#btn-confirmar').onclick = confirmarSalida;
  $('#btn-vaciar').onclick = () => { estado.carrito.clear(); pintarCarrito(); pintarProductos(); };

  const buscador = $('#buscador');
  buscador.value = '';
  buscador.oninput = () => {
    estado.busqueda = buscador.value.trim();
    $('#buscador-limpiar').hidden = !estado.busqueda;
    pintarCategorias();
    pintarProductos();
  };
  $('#buscador-limpiar').hidden = true;
  $('#buscador-limpiar').onclick = () => {
    buscador.value = '';
    estado.busqueda = '';
    $('#buscador-limpiar').hidden = true;
    buscador.blur();
    pintarCategorias();
    pintarProductos();
  };

  pintarCategorias();
  pintarProductos();
  pintarCarrito();
  mostrarPantalla('panel');
  iniciarSesion(INACTIVIDAD_EMPLEADO, '#sesion-aviso');
}

function buscando() { return estado.busqueda.length > 0; }

function productosVisibles() {
  if (!buscando()) return estado.productos.filter((p) => p.categoriaId === estado.categoriaSel);
  const terminos = normalizar(estado.busqueda).split(/\s+/).filter(Boolean);
  // Se busca también por categoría y por tamaño: "ron" trae toda la categoría y
  // "caja" trae las cervezas, que es como la gente busca de verdad.
  return estado.productos.filter((p) => {
    const objetivo = normalizar(`${p.nombre} ${nombreCategoria(p.categoriaId)} ${p.tamano || ''}`);
    return terminos.every((t) => objetivo.includes(t));
  });
}

function nombreCategoria(id) {
  return estado.categorias.find((c) => c.id === id)?.nombre || '';
}

function pintarCategorias() {
  const tiras = $('#tiras-categorias');
  tiras.classList.toggle('apagadas', buscando());
  tiras.replaceChildren(...estado.categorias
    .filter((c) => estado.productos.some((p) => p.categoriaId === c.id))
    .map((c) => el('button', {
      clase: `chip-categoria${!buscando() && c.id === estado.categoriaSel ? ' sel' : ''}`,
      estilo: { '--c': c.color },
      onclick: () => {
        estado.categoriaSel = c.id;
        if (buscando()) {
          estado.busqueda = '';
          $('#buscador').value = '';
          $('#buscador-limpiar').hidden = true;
        }
        pintarCategorias();
        pintarProductos();
      },
    }, [el('span', { clase: 'bolita' }), c.nombre])));
}

function pintarProductos() {
  const rejilla = $('#rejilla-productos');
  const lista = productosVisibles();
  if (!lista.length) {
    rejilla.replaceChildren(el('p', {
      clase: 'vacio',
      texto: buscando()
        ? `No hay ningún licor que se llame "${estado.busqueda}". Revisa cómo se escribe o búscalo por categoría.`
        : 'No hay productos en esta categoría.',
    }));
    return;
  }
  rejilla.replaceChildren(...lista.map((p) => {
    const e = estadoStock(p);
    const enCarrito = estado.carrito.get(p.id);
    return el('div', { clase: 'envoltura-tecla' }, [
      el('button', {
        clase: `tecla-producto estado-${e.clave}`,
        onclick: () => abrirSelectorCantidad(p),
      }, [
        el('span', {}, [
          buscando() ? el('span', { clase: 'cat', texto: nombreCategoria(p.categoriaId) }) : null,
          el('span', { clase: 'nom', texto: p.nombre }),
        ].filter(Boolean)),
        el('span', { clase: 'fila' }, [
          el('span', { clase: 'cant', texto: String(p.existencia) }),
          el('span', { clase: 'uni', texto: p.tamano || '' }),
          el('span', { clase: 'par', texto: `par ${p.par}` }),
        ]),
      ]),
      enCarrito ? el('span', { clase: 'en-carrito', texto: `+${enCarrito}` }) : null,
    ]);
  }));
  rejilla.scrollTop = 0;
}

function abrirSelectorCantidad(producto) {
  const yaEn = estado.carrito.get(producto.id) || 0;
  const disponible = producto.existencia - yaEn;

  const poner = (n) => {
    if (n <= 0) estado.carrito.delete(producto.id);
    else estado.carrito.set(producto.id, n);
    cerrarModal();
    pintarCarrito();
    pintarProductos();
  };

  const rejilla = el('div', { clase: 'cantidades' },
    [1, 2, 3, 4, 5, 6].map((n) => el('button', {
      clase: 'tecla',
      texto: String(n),
      onclick: () => poner(yaEn + n),
    })));

  const otra = el('input', { type: 'number', inputmode: 'numeric', min: '1', step: '1', placeholder: 'Cantidad exacta' });

  abrirModal({
    titulo: producto.nombre,
    subtitulo: `Quedan ${producto.existencia} en el almacén`
      + (yaEn ? ` · ya llevas ${yaEn}` : '')
      + (disponible <= 0 ? ' · sin disponible' : ''),
    contenido: el('div', {}, [
      el('p', {
        texto: '¿Cuántas te llevas?',
        estilo: { margin: '0 0 14px', color: 'var(--texto-2)', fontSize: '15px' },
      }),
      rejilla,
      el('div', { clase: 'campo', estilo: { marginTop: '18px', marginBottom: '0' } }, [
        el('label', { texto: 'Otra cantidad' }),
        otra,
      ]),
    ]),
    botones: [
      { texto: 'Cancelar', accion: cerrarModal },
      yaEn ? { texto: 'Quitar del carrito', clase: 'btn-peligro', accion: () => poner(0) } : null,
      {
        texto: 'Agregar',
        clase: 'btn-primario',
        accion: () => {
          const n = parseInt(otra.value, 10);
          if (Number.isInteger(n) && n > 0) poner(yaEn + n);
        },
      },
    ].filter(Boolean),
  });
}

function pintarCarrito() {
  const lista = $('#carrito-lista');
  const entradas = [...estado.carrito.entries()];
  if (!entradas.length) {
    lista.replaceChildren(el('p', {
      clase: 'carrito-vacio',
      texto: 'Toca los licores que te llevas. Puedes juntar varios y confirmar todo de una vez.',
    }));
  } else {
    lista.replaceChildren(...entradas.map(([id, cant]) => {
      const p = estado.productos.find((x) => x.id === id);
      const cambiar = (n) => {
        if (n <= 0) estado.carrito.delete(id); else estado.carrito.set(id, n);
        pintarCarrito(); pintarProductos();
      };
      return el('div', { clase: 'linea-carrito' }, [
        el('span', { clase: 'n', texto: p ? p.nombre : 'Producto' }),
        el('span', { clase: 'ctrl' }, [
          el('button', { texto: '−', onclick: () => cambiar(cant - 1) }),
          el('span', { clase: 'q', texto: String(cant) }),
          el('button', { texto: '+', onclick: () => cambiar(cant + 1) }),
        ]),
      ]);
    }));
  }
  const total = entradas.reduce((s, [, c]) => s + c, 0);
  $('#carrito-total').textContent = numero(total);
  $('#btn-confirmar').disabled = total === 0;
  $('#btn-vaciar').disabled = total === 0;
  $('#btn-confirmar').textContent = total ? `Confirmar salida de ${total}` : 'Confirmar salida';
}

async function confirmarSalida() {
  const lineas = [...estado.carrito.entries()].map(([productoId, cantidad]) => ({ productoId, cantidad }));
  if (!lineas.length) return;

  const faltantes = lineas.filter((l) => {
    const p = estado.productos.find((x) => x.id === l.productoId);
    return p && l.cantidad > p.existencia;
  });

  let autorizadoPor = null;
  if (faltantes.length) {
    const detalle = faltantes.map((l) => {
      const p = estado.productos.find((x) => x.id === l.productoId);
      return `${p.nombre}: pides ${l.cantidad}, quedan ${p.existencia}`;
    }).join('. ');
    const gerente = await autorizarGerente(
      `El sistema no cuadra con lo que estás sacando. ${detalle}. `
      + 'Si el conteo físico está mal, un gerente puede autorizar la salida y después corregir con un ajuste.',
    );
    if (!gerente) return;
    autorizadoPor = gerente.nombre;
  }

  $('#btn-confirmar').disabled = true;
  try {
    const { loteId } = await registrarLote({
      tipo: 'salida',
      lineas,
      empleadoId: estado.empleado.id,
      empleadoNombre: estado.empleado.nombre,
      restauranteId: estado.restaurante.id,
      permitirNegativo: Boolean(autorizadoPor),
      autorizadoPor,
    });

    const total = lineas.reduce((s, l) => s + l.cantidad, 0);
    // Se capturan ANTES de volver a la pantalla de acceso, que limpia la sesión.
    // Si la reversión se registrara a nombre de "sistema", el reporte por
    // empleado mostraría botellas que la persona en realidad devolvió.
    const idEmpleado = estado.empleado.id;
    const nombreEmpleado = estado.empleado.nombre;
    const nombreRest = estado.restaurante.nombre;

    brindis({
      texto: `${total} ${total === 1 ? 'botella registrada' : 'botellas registradas'}`,
      sub: `${nombreRest} · ${nombreEmpleado} · ${fechaHoraPR(new Date())}`,
      tipo: 'exito',
      segundos: SEG_DESHACER,
      accion: {
        texto: 'Deshacer',
        fn: async () => {
          try {
            await revertirLote(loteId, {
              empleadoId: idEmpleado,
              empleadoNombre: nombreEmpleado,
              motivo: 'Deshecho por el empleado dentro de los 15 segundos',
            });
            brindis({ texto: 'Salida deshecha', sub: 'Queda registrada la corrección.', tipo: 'exito' });
          } catch (e) {
            brindis({ texto: 'No se pudo deshacer', sub: e.message, tipo: 'error', segundos: 8 });
          }
        },
      },
    });
    mostrarAcceso();
  } catch (e) {
    brindis({ texto: 'No se registró la salida', sub: e.message, tipo: 'error', segundos: 8 });
    $('#btn-confirmar').disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Cambio de código por el propio empleado                             */
/* ------------------------------------------------------------------ */

function modalCambiarCodigo(empleado) {
  const actual = el('input', {
    type: 'password', inputmode: 'numeric', maxlength: String(LARGO_CODIGO), autocomplete: 'off',
    placeholder: '•'.repeat(LARGO_CODIGO),
  });
  const nuevo = el('input', {
    type: 'password', inputmode: 'numeric', maxlength: String(LARGO_CODIGO), autocomplete: 'off',
    placeholder: '•'.repeat(LARGO_CODIGO),
  });
  const repite = el('input', {
    type: 'password', inputmode: 'numeric', maxlength: String(LARGO_CODIGO), autocomplete: 'off',
    placeholder: '•'.repeat(LARGO_CODIGO),
  });
  const err = el('p', { clase: 'mensaje-error' });

  abrirModal({
    titulo: 'Cambiar mi código',
    subtitulo: 'El gerente te asignó el primero. Cámbialo por uno que solo tú conozcas: '
      + 'todo lo que saques queda a tu nombre.',
    contenido: el('div', {}, [
      el('div', { clase: 'campo' }, [el('label', { texto: 'Código actual' }), actual]),
      el('div', { clase: 'campo' }, [el('label', { texto: `Código nuevo (${LARGO_CODIGO} dígitos)` }), nuevo]),
      el('div', { clase: 'campo' }, [el('label', { texto: 'Repite el nuevo' }), repite]),
      err,
    ]),
    botones: [
      { texto: 'Cancelar', accion: cerrarModal },
      {
        texto: 'Guardar',
        clase: 'btn-primario',
        accion: async () => {
          const patron = new RegExp(`^\\d{${LARGO_CODIGO}}$`);
          if (!patron.test(nuevo.value.trim())) {
            err.textContent = `El código nuevo debe tener ${LARGO_CODIGO} dígitos.`; return;
          }
          if (nuevo.value.trim() !== repite.value.trim()) {
            err.textContent = 'Los dos códigos nuevos no coinciden.'; return;
          }
          if (codigoDebil(nuevo.value.trim())) {
            err.textContent = 'Ese código es demasiado fácil de adivinar.'; return;
          }
          const sal = await DB.leerConfig('sal_codigos', null);
          const hashActual = await derivarCodigo(actual.value.trim(), sal);
          if (!igualesConstante(hashActual, empleado.codigo)) {
            err.textContent = 'El código actual no es correcto.'; return;
          }
          const hashNuevo = await derivarCodigo(nuevo.value.trim(), sal);
          const todos = await DB.todos('empleados');
          if (todos.some((e) => e.id !== empleado.id && e.activo && e.codigo
            && igualesConstante(e.codigo, hashNuevo))) {
            err.textContent = 'Ese código ya lo tiene otra persona. Escoge otro.'; return;
          }
          const guardado = { ...empleado, codigo: hashNuevo };
          await DB.guardar('empleados', guardado);
          estado.empleado = guardado;
          await cargarCache();
          cerrarModal();
          brindis({ texto: 'Código cambiado', sub: 'Ahora solo tú lo conoces.', tipo: 'exito', segundos: 6 });
        },
      },
    ],
  });
  setTimeout(() => actual.focus(), 60);
}

/* ------------------------------------------------------------------ */
/* Sesión: cierre automático por inactividad                           */
/* ------------------------------------------------------------------ */

let sesion = null;

function iniciarSesion(segundos, selectorAviso) {
  detenerSesion();
  sesion = { total: segundos, restan: segundos, aviso: selectorAviso };
  sesion.intervalo = setInterval(() => {
    sesion.restan -= 1;
    pintarSesion();
    if (sesion.restan <= 0) cerrarPorInactividad();
  }, 1000);
  pintarSesion();
}

function pintarSesion() {
  if (!sesion) return;
  const caja = $(sesion.aviso);
  if (!caja) return;
  const urgente = sesion.restan <= 15;
  caja.classList.toggle('urgente', urgente);
  const texto = caja.querySelector('#sesion-texto');
  if (texto) texto.textContent = urgente ? `Cierra en ${sesion.restan}s` : 'Sesión activa';
  else caja.textContent = urgente ? `La sesión cierra en ${sesion.restan}s` : '';
  const barra = caja.querySelector('#sesion-barra');
  if (barra) barra.style.width = `${Math.max(0, (sesion.restan / sesion.total) * 100)}%`;
}

function reiniciarSesion() {
  if (!sesion) return;
  sesion.restan = sesion.total;
  pintarSesion();
}

function detenerSesion() {
  if (sesion) clearInterval(sesion.intervalo);
  sesion = null;
}

function cerrarPorInactividad() {
  detenerSesion();
  const nombre = estado.empleado?.nombre;
  if (modalAbierto()) cerrarModal();
  salirAdmin();
  ocultarBrindis();
  mostrarAcceso();
  brindis({
    texto: 'Sesión cerrada por inactividad',
    sub: nombre ? `Nadie más puede sacar botellas a nombre de ${nombre}.` : '',
    segundos: 5,
  });
}

['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => {
  document.addEventListener(ev, reiniciarSesion, { passive: true, capture: true });
});

/* ------------------------------------------------------------------ */
/* Navegación y arranque                                               */
/* ------------------------------------------------------------------ */

$('#velo').addEventListener('click', (ev) => { if (ev.target.id === 'velo') cerrarModal(); });
$('#admin-salir').onclick = () => { salirAdmin(); mostrarAcceso(); };

/* Un dedo apoyado en el vidrio no debe hacer zoom ni seleccionar texto. */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

/* El service worker es lo que hace que la app abra sin internet en el iPad,
   pero en desarrollo sirve archivos viejos y hace perder horas persiguiendo
   errores ya corregidos. En localhost no se registra, y si quedó uno de antes
   se elimina. En el iPad, que corre por HTTPS, funciona igual que siempre. */
const enDesarrollo = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

if ('serviceWorker' in navigator) {
  if (enDesarrollo) {
    navigator.serviceWorker.getRegistrations()
      .then((rs) => Promise.all(rs.map((r) => r.unregister())))
      .then(() => (window.caches ? caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))) : null))
      .catch(() => { /* nada que limpiar */ });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* sin conexión al registrar */ });
    });
  }
}

iniciar();

export { estado, autorizarGerente, mostrarAcceso };
