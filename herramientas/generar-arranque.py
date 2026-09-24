#!/usr/bin/env python3
"""Genera las imagenes de arranque de iOS, sin dependencias externas.

Que resuelve: al abrir una app instalada en la pantalla de inicio, iOS ensena
un rectangulo BLANCO mientras arranca el navegador por debajo. En una app
oscura, usada en un almacen con poca luz, eso es un fogonazo, y en un iPad
lento dura lo suficiente para que parezca que algo va mal. Con estas imagenes
iOS pinta el fondo de la app con su icono en vez del blanco.

iOS escoge la imagen por el tamano exacto del aparato y la orientacion, asi que
hay una de cada. La que no cuadre no se usa; si ninguna cuadra, vuelve el
blanco de siempre: ningun dano, solo el fogonazo.

Uso:  python3 herramientas/generar-arranque.py

Los PNG quedan versionados en el repositorio: no hace falta correr esto para
instalar ni para usar la app, solo si cambia el icono o aparece un iPad nuevo.
"""
import importlib.util
import struct
import zlib
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "iconos"

# El mismo fondo que pinta la app en su primer cuadro (index.html y estilos.css).
FONDO = (0x12, 0x13, 0x17)

# Tamanos en puntos CSS de los iPad que se ven hoy, todos con densidad 2.
# (ancho, alto) en vertical; de ahi salen las dos orientaciones.
IPADS = [
    (1024, 1366),  # iPad Pro 12.9
    (834, 1194),   # iPad Pro 11
    (820, 1180),   # iPad Air 10.9 / 11
    (810, 1080),   # iPad 10.2 / 10.9
    (768, 1024),   # iPad 9.7 y iPad mini viejos
    (744, 1133),   # iPad mini 8.3
]
DENSIDAD = 2


def cargar_iconos():
    """El generador de iconos tiene guion en el nombre: no se puede importar
    con `import`, hay que cargarlo por ruta."""
    ruta = Path(__file__).resolve().parent / "generar-iconos.py"
    spec = importlib.util.spec_from_file_location("generar_iconos", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def escribir_png(ruta, ancho, alto, filas):
    crudo = b"".join(b"\x00" + f for f in filas)

    def trozo(tipo, datos):
        return (struct.pack(">I", len(datos)) + tipo + datos
                + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + trozo(b"IHDR", struct.pack(">IIBBBBB", ancho, alto, 8, 2, 0, 0, 0))
           + trozo(b"IDAT", zlib.compress(crudo, 9))
           + trozo(b"IEND", b""))
    ruta.write_bytes(png)


def lienzo(ancho, alto, icono, lado):
    """Fondo liso con el icono centrado. Se compone por filas para no tener
    que guardar la imagen entera en memoria como lista de pixeles."""
    fila_vacia = bytes(FONDO) * ancho
    x0 = (ancho - lado) // 2
    y0 = (alto - lado) // 2
    filas = []
    for y in range(alto):
        if y0 <= y < y0 + lado:
            fila = bytearray(fila_vacia)
            fila[x0 * 3:(x0 + lado) * 3] = icono[y - y0]
            filas.append(bytes(fila))
        else:
            filas.append(fila_vacia)
    return filas


def main():
    gi = cargar_iconos()
    # El icono se dibuja sobre su propio fondo, un poco mas claro que el de la
    # app. En una pantalla de arranque eso deja un cuadrado visible alrededor
    # de la botella, asi que se le impone el fondo de la app.
    gi.FONDO = FONDO
    SALIDA.mkdir(parents=True, exist_ok=True)
    enlaces = []

    cache_iconos = {}
    for ancho_css, alto_css in IPADS:
        for orientacion in ("portrait", "landscape"):
            if orientacion == "portrait":
                ancho, alto = ancho_css * DENSIDAD, alto_css * DENSIDAD
            else:
                ancho, alto = alto_css * DENSIDAD, ancho_css * DENSIDAD

            # El icono ocupa un cuarto del lado corto: se ve sin dominar.
            lado = (min(ancho, alto) // 4) // 2 * 2
            if lado not in cache_iconos:
                cache_iconos[lado] = gi.render(lado)
            icono = cache_iconos[lado]

            nombre = f"arranque-{ancho}x{alto}.png"
            escribir_png(SALIDA / nombre, ancho, alto, lienzo(ancho, alto, icono, lado))
            enlaces.append(
                '<link rel="apple-touch-startup-image" href="iconos/' + nombre + '"\n'
                f'      media="(device-width: {ancho_css}px) and (device-height: {alto_css}px)'
                f' and (-webkit-device-pixel-ratio: {DENSIDAD}) and (orientation: {orientacion})">'
            )
            print(f"iconos/{nombre}")

    print("\n--- Para index.html ---")
    print("\n".join(enlaces))
    print("\n--- Para ARCHIVOS en sw.js ---")
    for ancho_css, alto_css in IPADS:
        for w, h in ((ancho_css * DENSIDAD, alto_css * DENSIDAD),
                     (alto_css * DENSIDAD, ancho_css * DENSIDAD)):
            print(f"  './iconos/arranque-{w}x{h}.png',")


if __name__ == "__main__":
    main()
