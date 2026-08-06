/* Datos iniciales: los cuatro restaurantes, las categorías y un catálogo de
   ejemplo con marcas de uso común. Todo es editable desde Administración.
   Los empleados de ejemplo se crean sin PIN: cada persona lo define la primera
   vez que entra, con el gerente presente. */

import { nuevoId } from './db.js';

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
  { id: 'tequila', nombre: 'Tequila y Mezcal', color: '#8fae4a', orden: 4, activa: true },
  { id: 'ginebra', nombre: 'Ginebra', color: '#4fb3a2', orden: 5, activa: true },
  { id: 'vino-tinto', nombre: 'Vino tinto', color: '#a33f52', orden: 6, activa: true },
  { id: 'vino-blanco', nombre: 'Vino blanco', color: '#c4b264', orden: 7, activa: true },
  { id: 'espumoso', nombre: 'Espumoso', color: '#c9a227', orden: 8, activa: true },
  { id: 'licores', nombre: 'Cordiales y licores', color: '#a06bbd', orden: 9, activa: true },
  { id: 'cerveza', nombre: 'Cerveza', color: '#7e9b3e', orden: 10, activa: true },
  { id: 'otros', nombre: 'Otros', color: '#7a8290', orden: 11, activa: true },
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
  ['Del Maguey Vida Mezcal', 'tequila', '750 ml', 5, 5, 2, 38.00],

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

function empleadosEjemplo() {
  return EMPLEADOS_EJEMPLO.map(([nombre, restauranteId]) => ({
    id: nuevoId('e'),
    nombre,
    restauranteId,
    rol: 'empleado',
    pin: null,
    activo: true,
    ejemplo: true,
    intentosFallidos: 0,
    bloqueadoHasta: null,
    creado: new Date().toISOString(),
  }));
}

export {
  RESTAURANTES, CATEGORIAS, productosIniciales, empleadosEjemplo,
};
