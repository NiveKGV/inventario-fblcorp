# Manual de uso — Inventario

Guía para operar el sistema. No hace falta saber nada de computadoras.
En la pantalla de inicio del iPad la app aparece como **Inventario**.

---

## 1. Instalarlo en el iPad

1. Abre **Safari** en el iPad y entra a la dirección del sistema.
2. Toca el botón de **Compartir** (el cuadrito con la flecha hacia arriba).
3. Toca **Añadir a pantalla de inicio** y luego **Añadir**.
4. Cierra Safari. De ahora en adelante se abre desde el icono de la botella.

**Importante:** hay que abrirlo siempre desde ese icono, **nunca desde Safari**.
No es solo comodidad: Safari borra los datos de un sitio que pasa siete días sin
usarse. Las apps añadidas a la pantalla de inicio están fuera de esa regla.
Si lo usan como pestaña de Safari, un fin de semana largo puede costarles el
inventario completo.

Esto no sustituye el respaldo (punto 8). Nada de lo que hace iOS por su cuenta
es una copia de seguridad que puedas dar por garantizada.

---

## 2. La primera vez

El sistema pide crear la cuenta de gerencia: un nombre y un **código de 5
dígitos**. Con ese código entras directo a Administración. No se comparte con el
personal de salón.

Si cargaste el catálogo de ejemplo, el sistema te muestra **una sola vez** los
códigos de los empleados de prueba. Anótalos en ese momento: después quedan
cifrados y no hay forma de volver a verlos.

Después, entra a **Administración → Empleados** y **crea un segundo gerente**.
Si solo una persona conoce el código, el día que no esté nadie puede recibir
mercancía ni sacar reportes.

---

## 3. Cómo saca botellas un empleado

1. Entra **su código de 5 dígitos**. Nada más. El sistema ya sabe quién es y de
   qué restaurante.
2. Busca el licor escribiendo el nombre, o escoge la **categoría** (Whisky, Ron,
   Vino…) y toca las botellas que se lleva.
3. Escoge la cantidad de cada una. Puede juntar varias en un solo viaje.
4. Toca **Confirmar salida**.

Listo. El inventario baja solo y queda registrado quién, de qué restaurante, qué
se llevó y a qué hora.

Si se equivocó, tiene **15 segundos** para tocar **Deshacer**. Después de eso lo
corrige el gerente desde el Historial.

**La sesión se cierra sola al minuto de no tocar nada.** Es a propósito: así
nadie saca botellas a nombre de otro.

### El buscador

En el panel hay una caja de búsqueda arriba. Escribiendo "patron" aparece Patrón
Silver aunque no se escriba la tilde; escribiendo "don julio" aparecen los dos;
escribiendo "ron" aparece la categoría completa y escribiendo "caja", las
cervezas. Para volver a las categorías, se toca **Limpiar** o cualquier categoría.

### Cambiar el código

El gerente asigna el primer código. Cada empleado debería cambiarlo por uno que
solo él conozca, desde **Cambiar mi código** en el panel. Hasta que lo haga, el
gerente conoce su código — dilo claro cuando entrenes al personal.

Dos personas **no pueden tener el mismo código**. El sistema no lo permite,
porque si dos lo compartieran le cargaría las botellas a la persona equivocada.

---

## 4. Los colores de las botellas

| Color | Qué significa |
|---|---|
| Verde | Hay suficiente |
| Amarillo | Va bajando, está por debajo de lo que debería haber |
| Rojo | Hay que ordenar ya |
| Gris | Agotado |

---

## 5. Cargar el catálogo desde Excel

Para montar el catálogo de golpe, o para añadir muchos productos de una vez, no
hay que entrarlos uno por uno.

1. Llena la plantilla de Excel: producto, categoría, tamaño, costo, existencia
   de hoy y **cuánto se pide en un mes típico** de cada uno.
2. En Excel: **Archivo → Guardar como → CSV**, parado en la hoja «Catálogo».
3. Guarda el archivo en iCloud Drive.
4. En el iPad: **Administración → Sistema → Importar catálogo**, escoge el
   archivo y toca **Revisar archivo**.
5. Sale una pantalla de revisión: cuántos productos entran, cuáles se
   actualizan, qué categorías se van a crear y qué filas tienen error.
   **Nada se guarda hasta que confirmes.**

Tres cosas que conviene saber:

- **No borra nada.** Un producto que no aparezca en el archivo se queda igual.
- **A los productos que ya existen no les cambia la existencia**, solo el costo,
  el tamaño y los niveles. La existencia la manda el inventario, no una hoja.
- **Los niveles par se calculan solos** con el pedido mensual. Si prefieres
  fijarlos a mano en algún producto, llena las columnas Par y Reorden y esas
  mandan.

---

## 6. Cuando llega la orden del proveedor

1. **Administración → Lista de compra.**
2. Ahí sale todo lo que hay que ordenar y cuánto, ya calculado.
3. Cuando llegue el pedido, escribe en la columna **Recibido** lo que de verdad
   entró (no lo que se pidió — lo que llegó).
4. Escribe el proveedor o el número de factura.
5. Toca **Registrar entrada al almacén**.

---

## 7. El conteo físico

Una vez por semana, para que el sistema no se despegue de la realidad:

1. **Administración → Conteo físico.**
2. Cuenta las botellas de verdad y escribe el número en la columna **Contado**.
3. Solo escribe donde haya diferencia. Lo que no toques, no se cambia.
4. Escribe el motivo (conteo semanal, rotura, merma) y toca **Registrar**.

La diferencia queda guardada con tu nombre. Nada se borra nunca.

---

## 8. El respaldo — lo más importante de este manual

**Todo vive dentro de ese iPad.** Si el iPad se pierde, se cae o alguien borra la
app, se va el inventario y el historial completo. No hay copia en ninguna nube.

**Asigna una persona y un día fijo de la semana:**

1. **Administración → Sistema → Respaldar ahora.**
2. El iPad pregunta dónde guardarlo: escoge **iCloud Drive** (o mándalo por
   correo).
3. Listo. Toma diez segundos.

Cuando pasan más de 7 días sin respaldo, aparece un aviso en Administración que
no se quita hasta que lo hagas. Está puesto a propósito.

Para recuperar todo en un iPad nuevo: **Sistema → Restaurar un respaldo**.

---

## 9. Los reportes

**Administración → Reportes.** Escoge el período y verás:

- Cuántas botellas se llevó **cada restaurante** y cuánto valen a costo. Esto
  sirve para repartir el costo del licor entre los cuatro locales.
- Cuánto sacó **cada empleado**.
- Cuáles fueron **los productos** que más salieron.

Todo se puede exportar a Excel con **Exportar CSV**.

**Administración → Historial** muestra **una fila por operación**: quién, cuándo
y para qué restaurante. Tocando la fila se abre el desglose de lo que se llevó.
El botón **Revertir** deshace la operación completa, no un producto suelto — por
eso está en la fila y no en cada renglón.

En **Resumen**, las tarjetas de arriba (agotados, hay que ordenar, bajo el par,
lo que salió hoy, valor del inventario) **se tocan** y muestran exactamente
cuáles son esos productos, sin tener que irse a otra pestaña.

---

## 10. Cosas que conviene saber

- **Un código de 5 dígitos dice quién fue, no impide que alguien use el de otro.**
  Si alguien ve el código de un compañero, puede usarlo. Que cada quien lo
  escriba tapando el teclado, como en el cajero.
- Después de 5 intentos fallidos, **el teclado se bloquea** un minuto, y el doble
  cada vez que vuelva a pasar, hasta cinco minutos. El bloqueo es del iPad, no de
  una persona: hasta que el código no acierta, el sistema no sabe quién está
  intentando. **Un código de gerencia entra igual y levanta el bloqueo**, para
  que un dedazo en pleno servicio no deje el almacén cerrado.
- Si un empleado intenta sacar más de lo que el sistema dice que hay, se detiene
  y pide autorización de un gerente. No es un error del sistema: es que el
  conteo no cuadra y hay que arreglarlo con un conteo físico.
- El **nivel par** es cuánto debe haber de cada licor. Ponlo pensando en cuánto
  tarda el proveedor: si tarda una semana, el par tiene que cubrir el consumo de
  los cuatro restaurantes durante esa semana, más un colchón. En el Inventario
  aparece el consumo promedio semanal real para que ese número no sea a ojo.
- Cuando des de baja a un empleado, todo lo que sacó se conserva en el historial.
