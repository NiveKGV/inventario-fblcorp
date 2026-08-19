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

Esto no sustituye el respaldo (punto 9). Nada de lo que hace iOS por su cuenta
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

---

## 5. Cargar el catálogo desde Excel

Para montar el catálogo de golpe, o para añadir muchos productos de una vez, no
hay que entrarlos uno por uno.

1. Llena la plantilla de Excel: producto, categoría, tamaño, costo, existencia
   de hoy y **cuánto se pide en un mes típico** de cada uno. Con ese último
   dato el sistema calcula solo el máximo y el mínimo.
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
- **El máximo y el mínimo se calculan solos** con el pedido mensual. Si
  prefieres fijarlos a mano en algún producto, llena las columnas Máximo y
  Mínimo y esas mandan.

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

## 9. El respaldo — lo más importante de este manual

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

## 10. Los reportes

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

En **Resumen**, las tarjetas de arriba (agotados, hay que ordenar, bajo el máximo,
lo que salió hoy, valor del inventario) **se tocan** y muestran exactamente
cuáles son esos productos, sin tener que irse a otra pestaña.

---

## 11. Cosas que conviene saber

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


## El respaldo cifrado

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
