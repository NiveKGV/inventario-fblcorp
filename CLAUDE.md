# Almacén de Licores

## Las tres preguntas

1. **¿Qué problema resuelve?** Saber quién se llevó qué botella, de qué almacén,
   para qué restaurante y a qué hora — y avisar cuándo hay que reordenar.
2. **¿Quién lo usa?** El personal de cuatro restaurantes (La Madre, La O,
   La Grieta, El Más Allá) que baja al almacén central a buscar licor, y la
   gerencia que administra el catálogo, recibe la mercancía y saca reportes.
3. **¿Primera cosa visible?** Un empleado escoge su restaurante, su nombre, entra
   su PIN, toca tres botellas y confirma: el inventario baja y queda el registro.
   Eso funciona hoy.

## Modelo de datos (lo que hay que entender antes de tocar nada)

Existe **un solo inventario**: el del almacén central. El restaurante **no** es
un inventario aparte — es el destino de cada salida. Por eso el reporte de
consumo por restaurante sirve como reparto de costos entre locales.

Cada movimiento guarda un `delta` con el signo ya aplicado al almacén:

| Tipo | delta | Restaurante | Para qué |
|---|---|---|---|
| `salida` | negativo | sí | Un empleado se lleva botellas |
| `entrada` | positivo | no | Llegó la orden del proveedor |
| `devolucion` | positivo | sí | Un restaurante regresa una botella sin abrir |
| `ajuste` | cualquiera | no | Conteo físico: el sistema se iguala a la realidad |
| `reversion` | espejo | hereda el del original | Corrección de un movimiento anterior |

**Consumo de un restaurante = suma de `-delta` de sus movimientos.** Con esa
convención, devoluciones y reversiones se descuentan solas y no hacen falta
casos especiales en los reportes.

**El store `movimientos` es append-only.** `DB.borrar('movimientos', …)` lanza
error a propósito. Un error se corrige creando una reversión, nunca borrando.
Si algún día alguien "optimiza" eso, el historial deja de servir como evidencia.

## Estructura

```
index.html          Todas las pantallas del empleado y el contenedor de admin
pruebas.html        60 pruebas del modelo. Abrir en el navegador; no hay runner
css/estilos.css     Todo el estilo. Sin framework
js/db.js            IndexedDB: esquema, transacciones, exportar e importar
js/cripto.js        PBKDF2 para los PIN
js/datos.js         Los 4 restaurantes, las categorías y el catálogo de ejemplo
js/modelo.js        Reglas de negocio: movimientos, existencias, reportes
js/ui.js            Pantallas, modal, avisos flotantes, formato, descargas
js/app.js           Arranque, sesión, flujo del empleado
js/admin.js         Área de gerencia
sw.js               Service worker (red primero, respaldo en caché)
herramientas/       Generador de iconos. Solo se corre si cambia el icono
```

## Comandos

Servidor local para desarrollo y pruebas (hace falta un contexto seguro:
`localhost` cuenta, `file://` no):

```bash
python3 -m http.server 8787 --directory /Users/kaioken/almacen-licores
```

- App: <http://localhost:8787/index.html>
- Pruebas: <http://localhost:8787/pruebas.html> — deben decir "Ninguna falló"

Regenerar iconos (solo si cambia el diseño del icono):

```bash
python3 herramientas/generar-iconos.py
```

## Decisiones y sus porqués

- **JavaScript nativo, cero dependencias, sin compilación.** El cliente no tiene
  quien mantenga esto. Sin `npm install` no hay nada que se pudra ni versiones
  que actualizar. Se abre el archivo y funciona.
- **IndexedDB y no localStorage.** Hacen falta transacciones atómicas: un lote de
  salida tiene que entrar completo o no entrar. localStorage no da eso.
- **PWA instalada en la pantalla de inicio, no una pestaña.** Abre a pantalla
  completa, funciona sin internet, y el almacenamiento de una app instalada no
  está sujeto a las mismas políticas de expiración que una web en Safari.
  *Pendiente de confirmar contra la documentación de Apple; el diseño no depende
  de esa respuesta porque el respaldo manual va igual.*
- **Red primero en el service worker.** Con caché primero, subir una corrección
  no la aplicaba: el iPad seguía abriendo la versión vieja. Pasó durante el
  desarrollo, y también contaminó la base de datos real con datos de prueba.
- **PBKDF2 con 210.000 iteraciones.** Medido: 50 ms por verificación. Un PIN de
  4 dígitos nunca es una contraseña fuerte; esto solo evita que aparezca legible
  en la base o en un respaldo.
- **`--acento` es identidad, `--accion` es acción.** El color del restaurante
  pinta la barra y la insignia; el botón de confirmar es siempre verde. Si
  tomara el color del local, en La Grieta saldría rojo y se leería como borrar.
- **Día operativo desde las 5:00 a.m.** Un bar cierra a las 2. Con día calendario,
  un turno se parte en dos fechas y los reportes no cuadran con la realidad.
- **Cierre de sesión a los 60 segundos.** Sin eso, el registro de auditoría no
  vale nada: las botellas del siguiente quedarían a nombre del anterior.
- **Nombre de base parametrizable** (`globalThis.__ALMACEN_DB_PRUEBAS__`): existe
  solo para que `pruebas.html` no toque el inventario real. La página verifica el
  nombre y se niega a correr si apunta a la base de producción.

## Después

Fuera de alcance en esta versión, viable más adelante (todo esto implica servidor
y costo mensual, menos lo último):

- Sincronización entre varios iPads y vista consolidada en tiempo real.
- Respaldo automático sin intervención humana.
- Órdenes de compra enviadas por correo al proveedor.
- Lectura de códigos de barra con la cámara del iPad.
- Integración con el POS de los restaurantes.
- Sugerencia automática del nivel par a partir del consumo y el plazo de entrega
  (el dato de consumo semanal ya se calcula y se muestra; falta proponerlo).
