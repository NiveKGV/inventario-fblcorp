/* Arranque, sesión y flujo del empleado.
   Puerta de entrada: restaurante → empleado → PIN → panel de salida. */

import { DB, nuevoId } from './db.js';
import { cifrarPin, verificarPin, contextoSeguro } from './cripto.js';
import { RESTAURANTES, CATEGORIAS, productosIniciales, empleadosEjemplo } from './datos.js';
import {
  estadoStock, registrarLote, revertirLote, productosActivos, resumenAlertas, fechaHoraPR,
} from './modelo.js';
import {
  $, $$, el, mostrarPantalla, abrirModal, cerrarModal, modalAbierto,
  brindis, ocultarBrindis, numero, iniciales,
} from './ui.js';
import { abrirAdmin, salirAdmin } from './admin.js';

const INACTIVIDAD_EMPLEADO = 60;   // segundos
const INACTIVIDAD_GERENTE = 300;   // el gerente hace captura de datos, 60s no alcanza
const INTENTOS_MAX = 5;
const BLOQUEO_SEG = 60;
const SEG_DESHACER = 15;

const estado = {
  restaurantes: [],
  categorias: [],
  productos: [],
  empleados: [],
  restaurante: null,
  empleado: null,
  categoriaSel: null,
  carrito: new Map(),
  ultimoLote: null,
};

/* ------------------------------------------------------------------ */
/* Arranque                                                            */
/* ------------------------------------------------------------------ */

async function iniciar() {
  try {
    if (!contextoSeguro()) {
      $('#carga-texto').textContent = 'Esta app debe abrirse por HTTPS (o desde localhost). '
        + 'Sin contexto seguro el navegador no permite cifrar los PIN y el sistema no arranca.';
      return;
    }
    await DB.abrir();
    const configurado = await DB.leerConfig('configurado', false);
    if (!configurado) { prepararConfigInicial(); return; }
    await cargarCache();
    mostrarRestaurantes();
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
    const pin = $('#cfg-pin').value.trim();
    const pin2 = $('#cfg-pin2').value.trim();
    error.textContent = '';

    if (nombre.length < 3) { error.textContent = 'Escribe el nombre completo del gerente.'; return; }
    if (!/^\d{6}$/.test(pin)) { error.textContent = 'El PIN de gerencia debe tener exactamente 6 dígitos.'; return; }
    if (/^(\d)\1{5}$/.test(pin) || pin === '123456' || pin === '654321') {
      error.textContent = 'Ese PIN es demasiado fácil de adivinar. Usa una combinación menos obvia.';
      return;
    }
    if (pin !== pin2) { error.textContent = 'Los dos PIN no coinciden.'; return; }

    $('#cfg-crear').disabled = true;
    $('#cfg-crear').textContent = 'Creando…';
    try {
      const conEjemplo = $('#cfg-ejemplo').value === 'si';
      await DB.guardarVarios('restaurantes', RESTAURANTES);
      await DB.guardarVarios('categorias', CATEGORIAS);
      if (conEjemplo) {
        await DB.guardarVarios('productos', productosIniciales());
        await DB.guardarVarios('empleados', empleadosEjemplo());
      }
      await DB.guardar('empleados', {
        id: nuevoId('g'),
        nombre,
        restauranteId: null,
        rol: 'gerente',
        pin: await cifrarPin(pin),
        activo: true,
        ejemplo: false,
        intentosFallidos: 0,
        bloqueadoHasta: null,
        creado: new Date().toISOString(),
      });
      await DB.escribirConfig('inicio_dia_operativo', 5);
      await DB.escribirConfig('nombre_almacen', 'Almacén central');
      await DB.escribirConfig('configurado', true);
      await cargarCache();
      mostrarRestaurantes();
      brindis({
        texto: 'Sistema listo',
        sub: 'Crea un segundo gerente en Administración: si solo una persona conoce el PIN, el almacén se queda sin administrar el día que no esté.',
        tipo: 'exito',
        segundos: 12,
      });
    } catch (e) {
      error.textContent = e.message;
      $('#cfg-crear').disabled = false;
      $('#cfg-crear').textContent = 'Crear y empezar';
    }
  };
}

/* ------------------------------------------------------------------ */
/* Pantalla de restaurantes                                            */
/* ------------------------------------------------------------------ */

async function mostrarRestaurantes() {
  detenerSesion();
  estado.restaurante = null;
  estado.empleado = null;
  estado.carrito.clear();
  await cargarCache();

  const rejilla = $('#rejilla-restaurantes');
  rejilla.replaceChildren(...estado.restaurantes.map((r) => {
    const cuantos = estado.empleados.filter((e) => e.restauranteId === r.id).length;
    return el('button', {
      clase: 'tarjeta-restaurante',
      estilo: { '--c': r.color },
      onclick: () => mostrarEmpleados(r),
    }, [
      el('span', { clase: 'punto' }),
      el('span', { clase: 'nombre', texto: r.nombre }),
      el('span', {
        clase: 'meta',
        texto: cuantos === 1 ? '1 empleado registrado' : `${cuantos} empleados registrados`,
      }),
    ]);
  }));

  const alertas = await resumenAlertas();
  $('#pie-info').textContent = alertas.porOrdenar > 0
    ? `${alertas.porOrdenar} ${alertas.porOrdenar === 1 ? 'producto está' : 'productos están'} bajo el nivel par`
    : 'Todo el inventario está en nivel';

  $('#btn-admin').onclick = entrarComoGerente;
  mostrarPantalla('restaurantes');
}

/* ------------------------------------------------------------------ */
/* Pantalla de empleados                                               */
/* ------------------------------------------------------------------ */

function mostrarEmpleados(restaurante) {
  estado.restaurante = restaurante;
  document.documentElement.style.setProperty('--acento', restaurante.color);
  $('#emp-titulo').textContent = restaurante.nombre;
  $('#emp-punto').style.background = restaurante.color;

  const lista = estado.empleados
    .filter((e) => e.restauranteId === restaurante.id && e.rol === 'empleado')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  const rejilla = $('#rejilla-empleados');
  if (!lista.length) {
    rejilla.replaceChildren(el('p', {
      clase: 'vacio',
      texto: `No hay empleados registrados en ${restaurante.nombre}. `
        + 'El gerente los agrega desde Administración → Empleados.',
    }));
  } else {
    rejilla.replaceChildren(...lista.map((emp) => tarjetaEmpleado(emp)));
  }
  mostrarPantalla('empleados');
}

function tarjetaEmpleado(emp) {
  const bloqueado = emp.bloqueadoHasta && new Date(emp.bloqueadoHasta) > new Date();
  const sinPin = !emp.pin;
  return el('button', {
    clase: `tarjeta-empleado${bloqueado ? ' bloqueado' : ''}`,
    onclick: () => (bloqueado ? null : pedirPinEmpleado(emp)),
  }, [
    el('span', { clase: 'inicial', texto: iniciales(emp.nombre) }),
    el('span', {}, [
      el('span', { clase: 'nombre', texto: emp.nombre }),
      el('br'),
      el('span', {
        clase: 'estado',
        texto: bloqueado ? 'Bloqueado un momento' : (sinPin ? 'Primer ingreso: crea tu PIN' : ''),
      }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ */
/* Teclado de PIN                                                      */
/* ------------------------------------------------------------------ */

let pinEstado = null;

function montarTecladoPin({ titulo, sub, largo, alCompletar, volverA }) {
  pinEstado = { valor: '', largo, alCompletar, ocupado: false };
  $('#pin-titulo').textContent = titulo;
  $('#pin-sub').textContent = sub || '';
  $('#pin-error').textContent = '';
  $('#pin-caja').classList.remove('error');
  $('#pin-atras').dataset.volver = volverA || 'empleados';

  const puntos = $('#pin-puntos');
  puntos.replaceChildren(...Array.from({ length: largo }, () => el('span', { clase: 'pin-punto' })));

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'borrar', '0', 'limpiar'];
  $('#pin-teclado').replaceChildren(...teclas.map((t) => {
    if (t === 'borrar') {
      return el('button', { clase: 'tecla aux', texto: 'Borrar', onclick: () => teclearPin(null) });
    }
    if (t === 'limpiar') {
      return el('button', { clase: 'tecla aux', texto: 'Limpiar', onclick: () => teclearPin('reset') });
    }
    return el('button', { clase: 'tecla', texto: t, onclick: () => teclearPin(t) });
  }));

  mostrarPantalla('pin');
}

function pintarPuntos() {
  $$('#pin-puntos .pin-punto').forEach((p, i) => p.classList.toggle('lleno', i < pinEstado.valor.length));
}

function teclearPin(digito) {
  if (!pinEstado || pinEstado.ocupado) return;
  $('#pin-caja').classList.remove('error');
  $('#pin-error').textContent = '';
  if (digito === null) pinEstado.valor = pinEstado.valor.slice(0, -1);
  else if (digito === 'reset') pinEstado.valor = '';
  else if (pinEstado.valor.length < pinEstado.largo) pinEstado.valor += digito;
  pintarPuntos();

  if (pinEstado.valor.length === pinEstado.largo) {
    pinEstado.ocupado = true;
    const valor = pinEstado.valor;
    setTimeout(async () => {
      try {
        await pinEstado.alCompletar(valor);
      } catch (e) {
        // Un fallo aquí dejaba a la persona mirando el teclado sin ninguna
        // explicación. Cualquier error tiene que verse en pantalla.
        console.error('Fallo al procesar el PIN:', e);
        errorPin(e.message || 'Algo falló. Vuelve a intentar.');
      } finally {
        if (pinEstado) { pinEstado.valor = ''; pinEstado.ocupado = false; pintarPuntos(); }
      }
    }, 130);
  }
}

function errorPin(mensaje) {
  $('#pin-error').textContent = mensaje;
  $('#pin-caja').classList.add('error');
}

/* --- PIN de empleado --- */

function pedirPinEmpleado(emp) {
  if (!emp.pin) { crearPinEmpleado(emp); return; }
  montarTecladoPin({
    titulo: emp.nombre,
    sub: `${estado.restaurante.nombre} · entra tu PIN de 4 dígitos`,
    largo: 4,
    volverA: 'empleados',
    alCompletar: async (pin) => {
      const actual = await DB.obtener('empleados', emp.id);
      if (actual.bloqueadoHasta && new Date(actual.bloqueadoHasta) > new Date()) {
        const faltan = Math.ceil((new Date(actual.bloqueadoHasta) - new Date()) / 1000);
        errorPin(`Bloqueado. Espera ${faltan} segundos.`);
        return;
      }
      const ok = await verificarPin(pin, actual.pin);
      if (!ok) {
        actual.intentosFallidos = (actual.intentosFallidos || 0) + 1;
        if (actual.intentosFallidos >= INTENTOS_MAX) {
          actual.bloqueadoHasta = new Date(Date.now() + BLOQUEO_SEG * 1000).toISOString();
          actual.intentosFallidos = 0;
          await DB.guardar('empleados', actual);
          errorPin(`Cinco intentos fallidos. Bloqueado ${BLOQUEO_SEG} segundos.`);
          setTimeout(() => mostrarEmpleados(estado.restaurante), 1400);
          return;
        }
        await DB.guardar('empleados', actual);
        errorPin(`PIN incorrecto. Quedan ${INTENTOS_MAX - actual.intentosFallidos} intentos.`);
        return;
      }
      actual.intentosFallidos = 0;
      actual.bloqueadoHasta = null;
      await DB.guardar('empleados', actual);
      await abrirPanel(actual);
    },
  });
}

function crearPinEmpleado(emp) {
  let primero = null;
  montarTecladoPin({
    titulo: `Hola, ${emp.nombre.split(' ')[0]}`,
    sub: 'Primer ingreso: crea tu PIN de 4 dígitos. Que el gerente esté presente.',
    largo: 4,
    volverA: 'empleados',
    alCompletar: async (pin) => {
      if (!primero) {
        if (/^(\d)\1{3}$/.test(pin) || pin === '1234' || pin === '0000') {
          errorPin('Ese PIN es demasiado fácil de adivinar. Escoge otro.');
          return;
        }
        primero = pin;
        $('#pin-titulo').textContent = 'Repite tu PIN';
        $('#pin-sub').textContent = 'Para confirmar que no hubo un dedazo.';
        return;
      }
      if (pin !== primero) {
        primero = null;
        $('#pin-titulo').textContent = `Hola, ${emp.nombre.split(' ')[0]}`;
        $('#pin-sub').textContent = 'Crea tu PIN de 4 dígitos.';
        errorPin('Los dos PIN no coinciden. Empieza de nuevo.');
        return;
      }
      const actual = await DB.obtener('empleados', emp.id);
      actual.pin = await cifrarPin(pin);
      actual.intentosFallidos = 0;
      actual.bloqueadoHasta = null;
      await DB.guardar('empleados', actual);
      brindis({ texto: 'PIN creado', sub: 'Solo tú lo conoces. Todo lo que saques queda a tu nombre.', tipo: 'exito', segundos: 6 });
      await abrirPanel(actual);
    },
  });
}

/* --- PIN de gerente --- */

function entrarComoGerente() {
  const gerentes = estado.empleados.filter((e) => e.rol === 'gerente');
  if (!gerentes.length) { brindis({ texto: 'No hay ningún gerente registrado.', tipo: 'error' }); return; }
  if (gerentes.length === 1) { pedirPinGerente(gerentes[0]); return; }

  estado.restaurante = { id: null, nombre: 'Administración', color: '#8a8f9a' };
  document.documentElement.style.setProperty('--acento', '#8a8f9a');
  $('#emp-titulo').textContent = 'Administración';
  $('#emp-punto').style.background = '#8a8f9a';
  $('#rejilla-empleados').replaceChildren(...gerentes.map((g) => el('button', {
    clase: 'tarjeta-empleado',
    onclick: () => pedirPinGerente(g),
  }, [
    el('span', { clase: 'inicial', texto: iniciales(g.nombre) }),
    el('span', {}, [
      el('span', { clase: 'nombre', texto: g.nombre }),
      el('br'),
      el('span', { clase: 'estado', texto: 'Gerencia' }),
    ]),
  ])));
  mostrarPantalla('empleados');
}

function pedirPinGerente(gerente) {
  montarTecladoPin({
    titulo: gerente.nombre,
    sub: 'PIN de gerencia, 6 dígitos',
    largo: 6,
    volverA: 'restaurantes',
    alCompletar: async (pin) => {
      const actual = await DB.obtener('empleados', gerente.id);
      if (actual.bloqueadoHasta && new Date(actual.bloqueadoHasta) > new Date()) {
        const faltan = Math.ceil((new Date(actual.bloqueadoHasta) - new Date()) / 1000);
        errorPin(`Bloqueado. Espera ${faltan} segundos.`);
        return;
      }
      if (!await verificarPin(pin, actual.pin)) {
        actual.intentosFallidos = (actual.intentosFallidos || 0) + 1;
        if (actual.intentosFallidos >= INTENTOS_MAX) {
          actual.bloqueadoHasta = new Date(Date.now() + BLOQUEO_SEG * 1000).toISOString();
          actual.intentosFallidos = 0;
        }
        await DB.guardar('empleados', actual);
        errorPin('PIN incorrecto.');
        return;
      }
      actual.intentosFallidos = 0;
      actual.bloqueadoHasta = null;
      await DB.guardar('empleados', actual);
      estado.empleado = actual;
      iniciarSesion(INACTIVIDAD_GERENTE, '#admin-sesion');
      abrirAdmin(actual, { alSalir: mostrarRestaurantes, refrescarCache: cargarCache, estado });
    },
  });
}

/* Pide el PIN de un gerente dentro de un modal, para autorizar una excepción
   sin que el empleado abandone lo que estaba haciendo. */
function autorizarGerente(motivo) {
  return new Promise((resolve) => {
    const entrada = el('input', {
      type: 'password', inputmode: 'numeric', maxlength: 6, autocomplete: 'off', placeholder: '••••••',
    });
    const err = el('p', { clase: 'mensaje-error' });
    const select = el('select', {}, estado.empleados.filter((e) => e.rol === 'gerente')
      .map((g) => el('option', { value: g.id, texto: g.nombre })));

    abrirModal({
      titulo: 'Autorización de gerencia',
      subtitulo: motivo,
      contenido: el('div', {}, [
        el('div', { clase: 'campo' }, [el('label', { texto: 'Gerente' }), select]),
        el('div', { clase: 'campo' }, [el('label', { texto: 'PIN de 6 dígitos' }), entrada]),
        err,
      ]),
      botones: [
        { texto: 'Cancelar', accion: () => { cerrarModal(); resolve(null); } },
        {
          texto: 'Autorizar',
          clase: 'btn-primario',
          accion: async () => {
            const g = await DB.obtener('empleados', select.value);
            if (await verificarPin(entrada.value.trim(), g.pin)) {
              cerrarModal();
              resolve(g);
            } else {
              err.textContent = 'PIN incorrecto.';
            }
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

async function abrirPanel(empleado) {
  // Sin restaurante no hay a quién cargarle la salida, y una salida sin destino
  // rompe todo el sentido del registro. Se vuelve al principio, no se sigue.
  if (!estado.restaurante || !estado.restaurante.id) {
    await mostrarRestaurantes();
    brindis({
      texto: 'Empieza por tu restaurante',
      sub: 'Se perdió la selección. Escoge de nuevo y vuelve a entrar.',
      tipo: 'error',
      segundos: 6,
    });
    return;
  }
  estado.empleado = empleado;
  estado.carrito.clear();
  await cargarCache();
  estado.categoriaSel = estado.categorias.find(
    (c) => estado.productos.some((p) => p.categoriaId === c.id),
  )?.id || null;

  $('#panel-titulo').textContent = estado.restaurante.nombre;
  $('#panel-sub').textContent = empleado.nombre;
  $('#panel-punto').style.background = estado.restaurante.color;
  $('#btn-salir').onclick = () => mostrarRestaurantes();
  $('#btn-confirmar').onclick = confirmarSalida;
  $('#btn-vaciar').onclick = () => { estado.carrito.clear(); pintarCarrito(); pintarProductos(); };

  pintarCategorias();
  pintarProductos();
  pintarCarrito();
  mostrarPantalla('panel');
  iniciarSesion(INACTIVIDAD_EMPLEADO, '#sesion-aviso');
}

function pintarCategorias() {
  const tiras = $('#tiras-categorias');
  tiras.replaceChildren(...estado.categorias
    .filter((c) => estado.productos.some((p) => p.categoriaId === c.id))
    .map((c) => el('button', {
      clase: `chip-categoria${c.id === estado.categoriaSel ? ' sel' : ''}`,
      estilo: { '--c': c.color },
      onclick: () => { estado.categoriaSel = c.id; pintarCategorias(); pintarProductos(); },
    }, [el('span', { clase: 'bolita' }), c.nombre])));
}

function pintarProductos() {
  const rejilla = $('#rejilla-productos');
  const lista = estado.productos.filter((p) => p.categoriaId === estado.categoriaSel);
  if (!lista.length) {
    rejilla.replaceChildren(el('p', { clase: 'vacio', texto: 'No hay productos en esta categoría.' }));
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
        el('span', { clase: 'nom', texto: p.nombre }),
        el('span', { clase: 'fila' }, [
          el('span', { clase: 'cant', texto: String(p.existencia) }),
          el('span', { clase: 'uni', texto: p.tamano || '' }),
          el('span', { clase: 'par', texto: `par ${p.par}` }),
        ]),
      ]),
      enCarrito ? el('span', { clase: 'en-carrito', texto: `+${enCarrito}` }) : null,
    ]);
  }));
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
    // Se capturan ANTES de volver a la pantalla de restaurantes, que limpia la
    // sesión. Si la reversión se registrara a nombre de "sistema", el reporte
    // por empleado mostraría al empleado con botellas que en realidad devolvió.
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
    mostrarRestaurantes();
  } catch (e) {
    brindis({ texto: 'No se registró la salida', sub: e.message, tipo: 'error', segundos: 8 });
    $('#btn-confirmar').disabled = false;
  }
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
  if (texto) {
    texto.textContent = urgente ? `Cierra en ${sesion.restan}s` : 'Sesión activa';
  } else {
    caja.textContent = urgente ? `La sesión cierra en ${sesion.restan}s` : '';
  }
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
  mostrarRestaurantes();
  brindis({
    texto: 'Sesión cerrada por inactividad',
    sub: nombre ? `Nadie más puede sacar botellas a nombre de ${nombre}.` : '',
    tipo: '',
    segundos: 5,
  });
}

['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => {
  document.addEventListener(ev, reiniciarSesion, { passive: true, capture: true });
});

/* ------------------------------------------------------------------ */
/* Navegación y arranque                                               */
/* ------------------------------------------------------------------ */

document.addEventListener('click', (ev) => {
  const boton = ev.target.closest('[data-volver]');
  if (!boton) return;
  const destino = boton.dataset.volver;
  if (destino === 'restaurantes') mostrarRestaurantes();
  else if (destino === 'empleados' && estado.restaurante) mostrarEmpleados(estado.restaurante);
  else mostrarRestaurantes();
});

$('#velo').addEventListener('click', (ev) => { if (ev.target.id === 'velo') cerrarModal(); });

$('#admin-salir').onclick = () => { salirAdmin(); mostrarRestaurantes(); };

/* Un dedo apoyado en el vidrio no debe hacer zoom ni seleccionar texto. */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin conexión al registrar */ });
  });
}

iniciar();

export { estado, autorizarGerente, mostrarRestaurantes };
