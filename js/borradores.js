/* Borradores: lo que alguien dejó a medias y todavía no se registró.

   Por qué existe: un conteo de ciento treinta botellas y una salida de seis
   licores viven solo en la pantalla mientras se llenan. Bastaba con que el
   gerente se fuera a mirar otra pestaña, que el empleado saliera a contestar un
   mensaje, o que pasaran los dos minutos de inactividad, para que media hora de
   trabajo desapareciera sin aviso. Pasó en el almacén, con el conteo a medias.

   Lo que NO es: esto no guarda la sesión. Al volver hay que entrar el código
   igual — eso no se toca, es lo que sostiene el registro. Lo que se recupera es
   lo escrito, no el permiso.

   Se guardan en `config`, junto al resto de la configuración del aparato, y no
   en el historial: un borrador no es un movimiento. Nada de esto suma ni resta
   existencia hasta que alguien toca Registrar.

   Caducan al terminar el día operativo. Un conteo de ayer retomado hoy compara
   contra existencias que ya cambiaron, y seguir con él haría más daño que
   volver a empezar. */

import { DB } from './db.js';
import { diaOperativoActual } from './modelo.js';

async function guardarBorrador(clave, datos) {
  const dia = await diaOperativoActual();
  await DB.escribirConfig(clave, { ...datos, dia, fechaISO: new Date().toISOString() });
}

/* Devuelve el borrador solo si es del día operativo de hoy. Si es viejo, lo
   borra al pasar: así no se acumulan restos de semanas anteriores. */
async function leerBorrador(clave) {
  const b = await DB.leerConfig(clave, null);
  if (!b) return null;
  const dia = await diaOperativoActual();
  if (b.dia !== dia) { await DB.escribirConfig(clave, null); return null; }
  return b;
}

async function borrarBorrador(clave) {
  await DB.escribirConfig(clave, null);
}

/* Guardar en cada tecla escribiría en la base decenas de veces por producto.
   Se espera a que la persona pare de escribir. */
function conEspera(fn, ms = 600) {
  let reloj = null;
  return (...args) => {
    clearTimeout(reloj);
    reloj = setTimeout(() => fn(...args), ms);
  };
}

const CLAVE_CONTEO = 'borrador_conteo';
const claveCarrito = (empleadoId) => `borrador_carrito_${empleadoId}`;

export { guardarBorrador, leerBorrador, borrarBorrador, conEspera, CLAVE_CONTEO, claveCarrito };
