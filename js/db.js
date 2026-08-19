/* Capa de acceso a IndexedDB.
   Todo vive en el iPad. Ningún dato sale del dispositivo.
   Regla dura: el store `movimientos` es append-only. Nunca se edita ni se borra
   un movimiento; los errores se corrigen con un movimiento de reversión. */

/* El nombre solo se puede cambiar desde pruebas.html, que define la variable
   antes de importar. En la app real siempre es 'almacen_licores': así las
   pruebas nunca tocan el inventario de verdad. */
const DB_NOMBRE = globalThis.__ALMACEN_DB_PRUEBAS__ || 'almacen_licores';
const DB_VERSION = 1;

let _db = null;

const STORES = {
  config: { keyPath: 'clave' },
  restaurantes: { keyPath: 'id' },
  empleados: { keyPath: 'id', indices: [['porRestaurante', 'restauranteId']] },
  categorias: { keyPath: 'id' },
  productos: { keyPath: 'id', indices: [['porCategoria', 'categoriaId']] },
  movimientos: {
    keyPath: 'id',
    indices: [
      ['porFecha', 'fechaISO'],
      ['porDiaOperativo', 'diaOperativo'],
      ['porProducto', 'productoId'],
      ['porRestaurante', 'restauranteId'],
      ['porEmpleado', 'empleadoId'],
      ['porLote', 'loteId'],
      // Los movimientos normales llevan revierteA en null, que no es una clave
      // válida en IndexedDB: el índice solo contiene reversiones.
      ['porRevierteA', 'revierteA'],
    ],
  },
  respaldos: { keyPath: 'id' },
};

function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NOMBRE, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = ev.target.result;
      for (const [nombre, def] of Object.entries(STORES)) {
        if (db.objectStoreNames.contains(nombre)) continue;
        const store = db.createObjectStore(nombre, { keyPath: def.keyPath });
        for (const [idx, campo] of def.indices || []) {
          store.createIndex(idx, campo, { unique: false });
        }
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      _db.onversionchange = () => { _db.close(); _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Base de datos bloqueada por otra pestaña abierta.'));
  });
}

function tx(stores, modo, fn) {
  return abrir().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(stores, modo);
    let resultado;
    t.oncomplete = () => resolve(resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transacción cancelada'));
    const acceso = {};
    for (const s of stores) acceso[s] = t.objectStore(s);
    Promise.resolve(fn(acceso, t)).then((r) => { resultado = r; }).catch((e) => {
      try { t.abort(); } catch (_) { /* ya abortada */ }
      reject(e);
    });
  }));
}

function pedir(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* --- Operaciones genéricas --- */

const DB = {
  abrir,
  tx,
  pedir,

  todos(store) {
    return tx([store], 'readonly', (s) => pedir(s[store].getAll()));
  },

  obtener(store, id) {
    return tx([store], 'readonly', (s) => pedir(s[store].get(id)));
  },

  guardar(store, objeto) {
    return tx([store], 'readwrite', (s) => pedir(s[store].put(objeto)).then(() => objeto));
  },

  guardarVarios(store, objetos) {
    return tx([store], 'readwrite', async (s) => {
      for (const o of objetos) await pedir(s[store].put(o));
      return objetos.length;
    });
  },

  borrar(store, id) {
    if (store === 'movimientos') {
      return Promise.reject(new Error('Los movimientos no se pueden borrar. Usa una reversión.'));
    }
    return tx([store], 'readwrite', (s) => pedir(s[store].delete(id)));
  },

  vaciar(store) {
    return tx([store], 'readwrite', (s) => pedir(s[store].clear()));
  },

  porIndice(store, indice, valor) {
    return tx([store], 'readonly', (s) => pedir(s[store].index(indice).getAll(valor)));
  },

  /* Rango de movimientos por día operativo, ambos extremos incluidos (YYYY-MM-DD). */
  movimientosEntre(desde, hasta) {
    return tx(['movimientos'], 'readonly', (s) =>
      pedir(s.movimientos.index('porDiaOperativo').getAll(IDBKeyRange.bound(desde, hasta))));
  },

  /* --- Config (clave/valor) --- */

  async leerConfig(clave, porDefecto = null) {
    const fila = await DB.obtener('config', clave);
    return fila === undefined || fila === null ? porDefecto : fila.valor;
  },

  escribirConfig(clave, valor) {
    return DB.guardar('config', { clave, valor });
  },

  /* --- Exportación e importación completa --- */

  async exportarTodo() {
    const nombres = Object.keys(STORES).filter((n) => n !== 'respaldos');
    const datos = {};
    for (const n of nombres) datos[n] = await DB.todos(n);
    return {
      formato: 'almacen-licores/respaldo',
      version: DB_VERSION,
      generado: new Date().toISOString(),
      datos,
    };
  },

  /* Reemplaza el contenido a partir de un respaldo — con una excepción que es
     la razón de ser de este sistema.

     El historial NO se reemplaza: solo se le añade. Antes se vaciaba como
     todo lo demás, y eso abría el único camino para borrar evidencia sin
     dejar rastro: el archivo de respaldo es JSON legible, así que bastaba con
     exportarlo, quitarle a mano la línea de una salida incómoda, cuadrar la
     existencia del producto y restaurar. La salida desaparecía y el inventario
     cuadraba solo. Probado: de tres movimientos quedaban dos, sin reversión ni
     nota de ningún tipo.

     `DB.borrar` ya se niega a borrar movimientos por esa misma razón; esta
     función la estaba saltando por detrás. Con el `put` sin `clear`, restaurar
     en un iPad nuevo funciona igual —la base está vacía— y lo único que deja
     de poder hacerse es quitar movimientos.

     Devuelve cuántos movimientos había antes y después, para que quien
     restaura quede registrado y la diferencia se pueda ver. */
  async importarTodo(paquete) {
    if (!paquete || paquete.formato !== 'almacen-licores/respaldo') {
      throw new Error('El archivo no es un respaldo válido de este sistema.');
    }
    const nombres = Object.keys(paquete.datos || {}).filter((n) => n in STORES);
    if (!nombres.length) throw new Error('El respaldo no contiene datos reconocibles.');
    if (!nombres.includes('movimientos')) nombres.push('movimientos');

    const antes = (await DB.todos('movimientos')).length;

    await tx(nombres, 'readwrite', async (s) => {
      for (const n of nombres) {
        const filas = paquete.datos[n] || [];
        if (n !== 'movimientos') await pedir(s[n].clear());
        for (const fila of filas) await pedir(s[n].put(fila));
      }
    });

    const despues = (await DB.todos('movimientos')).length;
    return { stores: nombres.length, movimientosAntes: antes, movimientosDespues: despues };
  },
};

/* Identificadores ordenables por tiempo: los movimientos quedan en orden
   cronológico natural al recorrerlos por clave. */
function nuevoId(prefijo = '') {
  const t = Date.now().toString(36).padStart(9, '0');
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(6)))
    .map((b) => b.toString(36).padStart(2, '0')).join('');
  return `${prefijo}${t}${azar}`;
}

export {
  DB, nuevoId, pedir, DB_VERSION, DB_NOMBRE,
};
