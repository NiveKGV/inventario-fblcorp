/* Cifrado de PINs con PBKDF2-SHA256 (Web Crypto).

   Honestidad sobre el alcance de esto: un PIN de 4 dígitos tiene 10,000
   combinaciones. Ningún cifrado convierte eso en una contraseña fuerte.
   Lo que sí logra PBKDF2 con 210,000 iteraciones es que probar las 10,000
   combinaciones contra un respaldo robado tome tiempo real de cómputo en vez
   de ser instantáneo, y que el PIN nunca aparezca legible ni en la base de
   datos ni en los archivos de respaldo.

   La defensa práctica contra alguien que vio el PIN de otro no es criptográfica:
   es el registro auditable y el bloqueo tras intentos fallidos. */

const ITERACIONES = 210000;
const LARGO_SAL = 16;
const LARGO_CLAVE = 32;

function contextoSeguro() {
  return typeof crypto !== 'undefined' && crypto.subtle && window.isSecureContext;
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

async function derivar(pin, salBytes) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salBytes, iterations: ITERACIONES, hash: 'SHA-256' },
    material, LARGO_CLAVE * 8,
  );
  return aBase64(bits);
}

/* Devuelve { sal, hash, iteraciones } listo para guardar. */
async function cifrarPin(pin) {
  if (!contextoSeguro()) {
    throw new Error(
      'El navegador no permite cifrar en este contexto. La app debe abrirse por HTTPS '
      + '(o desde localhost durante pruebas). No se guardará ningún PIN sin cifrar.',
    );
  }
  const sal = crypto.getRandomValues(new Uint8Array(LARGO_SAL));
  const hash = await derivar(pin, sal);
  return { sal: aBase64(sal), hash, iteraciones: ITERACIONES };
}

/* Comparación en tiempo constante para no filtrar información por la duración. */
function igualesConstante(a, b) {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

async function verificarPin(pin, guardado) {
  if (!guardado || !guardado.sal || !guardado.hash) return false;
  if (!contextoSeguro()) throw new Error('Contexto no seguro: no se puede verificar el PIN.');
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: deBase64(guardado.sal),
      iterations: guardado.iteraciones || ITERACIONES,
      hash: 'SHA-256',
    },
    material, LARGO_CLAVE * 8,
  );
  return igualesConstante(aBase64(bits), guardado.hash);
}

export { cifrarPin, verificarPin, contextoSeguro };
