/* Cifrado de los códigos de acceso con PBKDF2-SHA256 (Web Crypto).

   Decisión de diseño que hay que entender antes de tocar esto:

   El sistema identifica a la persona SOLO por su código — no se escoge el
   nombre primero. Eso obliga a poder buscar "¿de quién es este código?" en el
   momento. Con una sal distinta por empleado habría que derivar el hash una vez
   por cada persona registrada: con 30 empleados serían 30 derivaciones, más de
   un segundo y medio de espera en cada entrada. Inaceptable en un almacén.

   Por eso la sal es una sola para toda la instalación, generada al configurar y
   guardada en la base. Así una derivación (unos 50 ms) alcanza para comparar
   contra todos los empleados.

   Qué se pierde con eso, dicho sin adornos: la sal por usuario evita que un
   atacante ataque todos los códigos a la vez. Con sal compartida, quien consiga
   un archivo de respaldo puede atacarlos en bloque. Pero con códigos de 5
   dígitos —100,000 combinaciones— ningún esquema de sal cambia el desenlace
   frente a alguien decidido. El cifrado aquí sirve para que el código no
   aparezca legible en la base ni en los respaldos, no para resistir un ataque
   serio. La defensa real es el registro auditable y el bloqueo por intentos.

   Efecto secundario útil: con sal compartida, dos códigos iguales producen el
   mismo hash. Eso permite detectar códigos repetidos de forma exacta, que es
   justamente lo que el sistema necesita impedir. */

const ITERACIONES = 210000;
const LARGO_SAL = 16;
const LARGO_CLAVE = 32;
const LARGO_CODIGO = 5;

function contextoSeguro() {
  return typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext;
}

function exigirContextoSeguro() {
  if (contextoSeguro()) return;
  throw new Error(
    'El navegador no permite cifrar en este contexto. La app debe abrirse por HTTPS '
    + '(o desde localhost durante pruebas). No se guardará ningún código sin cifrar.',
  );
}

function aBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function deBase64(texto) {
  const s = atob(texto);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function nuevaSal() {
  exigirContextoSeguro();
  return aBase64(crypto.getRandomValues(new Uint8Array(LARGO_SAL)));
}

/* Devuelve el hash del código. Mismo código y misma sal, mismo hash: así se
   detectan los repetidos y se puede identificar a la persona por el código. */
async function derivarCodigo(codigo, salBase64) {
  exigirContextoSeguro();
  if (!salBase64) throw new Error('Falta la sal de la instalación.');
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(codigo), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2', salt: deBase64(salBase64), iterations: ITERACIONES, hash: 'SHA-256',
    },
    material, LARGO_CLAVE * 8,
  );
  return aBase64(bits);
}

/* Comparación en tiempo constante para no filtrar información por la duración. */
function igualesConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/* Códigos que no se aceptan: repetidos, secuencias y los cuatro o cinco
   dígitos que todo el mundo escoge primero. */
function codigoDebil(codigo) {
  if (/^(\d)\1+$/.test(codigo)) return true;
  const ascendente = '0123456789';
  const descendente = '9876543210';
  if (ascendente.includes(codigo) || descendente.includes(codigo)) return true;
  return ['12345', '54321', '11111', '00000', '13579', '24680'].includes(codigo);
}

export {
  nuevaSal, derivarCodigo, igualesConstante, codigoDebil,
  contextoSeguro, LARGO_CODIGO, ITERACIONES,
};
