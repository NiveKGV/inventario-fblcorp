/* Datos iniciales: los cuatro restaurantes, las categorías y un catálogo de
   ejemplo con marcas de uso común. Todo es editable desde Administración.
   Los empleados de ejemplo se crean sin PIN: cada persona lo define la primera
   vez que entra, con el gerente presente. */

import { DB, nuevoId } from './db.js';
import { codigoDebil, LARGO_CODIGO } from './cripto.js';

const RESTAURANTES = [
  { id: 'la-madre', nombre: 'La Madre', color: '#e0a34a', orden: 1, activo: true },
  { id: 'la-o', nombre: 'La O', color: '#3fa9a0', orden: 2, activo: true },
  { id: 'la-grieta', nombre: 'La Grieta', color: '#d2543f', orden: 3, activo: true },
  { id: 'el-mas-alla', nombre: 'El Más Allá', color: '#8a72d6', orden: 4, activo: true },
];

const CATEGORIAS = [
  { id: 'whisky', nombre: 'Whisky', color: '#c98c3c', orden: 1, activa: true },
  { id: 'vodka', nombre: 'Vodka', color: '#5aa9d6', orden: 2, activa: true },
  { id: 'ron', nombre: 'Ron', color: '#b5703c', orden: 3, activa: true },
  { id: 'tequila', nombre: 'Tequila', color: '#8fae4a', orden: 4, activa: true },
  { id: 'mezcal', nombre: 'Mezcal', color: '#6f8f3a', orden: 5, activa: true },
  { id: 'ginebra', nombre: 'Ginebra', color: '#4fb3a2', orden: 6, activa: true },
  { id: 'vino-tinto', nombre: 'Vino tinto', color: '#a33f52', orden: 7, activa: true },
  { id: 'vino-blanco', nombre: 'Vino blanco', color: '#c4b264', orden: 8, activa: true },
  { id: 'espumoso', nombre: 'Espumoso', color: '#c9a227', orden: 9, activa: true },
  { id: 'licores', nombre: 'Cordiales y licores', color: '#a06bbd', orden: 10, activa: true },
  { id: 'cerveza', nombre: 'Cerveza', color: '#7e9b3e', orden: 11, activa: true },
  { id: 'otros', nombre: 'Otros', color: '#7a8290', orden: 12, activa: true },
];

/* [nombre, categoría, tamaño, existencia, par, punto de reorden, costo]
   Las existencias imitan un almacén real: la mayoría en nivel y unos diez
   productos bajo el par, para que la lista de compra se vea funcionando desde
   el primer minuto. */
const CATALOGO = [
  ["Jack Daniel's Old No. 7", 'whisky', '750 ml', 15, 12, 6, 24.00],
  ["Buchanan's DeLuxe 12", 'whisky', '750 ml', 22, 18, 9, 38.00],
  ['Johnnie Walker Black Label', 'whisky', '750 ml', 14, 12, 6, 34.00],
  ['Chivas Regal 12', 'whisky', '750 ml', 11, 10, 5, 32.00],
  ['Jameson Irish Whiskey', 'whisky', '750 ml', 12, 10, 5, 26.00],
  ["Maker's Mark", 'whisky', '750 ml', 9, 8, 4, 29.00],
  ['Woodford Reserve', 'whisky', '750 ml', 4, 6, 3, 36.00],
  ['Macallan 12 Double Cask', 'whisky', '750 ml', 5, 4, 2, 68.00],

  ['Absolut', 'vodka', '750 ml', 16, 14, 7, 19.00],
  ['Grey Goose', 'vodka', '750 ml', 13, 12, 6, 33.00],
  ["Tito's Handmade", 'vodka', '750 ml', 15, 14, 7, 22.00],
  ['Ketel One', 'vodka', '750 ml', 8, 8, 4, 27.00],
  ['Stolichnaya', 'vodka', '750 ml', 2, 6, 3, 21.00],

  ['Don Q Cristal', 'ron', '750 ml', 26, 20, 10, 13.00],
  ['Don Q Añejo', 'ron', '750 ml', 13, 12, 6, 16.00],
  ['Bacardí Superior', 'ron', '750 ml', 16, 14, 7, 14.00],
  ['Ron del Barrilito 3 Estrellas', 'ron', '750 ml', 10, 10, 5, 42.00],
  ['Captain Morgan Spiced', 'ron', '750 ml', 11, 10, 5, 18.00],
  ['Zacapa 23', 'ron', '750 ml', 5, 5, 2, 52.00],

  ['Don Julio Blanco', 'tequila', '750 ml', 13, 12, 6, 46.00],
  ['Don Julio 1942', 'tequila', '750 ml', 4, 4, 2, 145.00],
  ['Patrón Silver', 'tequila', '750 ml', 11, 10, 5, 44.00],
  ['Casamigos Blanco', 'tequila', '750 ml', 8, 8, 4, 47.00],
  ['Tres Santos', 'tequila', '750 ml', 9, 8, 4, 39.00],
  ['Herradura Reposado', 'tequila', '750 ml', 3, 6, 3, 42.00],
  ['Del Maguey Vida Mezcal', 'mezcal', '750 ml', 5, 5, 2, 38.00],

  ['Bombay Sapphire', 'ginebra', '750 ml', 12, 10, 5, 24.00],
  ["Hendrick's", 'ginebra', '750 ml', 9, 8, 4, 36.00],
  ['Tanqueray London Dry', 'ginebra', '750 ml', 10, 10, 5, 23.00],
  ['Gin Mare', 'ginebra', '750 ml', 4, 4, 2, 44.00],

  ['Catena Malbec', 'vino-tinto', '750 ml', 26, 24, 12, 15.00],
  ['Marqués de Cáceres Rioja Crianza', 'vino-tinto', '750 ml', 18, 18, 9, 14.00],
  ['Josh Cellars Cabernet Sauvignon', 'vino-tinto', '750 ml', 21, 24, 12, 12.00],
  ['Meiomi Pinot Noir', 'vino-tinto', '750 ml', 19, 18, 9, 17.00],

  ['Kim Crawford Sauvignon Blanc', 'vino-blanco', '750 ml', 25, 24, 12, 13.00],
  ['La Crema Chardonnay', 'vino-blanco', '750 ml', 16, 18, 9, 18.00],
  ['Martín Códax Albariño', 'vino-blanco', '750 ml', 12, 12, 6, 16.00],
  ['Santa Margherita Pinot Grigio', 'vino-blanco', '750 ml', 19, 18, 9, 22.00],

  ['Veuve Clicquot Brut', 'espumoso', '750 ml', 12, 12, 6, 48.00],
  ['Moët & Chandon Impérial', 'espumoso', '750 ml', 9, 12, 6, 45.00],
  ['La Marca Prosecco', 'espumoso', '750 ml', 28, 24, 12, 13.00],
  ['Freixenet Cordon Negro Cava', 'espumoso', '750 ml', 18, 18, 9, 11.00],
  ['Dom Pérignon', 'espumoso', '750 ml', 3, 3, 1, 195.00],

  ['Aperol', 'licores', '750 ml', 11, 10, 5, 22.00],
  ['Campari', 'licores', '750 ml', 8, 8, 4, 25.00],
  ['Cointreau', 'licores', '750 ml', 10, 10, 5, 34.00],
  ['Baileys Irish Cream', 'licores', '750 ml', 5, 8, 4, 24.00],
  ['Disaronno Amaretto', 'licores', '750 ml', 6, 6, 3, 27.00],
  ['Kahlúa', 'licores', '750 ml', 9, 8, 4, 21.00],
  ['St-Germain', 'licores', '750 ml', 6, 6, 3, 38.00],
  ['Licor 43', 'licores', '750 ml', 0, 6, 3, 26.00],

  ['Medalla Light', 'cerveza', 'caja 24', 22, 20, 10, 26.00],
  ['Corona Extra', 'cerveza', 'caja 24', 14, 14, 7, 32.00],
  ['Heineken', 'cerveza', 'caja 24', 8, 12, 6, 33.00],
  ['Modelo Especial', 'cerveza', 'caja 24', 12, 12, 6, 31.00],

  ['Angostura Aromatic Bitters', 'otros', '200 ml', 6, 6, 3, 12.00],
  ['Martini Rosso Vermut', 'otros', '750 ml', 6, 6, 3, 14.00],
  ['Dolin Dry Vermut', 'otros', '750 ml', 2, 6, 3, 16.00],
];

/* Los empleados de prueba ya NO traen su código escrito aquí.

   Antes eran ocho códigos fijos escritos en claro aquí mismo, dentro de un
   repositorio público. La pantalla de instalación trae «Cargar catálogo de
   ejemplo» marcado por omisión, así que en cualquier instalación donde nadie
   los desactivara, quien encontrara el repositorio tenía ocho códigos válidos y
   solo le faltaba un minuto a solas con el iPad.

   Ahora se sortean al instalar y se enseñan una sola vez, como los de verdad.

   OJO con los iPads ya configurados: este cambio solo afecta a instalaciones
   NUEVAS. Un aparato que cargó los ejemplos antes conserva los códigos viejos,
   que siguen publicados en el historial de git y no se pueden despublicar. En
   esos hay que borrar los datos de ejemplo desde Administración → Sistema. */
const EMPLEADOS_EJEMPLO = [
  ['Carlos Vázquez', 'la-madre'],
  ['María Rivera', 'la-madre'],
  ['José Colón', 'la-o'],
  ['Ana Rosado', 'la-o'],
  ['Luis Ortiz', 'la-grieta'],
  ['Sofía Delgado', 'la-grieta'],
  ['Pedro Santiago', 'el-mas-alla'],
  ['Gabriela Nieves', 'el-mas-alla'],
];

function productosIniciales() {
  return CATALOGO.map(([nombre, categoriaId, tamano, existencia, par, puntoReorden, costo], i) => ({
    id: nuevoId('p'),
    nombre,
    categoriaId,
    tamano,
    existencia,
    par,
    puntoReorden,
    costo,
    orden: i,
    activo: true,
    ejemplo: true,
    creado: new Date().toISOString(),
  }));
}

/* Un código de 5 dígitos sorteado con el generador criptográfico del navegador,
   no con Math.random: este código es lo único que separa a una persona de las
   botellas de otra, y Math.random es predecible.

   Se rechazan los débiles con la misma regla que los códigos reales —repetidos,
   secuencias, los de siempre— para que un empleado de prueba no acabe con un
   código más fácil de adivinar que el del personal. */
function codigoSorteado(yaUsados) {
  for (let intento = 0; intento < 500; intento++) {
    const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100000;
    const codigo = String(n).padStart(LARGO_CODIGO, '0');
    if (!codigoDebil(codigo) && !yaUsados.has(codigo)) { yaUsados.add(codigo); return codigo; }
  }
  throw new Error('No se pudo generar un código de ejemplo distinto.');
}

/* Devuelve los empleados con `codigoVisible` en claro. Quien llame a esta
   función tiene que cifrarlo y quitar ese campo antes de guardar.

   Los códigos se sortean en cada instalación: son distintos entre sí porque el
   sistema identifica a la persona solo por el código, y dos iguales le
   cargarían las botellas a la equivocada. */
function empleadosEjemplo() {
  const usados = new Set();
  return EMPLEADOS_EJEMPLO.map(([nombre, restauranteId]) => ({
    id: nuevoId('e'),
    nombre,
    restauranteId,
    rol: 'empleado',
    codigo: null,
    codigoVisible: codigoSorteado(usados),
    activo: true,
    ejemplo: true,
    creado: new Date().toISOString(),
  }));
}

/* Pone al día las categorías de un aparato que ya estaba instalado.

   Las categorías se siembran UNA sola vez, al configurar el sistema. Actualizar
   la app no las toca, así que separar «Tequila y Mezcal» en el código no
   cambiaba nada en un iPad ya configurado: seguía mostrando la categoría vieja
   y no había forma de arreglarlo salvo reinstalar y perder el inventario. Lo
   mismo pasaría con cualquier categoría que se añada más adelante.

   Vive acá, y no en el arranque, porque hay dos momentos en que hace falta:
   al abrir la app y **después de restaurar un respaldo**. Restaurar reemplaza
   el store de categorías con las del archivo, así que un respaldo viejo revivía
   la categoría fusionada hasta que alguien cerrara y volviera a abrir la app,
   sin ninguna señal de que hiciera falta reiniciar.

   Qué hace y qué NO hace, porque acá se toca data que ya existe:
   - Añade las categorías del código que falten en el aparato.
   - Corrige el nombre y el orden de las que el código conoce, para que un
     rótulo viejo no sobreviva a un cambio.
   - No borra ni desactiva nada. Si el cliente creó sus propias categorías, o
     desactivó alguna de las nuestras, eso se respeta: `activa` no se toca.
   - Los productos guardan `categoriaId`, no el nombre, así que renombrar no
     desconecta ningún producto de su categoría. */
async function alinearCategorias() {
  const enAparato = await DB.todos('categorias');
  const porId = new Map(enAparato.map((c) => [c.id, c]));
  const aGuardar = [];

  for (const patron of CATEGORIAS) {
    const actual = porId.get(patron.id);
    if (!actual) {
      aGuardar.push({ ...patron });
    } else if (actual.nombre !== patron.nombre || actual.orden !== patron.orden) {
      aGuardar.push({ ...actual, nombre: patron.nombre, orden: patron.orden });
    }
  }

  if (aGuardar.length) await DB.guardarVarios('categorias', aGuardar);
  return aGuardar.length + await reubicarMezcales();
}

/* Mueve a Mezcal los productos que se quedaron bajo Tequila cuando las dos eran
   una sola categoría. Separar las categorías sin mover los productos deja el
   trabajo a medias: los mezcales seguirían archivados en Tequila.

   Corre UNA sola vez y deja constancia en `config`. Al principio se evaluaba en
   cada apertura, y eso deshacía en silencio el trabajo de la gerencia: si
   alguien movía un mezcal a Tequila a propósito desde el modal de producto —una
   acción que la interfaz ofrece—, al reabrir la app estaba de vuelta en Mezcal,
   sin aviso y sin forma de que el cambio se quedara. Una migración corrige el
   pasado; no puede seguir mandando sobre las decisiones de después.

   Solo mueve los que llevan «mezcal» en el nombre. No es adivinar: mezcal y
   tequila son denominaciones de origen distintas por ley, así que un tequila no
   puede llamarse mezcal. */
async function reubicarMezcales() {
  if (await DB.leerConfig('mezcales_reubicados', false)) return 0;

  const mezcal = await DB.obtener('categorias', 'mezcal');
  // `activa` importa: una categoría desactivada no sale en las tiras del panel,
  // así que mover productos ahí los haría desaparecer para el empleado, que
  // solo podría alcanzarlos escribiendo el nombre en el buscador.
  if (!mezcal || !mezcal.activa) return 0;

  const mal = (await DB.todos('productos'))
    .filter((p) => p.categoriaId === 'tequila' && /mezcal/i.test(p.nombre));
  if (mal.length) {
    await DB.guardarVarios('productos', mal.map((p) => ({ ...p, categoriaId: 'mezcal' })));
  }
  await DB.escribirConfig('mezcales_reubicados', true);
  return mal.length;
}

export {
  RESTAURANTES, CATEGORIAS, productosIniciales, empleadosEjemplo, alinearCategorias,
};
