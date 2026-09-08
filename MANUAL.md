# Manual de uso — Inventario

Guía para operar el sistema. No hace falta saber nada de computadoras.
En la pantalla de inicio del iPad la app aparece como **Inventario**.

---

## 1. Instalarlo en el iPad

1. Abre **Safari** en el iPad y entra a **inventario-fabula.netlify.app**
2. Toca el botón de **Compartir** (el cuadrito con la flecha hacia arriba).
3. Toca **Añadir a pantalla de inicio** y luego **Añadir**.
4. Cierra Safari. De ahora en adelante se abre desde el icono de la botella.

**Importante:** hay que abrirlo siempre desde ese icono, **nunca desde Safari**.
No es solo comodidad: Safari borra los datos de un sitio que pasa siete días sin
usarse. Las apps añadidas a la pantalla de inicio están fuera de esa regla.
Si lo usan como pestaña de Safari, un fin de semana largo puede costarles el
inventario completo.

Esto no sustituye el respaldo (punto 10). Nada de lo que hace iOS por su cuenta
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
4. Toca **Confirmar salida**. Sale una pantalla con la lista de lo que se
   lleva, su nombre y su restaurante. **Ahí se revisa antes de registrar.** Si
   algo está mal, toca **Revisar** y vuelve al panel a corregirlo.
5. Toca **Sí, registrar**.

Listo. El inventario baja solo y queda registrado quién, de qué restaurante, qué
se llevó y a qué hora.

**Una vez registrado, el empleado no lo puede deshacer.** Si se equivocó, lo
corrige un gerente desde el Historial con el botón **Revertir**. Por eso la
pantalla de confirmación muestra la lista completa: es el momento de mirarla.

**La sesión se cierra sola a los tres minutos de no tocar nada.** Es a propósito:
así nadie saca botellas a nombre de otro.

### El buscador

En el panel hay una caja de búsqueda arriba. Escribiendo "patron" aparece Patrón
Silver aunque no se escriba la tilde; escribiendo "don julio" aparecen los dos;
escribiendo "ron" aparece la categoría completa y escribiendo "caja", las
cervezas. Para volver a las categorías, se toca **Limpiar** o cualquier categoría.

### Quien trabaja en más de una barra

Hay gente que cubre dos locales. A esa persona **se le marcan sus dos barras**
cuando se le crea la cuenta (Administración → Empleados), y al entrar su código
el sistema le pregunta **a cuál de las suyas** le carga lo que se lleva. Solo
salen las suyas, nunca las cuatro.

Al que trabaja en un solo local **no se le pregunta nada**: su código lo lleva
directo, como siempre. Esa es la garantía del sistema y no se toca por
comodidad de unos pocos.

En el Historial, esas salidas llevan la etiqueta **«Barra escogida»**. No es
una sospecha —es cómo funciona para quien cubre dos—, pero quien cuadre los
números tiene derecho a saber que ahí alguien decidió, en vez de haberlo
determinado el código.

**No le crees dos cuentas a la misma persona.** Serían dos códigos que
recordar, y en los reportes aparecería partida en dos: nadie podría ver cuánto
sacó Luis, solo cuánto sacaron sus dos mitades.

### Los códigos los maneja la gerencia

**El empleado no puede cambiar su propio código.** Los asigna y los cambia un
gerente, desde **Administración → Empleados**.

Eso tiene una consecuencia que conviene decir en voz alta al entrenar al
personal: **la gerencia conoce el código de cada quien.** El sistema registra
con certeza desde qué código salió cada botella, pero no puede probar que quien
lo tecleó fue su dueño. Sirve para saber a quién preguntarle, no para acusar a
nadie por sí solo.

Si alguien sospecha que otro sabe su código, se le pide al gerente que lo
cambie. Toma diez segundos.

Dos personas **no pueden tener el mismo código**. El sistema no lo permite,
porque si dos lo compartieran le cargaría las botellas a la persona equivocada.

---

## 4. Los colores de las botellas

| Color | Qué significa |
|---|---|
| Verde | Hay suficiente |
| Amarillo | Va bajando: está por debajo del **máximo** |
| Rojo | Llegó al **mínimo**. Hay que ordenar ya |
| Gris | Agotado |

### Los licores que no se reponen por nivel

Hay licores que no se piden de forma regular: los raros, los de un evento, los
que se compran cuando alguien los pide. A esos **se les deja el máximo y el
mínimo vacíos**, y el sistema los trata distinto:

- **No entran en la lista de compra** ni avisan cuando se acaban. Que no haya
  ninguna no es un problema que resolver, es lo normal en ellos.
- En Administración aparecen con la etiqueta **«Sin tope»**, en gris.
- **En el panel del empleado sí se ven en gris cuando no queda ninguna.** Eso no
  es una alerta: es para que quien está frente al estante no toque una botella
  que no está.

En el Resumen hay una tarjeta, **«sin tope definido»**, que los lista. Sirve para
sentarse con calma y ponerle niveles a los que sí los necesiten.

---

## 5. Cargar el catálogo desde Excel

Para montar el catálogo de golpe, o para añadir muchos productos de una vez, no
hay que entrarlos uno por uno.

1. Llena la plantilla de Excel: producto, categoría, tamaño, costo, existencia
   de hoy y **cuánto se pide en un mes típico** de cada uno. Con ese último
   dato el sistema calcula solo el máximo y el mínimo.
2. Guárdala como CSV, **parado en la hoja «Catálogo»**. En Excel es
   *Archivo → Guardar como → CSV*; en Numbers, *Archivo → Exportar a → CSV*,
   que crea una carpeta con un archivo por hoja: se usa el que dice «Catálogo».
   Si se sube por error la hoja de instrucciones, el sistema lo dice y no carga
   nada.
3. Pasa el archivo al iPad: iCloud Drive, AirDrop o correo. Este archivo solo
   tiene nombres de licores, así que no hay problema en mandarlo por correo —
   a diferencia del respaldo, que no debe salir por ahí.
4. En el iPad: **Administración → Sistema → Importar catálogo**, escoge el
   archivo y toca **Revisar archivo**.
5. Sale una pantalla de revisión: cuántos productos entran, cuáles se
   actualizan, qué categorías se van a crear y qué filas tienen error.
   **Nada se guarda hasta que confirmes.**

Tres cosas que conviene saber:

- **No borra nada.** Un producto que no aparezca en el archivo se queda igual.
- **A los productos que ya existen no les cambia la existencia**, solo el costo,
  el tamaño y los niveles. La existencia la manda el inventario, no una hoja.
- **El máximo y el mínimo se calculan solos** con el pedido mensual. Si
  prefieres fijarlos a mano en algún producto, llena las columnas Máximo y
  Mínimo y esas mandan.
- **Las categorías que no existan se crean.** La pantalla de revisión las lista
  antes de guardar nada. Si una es un error de escritura de otra que ya existe,
  se cancela y se corrige en el archivo — si no, quedan dos categorías que son
  la misma cosa.

### Añadir un producto suelto

Para uno o dos no hace falta archivo: **Inventario → Agregar producto**. Si el
licor es de una categoría que todavía no existe, en el menú de categorías se
escoge **la opción de escribir una nueva** y se pone el nombre ahí mismo, sin
salir de la pantalla.

El **máximo** y el **mínimo** vienen con un número puesto para que el producto
entre listo para trabajar. Si el licor no se repone por nivel, **borra los dos y
déjalos vacíos**: queda «sin tope» y no vuelve a avisar (punto 4).

---

## 6. Cuando llega la orden del proveedor

1. **Administración → Lista de compra.**
2. Ahí sale todo lo que hay que ordenar y cuánto, ya calculado.
3. Cuando llegue el pedido, escribe en la columna **Recibido** lo que de verdad
   entró (no lo que se pidió — lo que llegó).
4. **Si llegó algo que no estaba en la lista** —una caja de más, un producto
   nuevo, algo para un evento— búscalo en el encasillado de arriba y añádelo.
   Se puede recibir cualquier producto, esté bajo el máximo o no.
5. Escribe el proveedor o el número de factura.
6. Toca **Registrar entrada al almacén**.

Aunque no haya nada bajo el máximo, la pantalla deja recibir igual.

---

## 7. El conteo físico

Una vez por semana, para que el sistema no se despegue de la realidad:

1. **Administración → Conteo físico.**
2. Cuenta las botellas de verdad y escribe el número en la columna **Contado**.
   Cuenta antes de abrir y no en medio del servicio, y ve por estante y no
   siguiendo la lista: siguiendo la lista se salta lo que no está donde debería.
3. Solo escribe donde haya diferencia. Lo que no toques, no se cambia.
4. Escribe el motivo (conteo semanal, rotura, merma) y toca **Registrar**.

La diferencia queda guardada con tu nombre. Nada se borra nunca.

**Para ir más rápido:** después de escribir una cantidad, la tecla **intro** del
teclado salta sola al próximo producto, sin tener que tocar la pantalla. Si
estás filtrando con el buscador, salta solo entre los que se ven.

**Si ese día entró mercancía**, aparece una columna **«Entró hoy»** con lo que
llegó de cada producto. Está para evitar el susto de siempre: se cuentan 12,
el sistema dice 8, y alguien se pasa media hora buscando un descuadre que no
existe porque entraron 4 esa mañana.

---

## 8. Cuando el licor lo baja la gerencia

Tu código de gerencia te lleva directo a Administración, no al panel de salidas.
Así que si eres tú quien baja una caja a uno de los restaurantes, no puedes
registrarla como lo hace un empleado.

**No uses el conteo físico para eso.** El conteo iguala el almacén a la realidad,
pero no le carga esas botellas a ningún restaurante: desaparecen del almacén sin
aparecer en el consumo de nadie, y el reparto de costos entre los cuatro locales
te queda corto ese mes.

Usa **Administración → Salida manual**:

1. Escoge el restaurante que se lleva el licor.
2. Escribe el motivo. Es obligatorio.
3. Busca los productos y pon las cantidades.
4. Revisa la lista en la confirmación y toca **Sí, registrar**.

Descuenta del almacén y se lo carga a ese restaurante, igual que una salida
normal. En el Historial y en los reportes queda con la etiqueta **«Desde
gerencia»**, para que se distinga de las que registra el personal con su código:
en el panel del empleado nadie escoge el restaurante —el código lo determina—,
y acá sí. Quien revise los números después tiene derecho a saber cuál es cuál.

Si el sistema dice que no hay suficiente, **no insistas por aquí**. Quiere decir
que el conteo del sistema está mal: corrígelo en Conteo físico y vuelve.

---

## 9. Cuando un restaurante devuelve una botella

Pasa seguido: bajaron una caja para un evento que se canceló, o pidieron de más
y devuelven lo que quedó sin abrir.

**Administración → Devoluciones:**

1. Escoge el **restaurante que devuelve**.
2. Escribe el **motivo** (botella sin abrir, pedido cancelado…). Es obligatorio.
3. Busca los productos y pon cuántos devuelven en la columna **Devuelven**.
4. Revisa y registra.

La botella vuelve al almacén **y se le descuenta del consumo a ese restaurante**.
Eso es lo que hace la diferencia con un conteo físico: si lo metes como conteo,
la botella reaparece en el almacén pero el local se queda cargado con un licor
que nunca se tomó, y el reparto de costos del mes le sale caro sin razón.

Regla simple: **si sabes de qué local viene, es una devolución.** El conteo
físico es para cuando el número no cuadra y no sabes por qué.

---

## 10. El respaldo — lo más importante de este manual

**Todo vive dentro de ese iPad.** Si el iPad se pierde, se cae o alguien borra la
app, se va el inventario y el historial completo. No hay copia en ninguna nube.

**Asigna una persona y un día fijo de la semana:**

1. **Administración → Sistema → Respaldar ahora.**
2. El sistema pregunta si quieren **cifrar el archivo**. Digan que sí y escriban
   la frase (el punto 13 explica esto en detalle).
3. El iPad pregunta dónde guardarlo. Escoge **Guardar en Archivos → iCloud
   Drive**, o pásalo a una computadora.
4. Listo. Toma menos de un minuto.

> **El respaldo no se manda por correo.** Ese archivo lleva los nombres de todo
> el personal, el historial completo y los códigos de todos. Un correo pasa por
> demasiadas manos y se queda guardado para siempre en dos buzones. Si tiene que
> salir del iPad, que sea a una carpeta que ustedes controlen — y cifrado.

Cuando pasan más de 7 días sin respaldo, aparece un aviso en Administración que
no se quita hasta que lo hagas. Está puesto a propósito.

Para recuperar todo en un iPad nuevo: **Sistema → Restaurar un respaldo**.

### El respaldo no es lo mismo que el historial en Excel

En esa misma pantalla hay un botón que dice **Exportar historial completo en
CSV**. Son dos cosas distintas y conviene no confundirlas:

| | Para qué sirve |
|---|---|
| **Respaldar ahora** | La copia de seguridad. Es lo único que devuelve el sistema si el iPad se pierde o se rompe. |
| **Exportar historial completo en CSV** | Una hoja de cálculo para leer, imprimir o dársela al contable. **No sirve para restaurar nada.** |

Si alguien piensa que exportando el CSV está protegido, no lo está. El día del
problema ese archivo no devuelve el inventario.

---

## 11. Los reportes

**Administración → Reportes.** Escoge el período y verás:

- Cuántas botellas se llevó **cada restaurante** y cuánto valen a costo. Esto
  sirve para repartir el costo del licor entre los cuatro locales.
- Cuánto sacó **cada empleado**.
- Cuáles fueron **los productos** que más salieron.
- **Lo que entró al almacén**: qué se recibió, cuántas botellas, cuánto costó,
  en cuántas órdenes llegó y cuándo fue la última. Es lo que contesta *"¿qué y
  cuánto le pedimos al proveedor este mes?"* sin ir leyendo el historial.

En el **Resumen** aparece **«Lo que más sale»** con los cinco licores de más
movimiento en los últimos 30 días, y al lado cuántos entraron en esos mismos
días. Salieron 40 y entraron 12 es la conversación que hay que tener con el
proveedor, y separadas en dos pantallas esa resta no la hace nadie.

Todo se puede exportar a Excel con **Exportar CSV**.

**Administración → Historial** muestra **una fila por operación**: quién, cuándo
y para qué restaurante. Tocando la fila se abre el desglose de lo que se llevó.
El botón **Revertir** deshace la operación completa, no un producto suelto — por
eso está en la fila y no en cada renglón.

En **Resumen**, las tarjetas de arriba (agotados, hay que ordenar, bajo el máximo,
lo que salió hoy, valor del inventario) **se tocan** y muestran exactamente
cuáles son esos productos, sin tener que irse a otra pestaña.

---

## 12. Cosas que conviene saber

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
- Cada licor tiene dos números. El **máximo** es cuánto debe haber con el
  almacén completo, y es hasta donde repone la lista de compra. El **mínimo** es
  el número al que hay que pedir ya, y es cuando el producto se pone en rojo. El
  inventario baja del máximo todo el tiempo: eso es normal, y es justamente lo
  que arma la lista de compra. Pon el máximo pensando en cuánto tarda el
  proveedor: si tarda una semana, tiene que cubrir el consumo de los cuatro
  restaurantes durante esa semana más un colchón. En el Inventario aparece el
  consumo promedio semanal real para que ese número no sea a ojo.
- Cuando des de baja a un empleado, todo lo que sacó se conserva en el historial.


---

## 13. El respaldo cifrado, en detalle

Al tocar **Respaldar ahora** el sistema pregunta si quieren cifrar el archivo.

**Cifrado (recomendado).** Se escribe una frase, se repite, y el archivo queda
inservible para quien no la sepa. El archivo lleva los nombres del personal, el
historial completo y los códigos de todos: cifrarlo es lo que evita que sirva
de algo si termina en el correo de alguien o en una cuenta ajena.

**Sin cifrar.** El archivo se abre con cualquier programa. Solo tiene sentido si
va a un sitio que ustedes controlan y no sale de ahí.

### Lo que hay que entender antes de escoger

**Si pierden la frase, el respaldo no se recupera. Nunca.** Aquí no hay servidor
que la guarde ni forma de restablecerla, y no existe nadie —tampoco quien
programó esto— que pueda abrir ese archivo sin ella.

Por eso:

- La frase se escribe **dos veces**. Un dedazo no se nota hasta el día que hace
  falta el respaldo, que es el peor día para descubrirlo.
- Se puede guardar una **pista**, que viaja sin cifrar dentro del archivo y
  aparece cuando se va a restaurar. La pista no debe ser la frase.
- **Anoten la frase donde se anotan las cosas del negocio**, no solo en la
  cabeza de una persona. Si esa persona no está el día del problema, el respaldo
  tampoco.
- Usen **la misma frase siempre**. Una frase distinta cada semana es una lista
  de frases que recordar, y ahí es donde se pierden.

Al generar un respaldo cifrado, el sistema lo abre él mismo para comprobarlo
antes de entregárselo. Si algo hubiera salido mal, se enteran en ese momento y
no el día del desastre.

### Restaurar

Se escoge el archivo igual que siempre. Si está cifrado, el sistema pide la
frase y muestra la pista si el archivo trae una. Con la frase equivocada no pasa
nada: avisa y el iPad se queda como estaba.

Los respaldos hechos antes de que existiera el cifrado se siguen abriendo sin
pedir nada.
