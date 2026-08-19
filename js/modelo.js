/* Lógica de negocio del almacén central.

   Modelo: existe UN inventario, el del almacén. El restaurante es el destino
   de cada salida, no un inventario aparte. Con eso el sistema contesta las dos
   preguntas que importan: qué hay que ordenar, y cuánto se llevó cada
   restaurante.

   Convención de signos: cada movimiento guarda un `delta` con signo aplicado
   al almacén.
     salida     → delta negativo, con restaurante
     devolución → delta positivo, con restaurante
     entrada    → delta positivo, sin restaurante (llegó del proveedor)
     ajuste     → delta con cualquier signo, sin restaurante (conteo físico)
     reversión  → delta espejo del movimiento original, hereda su restaurante

   Consumo de un restaurante = suma de (-delta) de sus movimientos. Así una
   devolución y una reversión descuentan solas del consumo, sin casos especiales. */

import { DB, nuevoId, pedir } from './db.js';

const ZONA = 'America/Puerto_Rico';

const TIPOS = {
  salida: { etiqueta: 'Salida', signo: -1, requiereRestaurante: true },
  entrada: { etiqueta: 'Entrada', signo: +1, requiereRestaurante: false },
  devolucion: { etiqueta: 'Devolución', signo: +1, requiereRestaurante: true },
  ajuste: { etiqueta: 'Ajuste por conteo', signo: 0, requiereRestaurante: false },
  reversion: { etiqueta: 'Reversión', signo: 0, requiereRestaurante: false },
};

/* --- Tiempo en hora de Puerto Rico (sin horario de verano) --- */

const FMT_FECHA = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
});

const FMT_HORA = new Intl.DateTimeFormat('es-PR', {
  timeZone: ZONA, hour: 'numeric', minute: '2-digit', hour12: true,
});

const FMT_LARGA = new Intl.DateTimeFormat('es-PR', {
  timeZone: ZONA, day: 'numeric', month: 'short', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true,
});

function fechaPR(d = new Date()) { return FMT_FECHA.format(d); }
function horaPR(d) { return FMT_HORA.format(typeof d === 'string' ? new Date(d) : d); }
function fechaHoraPR(d) { return FMT_LARGA.format(typeof d === 'string' ? new Date(d) : d); }

/* El día operativo arranca a la hora configurada (5:00 a.m. por defecto), para
   que lo que sale a la 1:30 a.m. cuente en el turno de la noche anterior. */
function diaOperativo(fecha, horaInicio) {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return fechaPR(new Date(d.getTime() - horaInicio * 3600000));
}

function sumarDias(diaISO, n) {
  const [a, m, d] = diaISO.split('-').map(Number);
  const base = new Date(Date.UTC(a, m - 1, d));
  base.setUTCDate(base.getUTCDate() + n);
  return base.toISOString().slice(0, 10);
}

/* --- Estado de existencias --- */

const ESTADOS = {
  agotado: { clave: 'agotado', etiqueta: 'Agotado', orden: 0 },
  critico: { clave: 'critico', etiqueta: 'Hay que ordenar', orden: 1 },
  bajo: { clave: 'bajo', etiqueta: 'Bajo el máximo', orden: 2 },
  ok: { clave: 'ok', etiqueta: 'En nivel', orden: 3 },
};

function estadoStock(p) {
  if (p.existencia <= 0) return ESTADOS.agotado;
  if (p.existencia <= p.puntoReorden) return ESTADOS.critico;
  if (p.existencia < p.par) return ESTADOS.bajo;
  return ESTADOS.ok;
}

/* --- Registro de movimientos --- */

function validarLineas(lineas) {
  if (!Array.isArray(lineas) || !lineas.length) {
    throw new Error('No hay nada que registrar.');
  }
  for (const l of lineas) {
    if (!l.productoId) throw new Error('Falta el producto en una de las líneas.');
    const c = Number(l.cantidad);
    if (!Number.isInteger(c) || c <= 0) {
      throw new Error('Las cantidades deben ser números enteros mayores que cero.');
    }
  }
}

/* Registra un lote completo en una sola transacción: o entra todo, o no entra
   nada. Si el iPad se apaga a media confirmación, no queda un inventario
   descuadrado. */
async function registrarLote({
  tipo, lineas, empleadoId, empleadoNombre, restauranteId = null,
  motivo = '', permitirNegativo = false, autorizadoPor = null,
  origen = 'empleado',
}) {
  const def = TIPOS[tipo];
  if (!def) throw new Error(`Tipo de movimiento desconocido: ${tipo}`);
  validarLineas(lineas);
  if (def.requiereRestaurante && !restauranteId) {
    throw new Error('Este movimiento necesita un restaurante.');
  }
  if ((tipo === 'ajuste' || tipo === 'devolucion') && !motivo.trim()) {
    throw new Error('El motivo es obligatorio en este movimiento.');
  }

  const horaInicio = await DB.leerConfig('inicio_dia_operativo', 5);
  const ahora = new Date();
  const fechaISO = ahora.toISOString();
  const dia = diaOperativo(ahora, horaInicio);
  const loteId = nuevoId('l');

  return DB.tx(['productos', 'movimientos'], 'readwrite', async (s) => {
    const movimientos = [];

    for (const linea of lineas) {
      const producto = await pedir(s.productos.get(linea.productoId));
      if (!producto) throw new Error('Un producto del lote ya no existe en el catálogo.');

      const antes = producto.existencia;
      let delta;
      if (tipo === 'ajuste') {
        const nueva = Number(linea.nuevaExistencia);
        if (!Number.isInteger(nueva) || nueva < 0) {
          throw new Error('La existencia contada debe ser un entero de cero o más.');
        }
        delta = nueva - antes;
        if (delta === 0) continue;
      } else {
        delta = def.signo * Number(linea.cantidad);
      }

      const despues = antes + delta;
      if (despues < 0 && !permitirNegativo) {
        throw new Error(
          `No hay suficiente ${producto.nombre}: quedan ${antes} y se piden ${Math.abs(delta)}.`,
        );
      }

      producto.existencia = despues;
      await pedir(s.productos.put(producto));

      movimientos.push({
        id: nuevoId('m'),
        loteId,
        tipo,
        productoId: producto.id,
        productoNombre: producto.nombre,
        categoriaId: producto.categoriaId,
        delta,
        existenciaAntes: antes,
        existenciaDespues: despues,
        restauranteId: def.requiereRestaurante ? restauranteId : null,
        empleadoId,
        empleadoNombre,
        costoUnitario: producto.costo || 0,
        // Tope duro en el modelo, no solo en el formulario: el motivo viaja al
        // CSV y a la lista impresa. Un texto sin límite se convierte en papel.
        motivo: motivo.trim().slice(0, 200),
        autorizadoPor,
        // Quién originó el movimiento, no quién lo firma. Una salida hecha
        // desde el panel de gerencia deja escoger el restaurante; la del
        // empleado no —el código lo determina—. Sin este campo las dos se ven
        // idénticas en el historial, y el argumento entero del sistema es
        // poder distinguirlas.
        origen,
        negativoPermitido: despues < 0,
        fechaISO,
        diaOperativo: dia,
        revierteA: null,
      });
    }

    if (!movimientos.length) throw new Error('No hubo ningún cambio que registrar.');
    for (const m of movimientos) await pedir(s.movimientos.put(m));
    return { loteId, movimientos, fechaISO };
  });
}

/* Deshacer no borra: crea el lote espejo. El historial conserva las dos caras
   de la corrección, que es lo que hace que el registro sirva como evidencia. */
async function revertirLote(loteId, { empleadoId, empleadoNombre, motivo = 'Corrección' }) {
  const horaInicio = await DB.leerConfig('inicio_dia_operativo', 5);
  const ahora = new Date();
  const fechaISO = ahora.toISOString();
  const dia = diaOperativo(ahora, horaInicio);
  const nuevoLote = nuevoId('l');

  return DB.tx(['productos', 'movimientos'], 'readwrite', async (s) => {
    const originales = await pedir(s.movimientos.index('porLote').getAll(loteId));
    if (!originales.length) throw new Error('No se encontró el movimiento a revertir.');
    if (originales.some((m) => m.tipo === 'reversion')) {
      throw new Error('Ese movimiento ya es una reversión.');
    }
    const yaRevertido = await pedir(s.movimientos.index('porRevierteA').getAll(loteId));
    if (yaRevertido.length) throw new Error('Ese movimiento ya fue revertido.');

    const espejos = [];
    for (const orig of originales) {
      const producto = await pedir(s.productos.get(orig.productoId));
      if (!producto) throw new Error('El producto de ese movimiento ya no existe.');
      const antes = producto.existencia;
      const delta = -orig.delta;
      const despues = antes + delta;
      if (despues < 0) {
        throw new Error(
          `No se puede revertir: dejaría ${producto.nombre} en negativo. Usa un ajuste por conteo.`,
        );
      }
      producto.existencia = despues;
      await pedir(s.productos.put(producto));

      espejos.push({
        ...orig,
        id: nuevoId('m'),
        loteId: nuevoLote,
        tipo: 'reversion',
        tipoOriginal: orig.tipo,
        delta,
        existenciaAntes: antes,
        existenciaDespues: despues,
        empleadoId,
        empleadoNombre,
        motivo,
        fechaISO,
        diaOperativo: dia,
        revierteA: loteId,
        negativoPermitido: false,
        autorizadoPor: null,
        // Explícito, no heredado del `...orig`: revertir solo se puede desde
        // el panel de gerencia. Sin esta línea, la reversión de la salida de
        // un mesero quedaría marcada como hecha por un empleado.
        origen: 'admin',
      });
    }
    for (const m of espejos) await pedir(s.movimientos.put(m));
    return { loteId: nuevoLote, movimientos: espejos };
  });
}

/* --- Consultas y reportes --- */

async function productosActivos() {
  const todos = await DB.todos('productos');
  return todos.filter((p) => p.activo).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)
    || a.nombre.localeCompare(b.nombre, 'es'));
}

async function listaCompra() {
  const productos = await productosActivos();
  return productos
    .filter((p) => p.existencia < p.par)
    .map((p) => ({
      ...p,
      estado: estadoStock(p),
      aOrdenar: p.par - p.existencia,
      costoOrden: (p.par - p.existencia) * (p.costo || 0),
    }))
    .sort((a, b) => a.estado.orden - b.estado.orden || a.nombre.localeCompare(b.nombre, 'es'));
}

async function movimientosPeriodo(desde, hasta) {
  const movs = await DB.movimientosEntre(desde, hasta);
  return movs.sort((a, b) => (a.fechaISO < b.fechaISO ? 1 : -1));
}

/* Consumo = -delta, solo de movimientos con restaurante. Devoluciones y
   reversiones descuentan solas. */
function agregar(movs, claveFn) {
  const mapa = new Map();
  for (const m of movs) {
    if (!m.restauranteId) continue;
    const clave = claveFn(m);
    if (clave == null) continue;
    const acc = mapa.get(clave) || { clave, unidades: 0, valor: 0, movimientos: 0 };
    acc.unidades += -m.delta;
    acc.valor += -m.delta * (m.costoUnitario || 0);
    acc.movimientos += 1;
    mapa.set(clave, acc);
  }
  return [...mapa.values()].filter((a) => a.unidades !== 0)
    .sort((a, b) => b.unidades - a.unidades);
}

const porRestaurante = (movs) => agregar(movs, (m) => m.restauranteId);
const porEmpleado = (movs) => agregar(movs, (m) => m.empleadoId);
const porProducto = (movs) => agregar(movs, (m) => m.productoId);

/* Consumo promedio semanal de los últimos `dias` días. Sirve para que el par no
   se ponga a ojo: si el proveedor tarda una semana, el par tiene que cubrir al
   menos el consumo de esa semana más un colchón. */
async function consumoSemanal(dias = 28) {
  const hasta = fechaPR();
  const desde = sumarDias(hasta, -dias);
  const movs = await DB.movimientosEntre(desde, hasta);
  const semanas = dias / 7;
  const mapa = new Map();
  for (const m of movs) {
    if (!m.restauranteId) continue;
    mapa.set(m.productoId, (mapa.get(m.productoId) || 0) + (-m.delta));
  }
  const salida = new Map();
  for (const [id, unidades] of mapa) salida.set(id, unidades / semanas);
  return salida;
}

async function resumenAlertas() {
  const productos = await productosActivos();
  let agotados = 0; let criticos = 0; let bajos = 0;
  for (const p of productos) {
    const e = estadoStock(p);
    if (e === ESTADOS.agotado) agotados += 1;
    else if (e === ESTADOS.critico) criticos += 1;
    else if (e === ESTADOS.bajo) bajos += 1;
  }
  return {
    total: productos.length,
    agotados,
    criticos,
    bajos,
    porOrdenar: agotados + criticos + bajos,
    valorInventario: productos.reduce((s, p) => s + p.existencia * (p.costo || 0), 0),
  };
}

export {
  ZONA, TIPOS, ESTADOS,
  fechaPR, horaPR, fechaHoraPR, diaOperativo, sumarDias,
  estadoStock, registrarLote, revertirLote,
  productosActivos, listaCompra, movimientosPeriodo,
  porRestaurante, porEmpleado, porProducto,
  consumoSemanal, resumenAlertas,
};
