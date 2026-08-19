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

/* --- Cifrado del archivo de respaldo --- */

/* Por qué existe: el respaldo lleva los nombres del personal, el historial
   completo y los códigos cifrados de todos. Con la sal compartida, un solo
   recorrido de las 100.000 combinaciones de 5 dígitos los rompe todos a la vez
   —medido, 37 minutos en una laptop normal—. Quien consiga ese archivo sabe el
   código de cada empleado, y con eso saca botellas a nombre de otro: justo lo
   que este sistema existe para impedir. Cifrarlo hace que el archivo no valga
   nada sin la frase.

   Más iteraciones que en los códigos de acceso (210.000) porque los papeles se
   invierten: un código se comprueba en cada entrada al almacén y la espera la
   paga una persona de pie; una frase de respaldo se escribe una vez por semana
   y el que va a pagar la espera es quien intente romperla sin conocerla.

   AES-GCM y no AES-CBC: GCM autentica además de cifrar, así que un archivo
   manipulado falla al abrirse en vez de descifrar basura silenciosamente. Sal e
   IV nuevos en cada respaldo: repetir un IV con la misma clave rompe GCM. */
const ITER_RESPALDO = 310000;

async function claveDeRespaldo(frase, sal, uso) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(frase), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2', salt: sal, iterations: ITER_RESPALDO, hash: 'SHA-256',
    },
    material, { name: 'AES-GCM', length: 256 }, false, [uso],
  );
}

/* El sobre guarda cómo se cifró, no solo lo cifrado: si algún día cambian las
   iteraciones o el algoritmo, los archivos viejos se siguen abriendo porque
   traen sus propios parámetros. Un respaldo que solo se pueda abrir con la
   versión de la app que lo generó no es un respaldo. */
async function cifrarRespaldo(texto, frase, pista = '') {
  exigirContextoSeguro();
  const sal = crypto.getRandomValues(new Uint8Array(LARGO_SAL));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clave = await claveDeRespaldo(frase, sal, 'encrypt');
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, clave, new TextEncoder().encode(texto),
  );
  return {
    formato: 'almacen-licores/respaldo-cifrado',
    version: 1,
    generado: new Date().toISOString(),
    // La pista viaja SIN cifrar, que es lo único que la hace útil el día que
    // nadie recuerda la frase. Por eso no debe contener la frase.
    pista,
    cifrado: {
      algoritmo: 'AES-GCM',
      kdf: 'PBKDF2-SHA256',
      iteraciones: ITER_RESPALDO,
      sal: aBase64(sal),
      iv: aBase64(iv),
    },
    datos: aBase64(cifrado),
  };
}

async function descifrarRespaldo(sobre, frase) {
  exigirContextoSeguro();
  if (!esRespaldoCifrado(sobre)) throw new Error('El archivo no es un respaldo cifrado de este sistema.');
  const { sal, iv, iteraciones } = sobre.cifrado;
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(frase), 'PBKDF2', false, ['deriveKey'],
  );
  const clave = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2', salt: deBase64(sal), iterations: iteraciones || ITER_RESPALDO, hash: 'SHA-256',
    },
    material, { name: 'AES-GCM', length: 256 }, false, ['decrypt'],
  );
  let plano;
  try {
    plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: deBase64(iv) }, clave, deBase64(sobre.datos),
    );
  } catch {
    /* AES-GCM no distingue «frase equivocada» de «archivo alterado»: en los dos
       casos falla la verificación. Se dicen las dos posibilidades en vez de
       adivinar una, porque mandar a alguien a buscar otra frase cuando lo que
       tiene es un archivo corrupto le hace perder la tarde. */
    throw new Error('La frase no abre este archivo. Puede estar mal escrita, o el archivo puede estar dañado.');
  }
  return new TextDecoder().decode(plano);
}

function esRespaldoCifrado(obj) {
  return !!obj && obj.formato === 'almacen-licores/respaldo-cifrado'
    && !!obj.cifrado && typeof obj.datos === 'string';
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
  cifrarRespaldo, descifrarRespaldo, esRespaldoCifrado,
};
