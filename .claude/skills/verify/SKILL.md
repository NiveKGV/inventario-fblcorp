---
name: verify
description: Cómo levantar y manejar esta app para verificar un cambio en ejecución. Úsala antes de dar por bueno cualquier cambio de esta carpeta.
---

# Verificar el almacén de licores

App web sin compilación ni dependencias. Se levanta y se maneja en el navegador.

## Levantarla

**No uses `.claude/launch.json`**: apunta a `python3 -m http.server`, que cachea
los módulos y te hace perseguir errores ya corregidos. Usa el servidor del
proyecto, que manda `Cache-Control: no-store`:

```bash
python3 herramientas/servidor-dev.py 8791
```

`http://localhost:8791/index.html`. En localhost **no se registra el service
worker** a propósito, así que la sección «Versión instalada» dirá siempre
«sin instalar»: eso es correcto ahí, no un fallo.

## Llegar a Administración

La app arranca en configuración inicial. Códigos obvios (`55555`, `12345`) los
rechaza por débiles; usa uno como `40721`.

```js
const n=document.querySelector('#cfg-nombre'), p=document.querySelector('#cfg-pin'), p2=document.querySelector('#cfg-pin2');
n.value='Ana Serrano'; p.value='40721'; p2.value='40721';
[n,p,p2].forEach(x=>x.dispatchEvent(new Event('input',{bubbles:true})));
[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Crear y empezar').click();
// después, en la pantalla de acceso:
for (const d of '40721') [...document.querySelectorAll('.tecla')].find(b=>b.textContent.trim()===d).click();
```

Para empezar de cero: `indexedDB.deleteDatabase('almacen_licores')` y recargar.

## Trampas del entorno (cuestan horas si no se saben)

- **`computer key` con `Return` llega con `key: ""`** y ningún manejador de
  teclado se dispara. Hay que escribir **`Enter`**. Con `Escape` y las letras
  no pasa. Si un atajo «no funciona», comprueba primero qué `key` llega:
  `document.addEventListener('keydown', e => console.log(e.key))`.
- **`computer left_click` no enfoca campos** aunque `elementFromPoint`
  confirme que el clic cae encima. Enfoca por código (`n.focus()`) y luego
  manda las pulsaciones reales con `computer type` / `computer key`: el evento
  llega con `isTrusted: true` igual.
- **`resize_window` a un alto mayor que la ventana real descuadra las
  capturas**: el DOM mide bien y la foto sale corrida. Comprueba
  `window.outerHeight` y no pidas más que eso, o mide con
  `getBoundingClientRect` en vez de fiarte de la captura.
- **`selectionStart` es `null` en `input[type=number]`** por especificación.
  Para comprobar que se seleccionó el contenido, espía
  `HTMLInputElement.prototype.select`.
- **`navigator.share` no existe** en este navegador, así que la rama de
  compartir de `descargar()` no se puede ejercitar. Se puede comprobar la
  ramificación con dobles, pero dilo como tal.

## Flujos que vale la pena manejar

- **Salida manual** (Administración → Salida manual): sin motivo debe frenar;
  con cantidad mayor que la existencia debe frenar sin tocar el inventario;
  al registrar, el Historial muestra las etiquetas «Salida» + «Desde gerencia».
- **Conteo físico**: Enter salta al próximo campo y el último suelta el foco.
  Con el buscador filtrando, salta solo entre los visibles.
- **Exportar CSV** (Reportes o Historial): para leer el contenido sin bajar el
  archivo, envuelve `URL.createObjectURL` y lee el blob.
- **Ojo con la madrugada**: entre medianoche y las 5:00 a.m. el día operativo
  es el día anterior. Un movimiento recién hecho no aparece en «Hoy». Cualquier
  consulta por fecha se hace con `diaOperativo`, nunca con `fechaPR`.

## Las pruebas

`pruebas.html` corre en el navegador contra una base aparte. Sirve para
regresiones, **no** como verificación de que un cambio funciona: para eso hay
que manejar la app.
