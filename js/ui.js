/* Utilidades de interfaz: pantallas, modal, avisos flotantes y formato.
   Sin dependencias externas: la app tiene que abrir en un iPad sin internet
   y seguir funcionando dentro de tres años sin que nadie la mantenga. */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

function el(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'clase') nodo.className = v;
    else if (k === 'texto') nodo.textContent = v;
    // Las propiedades personalizadas (--c, --acento) no se pueden asignar con
    // Object.assign sobre style: hay que pasar por setProperty.
    else if (k === 'estilo') {
      for (const [prop, valor] of Object.entries(v)) {
        if (prop.startsWith('--')) nodo.style.setProperty(prop, valor);
        else nodo.style[prop] = valor;
      }
    }
    else if (k === 'datos') for (const [dk, dv] of Object.entries(v)) nodo.dataset[dk] = dv;
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) nodo.setAttribute(k, '');
    else if (v !== false && v != null) nodo.setAttribute(k, v);
  }
  /* Qué dice la tecla de retorno del iPad. En un campo de cantidad, "Siguiente"
     —Enter salta al próximo, y `activarComportamientoDeCampos` lo corrige a
     "Listo" si resulta ser el último de la lista—. En el buscador, "Listo",
     porque ahí Enter solo cierra el teclado. Se escribe al construir el campo
     para no depender de un evento. Las contraseñas y los códigos de acceso
     quedan fuera: ahí Enter tiene una acción propia. */
  if (etiqueta === 'input' && props.enterkeyhint == null) {
    if (props.type === 'number') nodo.setAttribute('enterkeyhint', 'next');
    else if (props.type === 'search') nodo.setAttribute('enterkeyhint', 'done');
  }

  for (const h of [].concat(hijos)) {
    if (h == null || h === false) continue;
    nodo.append(typeof h === 'string' || typeof h === 'number' ? String(h) : h);
  }
  return nodo;
}

function mostrarPantalla(id) {
  $$('.pantalla').forEach((p) => p.classList.toggle('activa', p.id === `pantalla-${id}`));
  const cuerpo = $(`#pantalla-${id} .cuerpo`) || $(`#pantalla-${id} .rejilla-productos`);
  if (cuerpo) cuerpo.scrollTop = 0;
}

function pantallaActual() {
  const activa = $('.pantalla.activa');
  return activa ? activa.id.replace('pantalla-', '') : null;
}

/* --- Modal --- */

let cerrarModalActual = null;

function abrirModal({
  titulo, subtitulo = '', contenido, botones = [], ancho = false, alCerrar = null,
}) {
  $('#modal-titulo').textContent = titulo;
  const sub = $('#modal-sub');
  sub.textContent = subtitulo;
  sub.hidden = !subtitulo;
  const cuerpo = $('#modal-cuerpo');
  cuerpo.replaceChildren();
  if (contenido) cuerpo.append(contenido);
  const pie = $('#modal-pie');
  pie.replaceChildren(...botones.map((b) => el('button', {
    clase: `btn ${b.clase || 'btn-fantasma'}`,
    texto: b.texto,
    onclick: b.accion,
    id: b.id || false,
  })));
  pie.hidden = !botones.length;
  $('#modal').classList.toggle('ancho', ancho);
  $('#velo').classList.add('abierto');
  cuerpo.scrollTop = 0;
  cerrarModalActual = alCerrar;
  return cerrarModal;
}

function cerrarModal() {
  $('#velo').classList.remove('abierto');
  if (cerrarModalActual) { const f = cerrarModalActual; cerrarModalActual = null; f(); }
}

function modalAbierto() { return $('#velo').classList.contains('abierto'); }

function confirmar({ titulo, mensaje, textoSi = 'Confirmar', peligro = false }) {
  return new Promise((resolve) => {
    abrirModal({
      titulo,
      contenido: el('p', { texto: mensaje, estilo: { margin: '0', fontSize: '16px', lineHeight: '1.55' } }),
      botones: [
        { texto: 'Cancelar', accion: () => { cerrarModal(); resolve(false); } },
        {
          texto: textoSi,
          clase: peligro ? 'btn-peligro' : 'btn-primario',
          accion: () => { cerrarModal(); resolve(true); },
        },
      ],
    });
  });
}

/* --- Aviso flotante (con deshacer opcional) --- */

let temporizadorBrindis = null;
let intervaloBrindis = null;

function ocultarBrindis() {
  clearTimeout(temporizadorBrindis);
  clearInterval(intervaloBrindis);
  $('#brindis').classList.remove('visible');
}

function brindis({
  texto, sub = '', tipo = '', segundos = 4, accion = null,
}) {
  clearTimeout(temporizadorBrindis);
  clearInterval(intervaloBrindis);
  const caja = $('#brindis');
  caja.className = `brindis visible ${tipo}`;
  $('#brindis-texto').textContent = texto;
  $('#brindis-sub').textContent = sub;
  const boton = $('#brindis-accion');
  if (accion) {
    boton.hidden = false;
    let restan = segundos;
    boton.textContent = `${accion.texto} (${restan})`;
    boton.onclick = () => { ocultarBrindis(); accion.fn(); };
    intervaloBrindis = setInterval(() => {
      restan -= 1;
      if (restan <= 0) { clearInterval(intervaloBrindis); return; }
      boton.textContent = `${accion.texto} (${restan})`;
    }, 1000);
  } else {
    boton.hidden = true;
    boton.onclick = null;
  }
  temporizadorBrindis = setTimeout(ocultarBrindis, segundos * 1000);
}

/* --- Formato --- */

const fmtDinero = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const dinero = (n) => fmtDinero.format(Number(n) || 0);
const numero = (n) => new Intl.NumberFormat('es-PR').format(Number(n) || 0);

/* Quita acentos y baja a minúsculas para que el buscador encuentre "Patrón"
   escribiendo "patron", que es como lo va a escribir alguien apurado. */
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/* Entrega un archivo al iPad para guardarlo en Archivos, mandarlo por correo o
   pasarlo a otro aparato.

   Por qué no basta con un enlace de descarga: en iOS, un `<a download>` saca al
   usuario de la app para abrir el archivo en otra vista. Al volver, iOS relanza
   la app desde cero y muestra su pantalla de arranque —blanca— antes de que
   nada nuestro pueda pintar. No hay CSS que arregle eso, porque ocurre fuera de
   la página. Lo que sí se puede es no hacer el viaje.

   `navigator.share` presenta la hoja de compartir ENCIMA de la app, sin
   sacarla de memoria: no hay relanzamiento y por lo tanto no hay fogonazo. Se
   cae al enlace de siempre si el navegador no la trae o no acepta archivos, que
   es lo que pasa en el escritorio. */
async function descargar(nombreArchivo, contenido, tipo = 'application/json') {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });

  try {
    const archivo = new File([blob], nombreArchivo, { type: `${tipo};charset=utf-8` });
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: nombreArchivo });
      return;
    }
  } catch (e) {
    // Cancelar la hoja de compartir lanza AbortError. Es una decisión del
    // usuario, no un fallo: no se cae al enlace, porque eso le entregaría el
    // archivo justo después de que dijo que no.
    if (e && e.name === 'AbortError') return;
    // Cualquier otro fallo (permiso, gesto expirado) sigue al camino de abajo.
  }

  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function aCSV(filas) {
  const escapar = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${filas.map((f) => f.map(escapar).join(',')).join('\r\n')}`;
}

/* --- Comportamiento de los campos de escritura en el iPad --- */

const SELECTOR_INTERACTIVO = 'input, select, textarea, button, label, a, [contenteditable], .admin-tab';

function esCampoDeTexto(n) {
  return n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement;
}

/* Tres arreglos a un mismo problema: escribir una cantidad en el iPad y no
   poder salir del campo.

   1. Tocar afuera no soltaba el cursor. No es falta de sensibilidad de la
      pantalla: Safari en iOS **no genera un evento de clic** cuando se toca
      una zona que no es interactiva, así que el navegador nunca se enteraba
      del toque y el campo no perdía el foco. Había que tocar dos veces, o
      atinarle justo a otro control. `pointerdown` sí llega siempre, y en fase
      de captura llega antes que nada. Los toques sobre algo interactivo se
      dejan pasar intactos: soltar el foco ahí mueve el teclado a mitad del
      gesto y el toque termina cayendo en el elemento equivocado.

   2. Enter obligaba a seleccionar el próximo campo a mano. Ahora recorre el
      formulario entero —nombre, categoría, tamaño, cantidades— y no solo las
      columnas de números, que era como estaba al principio: en la pantalla de
      añadir un producto los primeros encasillados se quedaban fuera y había
      que tocar cada uno. En el último campo del grupo ya no hay a dónde
      saltar y se cierra el teclado. La tecla lo dice: "Siguiente" mientras
      queden campos, "Listo" en el último.

   3. Corregir un número obligaba a borrar dígito por dígito. Al entrar a un
      campo numérico se selecciona lo que ya está escrito, así que teclear lo
      reemplaza. */
function activarComportamientoDeCampos() {
  document.addEventListener('pointerdown', (ev) => {
    const activo = document.activeElement;
    if (!esCampoDeTexto(activo)) return;
    const destino = ev.target instanceof Element ? ev.target.closest(SELECTOR_INTERACTIVO) : null;
    if (destino) return;
    activo.blur();
  }, true);

  document.addEventListener('focusin', (ev) => {
    const n = ev.target;
    if (!esCampoNavegable(n)) return;
    n.setAttribute('enterkeyhint', siguienteCampo(n) ? 'next' : 'done');
    if (n instanceof HTMLInputElement && n.type === 'number') {
      // select() en el mismo turno lo pisa el propio gesto del toque en iOS.
      setTimeout(() => { if (document.activeElement === n) n.select(); }, 0);
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter') return;
    const n = ev.target;
    if (!esCampoNavegable(n)) return;

    const siguiente = siguienteCampo(n);
    // Sin esto el iPad interpreta el Enter además como envío y recarga.
    ev.preventDefault();
    if (!siguiente) { n.blur(); return; }
    siguiente.focus();
    if (siguiente instanceof HTMLInputElement && siguiente.type === 'number') siguiente.select();
    // `focus()` ya lo trae a la vista, pero con el teclado ocupando media
    // pantalla el campo puede quedar justo debajo del borde.
    siguiente.scrollIntoView({ block: 'nearest' });
  });
}

/* Qué cuenta como campo del formulario para el recorrido con Enter.

   Los de archivo quedan fuera: abren el selector del sistema, y aterrizar ahí
   con Enter sacaría al usuario de la app sin que lo pidiera. */
const CAMPOS = 'input:not([type="file"]), select, textarea';

function esCampoNavegable(n) {
  return (n instanceof HTMLInputElement && n.type !== 'file')
    || n instanceof HTMLSelectElement
    || n instanceof HTMLTextAreaElement;
}

/* El próximo campo en el orden en que se ven en pantalla, dentro del mismo
   grupo.

   El grupo importa: sin acotarlo, Enter en el último campo de un modal saltaría
   a un control de la pantalla que hay detrás, que ni siquiera se está mirando.
   Se busca el modal primero porque cuando hay uno abierto es lo único con lo
   que se puede interactuar.

   Se descartan los ocultos porque las tablas se filtran con el buscador: saltar
   a un campo que no está a la vista deja a la persona escribiendo a ciegas. */
function siguienteCampo(actual) {
  const grupo = actual.closest('#modal, .modal, #admin-cuerpo, .pantalla.activa') || document;
  const campos = [...grupo.querySelectorAll(CAMPOS)]
    .filter((c) => !c.disabled && !c.readOnly && c.offsetParent !== null);
  const i = campos.indexOf(actual);
  return i >= 0 && i < campos.length - 1 ? campos[i + 1] : null;
}

export {
  $, $$, el, mostrarPantalla, pantallaActual,
  abrirModal, cerrarModal, modalAbierto, confirmar,
  brindis, ocultarBrindis,
  dinero, numero, normalizar, descargar, aCSV,
  activarComportamientoDeCampos,
};
