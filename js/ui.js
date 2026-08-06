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

function iniciales(nombre) {
  const partes = String(nombre).trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes[1]?.[0] || '')).toUpperCase();
}

/* Descarga un archivo. En iPad esto abre la hoja de compartir para guardarlo en
   Archivos o iCloud Drive: es el único camino que iOS permite a una app web. */
function descargar(nombreArchivo, contenido, tipo = 'application/json') {
  const blob = new Blob([contenido], { type: `${tipo};charset=utf-8` });
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

export {
  $, $$, el, mostrarPantalla, pantallaActual,
  abrirModal, cerrarModal, modalAbierto, confirmar,
  brindis, ocultarBrindis,
  dinero, numero, iniciales, descargar, aCSV,
};
