/* Carga del catálogo desde un CSV.

   Existe porque entrar doscientos productos a mano son siete horas de teclear
   y cuatro de pensar niveles par. Con la plantilla llena, son veinte minutos.

   Tres reglas que sostienen el diseño:

   1. NUNCA BORRA. Crea los productos nuevos y actualiza los que ya están,
      emparejando por nombre. Un producto que no aparezca en el archivo queda
      intacto. Importar dos veces no destruye nada.

   2. LA EXISTENCIA SOLO SE FIJA AL CREAR. Si el producto ya existe, se
      actualizan nombre, categoría, tamaño, costo y niveles, pero no la
      existencia: esa la manda el inventario vivo, no una hoja de cálculo.
      Sin esta regla, reimportar el catálogo corregido en marzo devolvería el
      inventario a los números de enero.

   3. LA EXISTENCIA INICIAL DEJA RASTRO. Entra como un movimiento de ajuste con
      motivo "Carga inicial de catálogo", igual que cualquier otro cambio de
      inventario. Si entrara sin movimiento, el historial no cuadraría desde el
      primer día y dejaría de servir como evidencia. */

import { DB, nuevoId, pedir } from './db.js';
import { diaOperativo } from './modelo.js';
import { normalizar } from './ui.js';

/* Ellos piden los lunes y la mercancía llega martes o miércoles. Así que un
   producto que baje del par un martes tiene que aguantar hasta el miércoles
   siguiente: ocho días. De ahí salen los dos multiplicadores. */
const SEMANAS_POR_MES = 4.3;
const FACTOR_REORDEN = 1.2;  // ~8 días de consumo
const FACTOR_PAR = 1.7;      // semana de ciclo + entrega + colchón

const LARGO_NOMBRE = 60;
const LARGO_TAMANO = 20;

const ALIAS = {
  nombre: ['producto', 'nombre'],
  categoria: ['categoria'],
  tamano: ['tamano', 'presentacion'],
  costo: ['costo', 'precio'],
  existencia: ['existencia', 'inventario'],
  pedido: ['pide', 'pedido', 'consumo'],
};

/* --- Lectura del archivo --------------------------------------------- */

function clave(texto) {
  return normalizar(texto).replace(/[^a-z0-9]/g, '');
}

/* Excel en español exporta con punto y coma. Se detecta en la primera línea en
   vez de asumir la coma, porque un archivo mal leído no da error: da doscientos
   productos con el nombre pegado a la categoría. */
function detectarSeparador(primeraLinea) {
  const comas = (primeraLinea.match(/,/g) || []).length;
  const puntoYComa = (primeraLinea.match(/;/g) || []).length;
  return puntoYComa > comas ? ';' : ',';
}

function parsearCSV(texto) {
  const limpio = String(texto).replace(/^﻿/, '');
  const sep = detectarSeparador(limpio.split(/\r?\n/)[0] || '');
  const filas = [];
  let fila = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < limpio.length; i += 1) {
    const c = limpio[i];
    if (enComillas) {
      if (c === '"') {
        if (limpio[i + 1] === '"') { campo += '"'; i += 1; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(campo); campo = ''; }
    else if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; }
    else if (c !== '\r') campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }

  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/* Acepta "32.50", "$32.50", "1,250" y el "32,50" que escribe Excel en español.

   La coma es ambigua: decimal en español, miles en inglés. Se desempata por lo
   que viene después de la última coma — tres dígitos exactos es separador de
   miles ("1,250" son mil doscientos cincuenta), uno o dos es decimal ("32,50").
   Queda un caso irresoluble: "1,500" en notación española sería uno y medio,
   pero se lee como mil quinientos. Para el costo de una botella, la segunda
   lectura es la probable. */
function aNumero(valor) {
  if (valor == null) return null;
  let t = String(valor).trim().replace(/[$\s]/g, '');
  if (t === '') return null;

  const tieneComa = t.includes(',');
  const tienePunto = t.includes('.');

  if (tieneComa && tienePunto) {
    // El separador que aparece de último es el decimal.
    t = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (tieneComa) {
    const partes = t.split(',');
    const ultima = partes[partes.length - 1];
    t = (partes.length > 2 || ultima.length === 3) ? partes.join('') : partes.join('.');
  }

  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function mapearColumnas(encabezados) {
  const mapa = {};
  encabezados.forEach((cru, i) => {
    const k = clave(cru);
    if (!k) return;
    if (k === 'par' && mapa.par === undefined) { mapa.par = i; return; }
    if (k.startsWith('reorden') || k === 'puntodereorden') { mapa.reorden = i; return; }
    for (const [campo, alias] of Object.entries(ALIAS)) {
      if (mapa[campo] === undefined && alias.some((a) => k.includes(a))) { mapa[campo] = i; return; }
    }
  });
  return mapa;
}

/* --- Niveles ---------------------------------------------------------- */

function nivelesDesdePedido(pedidoMensual) {
  if (!pedidoMensual || pedidoMensual <= 0) return { par: 0, reorden: 0, calculado: false };
  const semanal = pedidoMensual / SEMANAS_POR_MES;
  const reorden = Math.max(1, Math.ceil(semanal * FACTOR_REORDEN));
  const par = Math.max(2, reorden + 1, Math.ceil(semanal * FACTOR_PAR));
  return { par, reorden, calculado: true };
}

/* --- Interpretación --------------------------------------------------- */

function interpretar(texto, { categorias, productos }) {
  const filas = parsearCSV(texto);
  if (filas.length < 2) {
    return { fatal: 'El archivo no tiene filas de datos debajo del encabezado.' };
  }

  const columnas = mapearColumnas(filas[0]);
  const faltan = ['nombre', 'categoria'].filter((c) => columnas[c] === undefined);
  if (faltan.length) {
    return {
      fatal: 'No se encontró la columna de '
        + faltan.map((f) => (f === 'nombre' ? 'Producto' : 'Categoría')).join(' ni la de ')
        + '. ¿Se guardó la hoja «Catálogo» y no la de instrucciones?',
    };
  }

  const porNombreCat = new Map(categorias.map((c) => [clave(c.nombre), c]));
  const porNombreProd = new Map(productos.map((p) => [clave(p.nombre), p]));
  const vistos = new Map();
  const categoriasNuevas = new Map();
  const lineas = [];
  const errores = [];

  const leer = (fila, campo) => (columnas[campo] === undefined ? '' : (fila[columnas[campo]] ?? '').trim());

  for (let i = 1; i < filas.length; i += 1) {
    const numeroFila = i + 1;
    const fila = filas[i];
    const falla = (mensaje) => errores.push({ fila: numeroFila, mensaje });

    const nombre = leer(fila, 'nombre').slice(0, LARGO_NOMBRE);
    if (!nombre) continue; // fila en blanco de la plantilla

    const k = clave(nombre);
    if (vistos.has(k)) {
      falla(`«${nombre}» está repetido (ya venía en la fila ${vistos.get(k)}).`);
      continue;
    }
    vistos.set(k, numeroFila);

    const catNombre = leer(fila, 'categoria');
    if (!catNombre) { falla(`«${nombre}» no tiene categoría.`); continue; }

    const costo = aNumero(leer(fila, 'costo'));
    if (Number.isNaN(costo)) { falla(`«${nombre}»: el costo no es un número.`); continue; }
    const existencia = aNumero(leer(fila, 'existencia'));
    if (Number.isNaN(existencia)) { falla(`«${nombre}»: la existencia no es un número.`); continue; }
    const pedido = aNumero(leer(fila, 'pedido'));
    if (Number.isNaN(pedido)) { falla(`«${nombre}»: el pedido mensual no es un número.`); continue; }
    if (existencia != null && (!Number.isInteger(existencia) || existencia < 0)) {
      falla(`«${nombre}»: la existencia debe ser un entero de cero o más.`); continue;
    }

    const parManual = aNumero(leer(fila, 'par'));
    const reordenManual = aNumero(leer(fila, 'reorden'));
    const auto = nivelesDesdePedido(pedido);
    const par = parManual != null && !Number.isNaN(parManual) ? Math.max(0, Math.round(parManual)) : auto.par;
    const reorden = reordenManual != null && !Number.isNaN(reordenManual)
      ? Math.max(0, Math.round(reordenManual)) : auto.reorden;

    const existente = porNombreProd.get(k);
    const catExistente = porNombreCat.get(clave(catNombre));
    if (!catExistente && !categoriasNuevas.has(clave(catNombre))) {
      categoriasNuevas.set(clave(catNombre), catNombre);
    }

    lineas.push({
      fila: numeroFila,
      nombre,
      categoriaNombre: catExistente ? catExistente.nombre : catNombre,
      categoriaId: catExistente ? catExistente.id : null,
      tamano: leer(fila, 'tamano').slice(0, LARGO_TAMANO),
      costo: costo ?? 0,
      existencia: existencia ?? 0,
      par,
      reorden: Math.min(reorden, Math.max(0, par - 1)),
      nivelesCalculados: parManual == null && auto.calculado,
      sinNivel: par <= 0,
      accion: existente ? 'actualizar' : 'crear',
      idExistente: existente ? existente.id : null,
    });
  }

  return {
    lineas,
    errores,
    categoriasNuevas: [...categoriasNuevas.values()],
    resumen: {
      total: lineas.length,
      crear: lineas.filter((l) => l.accion === 'crear').length,
      actualizar: lineas.filter((l) => l.accion === 'actualizar').length,
      sinNivel: lineas.filter((l) => l.sinNivel).length,
      conExistencia: lineas.filter((l) => l.accion === 'crear' && l.existencia > 0).length,
    },
  };
}

/* --- Escritura -------------------------------------------------------- */

/* Todo en una transacción: doscientos productos entran completos o no entra
   ninguno. A media carga, un catálogo partido es peor que no tener catálogo. */
async function aplicar(plan, { empleadoId, empleadoNombre }) {
  const horaInicio = await DB.leerConfig('inicio_dia_operativo', 5);
  const ahora = new Date();
  const fechaISO = ahora.toISOString();
  const dia = diaOperativo(ahora, horaInicio);
  const loteId = nuevoId('l');

  const categoriasPrevias = await DB.todos('categorias');
  const maxOrden = categoriasPrevias.reduce((m, c) => Math.max(m, c.orden || 0), 0);

  return DB.tx(['categorias', 'productos', 'movimientos'], 'readwrite', async (s) => {
    const idsPorClave = new Map(categoriasPrevias.map((c) => [clave(c.nombre), c.id]));

    let orden = maxOrden;
    for (const nombre of plan.categoriasNuevas) {
      orden += 1;
      const id = nuevoId('c');
      await pedir(s.categorias.put({
        id, nombre, color: '#7a8290', orden, activa: true,
      }));
      idsPorClave.set(clave(nombre), id);
    }

    let creados = 0;
    let actualizados = 0;
    let movimientos = 0;

    for (const l of plan.lineas) {
      const categoriaId = l.categoriaId || idsPorClave.get(clave(l.categoriaNombre));

      if (l.accion === 'actualizar') {
        const p = await pedir(s.productos.get(l.idExistente));
        if (!p) continue;
        /* La existencia NO se toca: la manda el inventario vivo. */
        Object.assign(p, {
          nombre: l.nombre,
          categoriaId,
          tamano: l.tamano,
          costo: l.costo,
          par: l.par,
          puntoReorden: l.reorden,
        });
        await pedir(s.productos.put(p));
        actualizados += 1;
        continue;
      }

      const producto = {
        id: nuevoId('p'),
        nombre: l.nombre,
        categoriaId,
        tamano: l.tamano,
        existencia: l.existencia,
        par: l.par,
        puntoReorden: l.reorden,
        costo: l.costo,
        activo: true,
      };
      await pedir(s.productos.put(producto));
      creados += 1;

      if (l.existencia > 0) {
        await pedir(s.movimientos.put({
          id: nuevoId('m'),
          loteId,
          tipo: 'ajuste',
          productoId: producto.id,
          productoNombre: producto.nombre,
          categoriaId,
          delta: l.existencia,
          existenciaAntes: 0,
          existenciaDespues: l.existencia,
          restauranteId: null,
          empleadoId,
          empleadoNombre,
          costoUnitario: producto.costo || 0,
          motivo: 'Carga inicial de catálogo',
          autorizadoPor: null,
          negativoPermitido: false,
          fechaISO,
          diaOperativo: dia,
          revierteA: null,
        }));
        movimientos += 1;
      }
    }

    return {
      loteId, creados, actualizados, movimientos, categorias: plan.categoriasNuevas.length,
    };
  });
}

export {
  parsearCSV, interpretar, aplicar, nivelesDesdePedido, aNumero, mapearColumnas,
  SEMANAS_POR_MES, FACTOR_PAR, FACTOR_REORDEN,
};
