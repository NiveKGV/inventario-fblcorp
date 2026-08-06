#!/usr/bin/env python3
"""Genera los iconos PNG de la app sin dependencias externas.

Se usa solo cuando haya que cambiar el icono. Los PNG generados se
versionan en el repositorio, así que no hace falta correr esto para
instalar ni para usar la app.

Uso:  python3 herramientas/generar-iconos.py
"""
import struct
import zlib
from pathlib import Path

SALIDA = Path(__file__).resolve().parent.parent / "iconos"
FONDO = (0x18, 0x1A, 0x20)
VIDRIO = (0xE0, 0xA3, 0x4A)
ETIQUETA = (0x12, 0x13, 0x17)
TAMANOS = (180, 192, 512)
SUPER = 4  # muestreo para bordes suaves


def dentro_botella(x, y, n):
    """Silueta de botella en coordenadas normalizadas 0..1."""
    cx = 0.5
    # cuello
    if 0.10 <= y < 0.30:
        return abs(x - cx) <= 0.075
    # hombro: interpolación suave del cuello al cuerpo
    if 0.30 <= y < 0.44:
        t = (y - 0.30) / 0.14
        t = t * t * (3 - 2 * t)
        ancho = 0.075 + t * (0.215 - 0.075)
        return abs(x - cx) <= ancho
    # cuerpo con esquinas redondeadas abajo
    if 0.44 <= y <= 0.90:
        if y > 0.865:
            t = (y - 0.865) / 0.035
            ancho = 0.215 * (1 - 0.55 * t * t)
        else:
            ancho = 0.215
        return abs(x - cx) <= ancho
    return False


def en_etiqueta(x, y):
    return 0.58 <= y <= 0.74 and abs(x - 0.5) <= 0.215


def color_pixel(x, y, n):
    if not dentro_botella(x, y, n):
        return None
    if en_etiqueta(x, y):
        return ETIQUETA
    return VIDRIO


def render(n):
    filas = []
    paso = 1.0 / (n * SUPER)
    for py in range(n):
        fila = bytearray()
        for px in range(n):
            acumulado = [0, 0, 0]
            for sy in range(SUPER):
                for sx in range(SUPER):
                    x = (px * SUPER + sx + 0.5) * paso
                    y = (py * SUPER + sy + 0.5) * paso
                    c = color_pixel(x, y, n) or FONDO
                    acumulado[0] += c[0]
                    acumulado[1] += c[1]
                    acumulado[2] += c[2]
            total = SUPER * SUPER
            fila += bytes(v // total for v in acumulado)
        filas.append(bytes(fila))
    return filas


def escribir_png(ruta, n, filas):
    crudo = b"".join(b"\x00" + f for f in filas)

    def trozo(tipo, datos):
        return (struct.pack(">I", len(datos)) + tipo + datos
                + struct.pack(">I", zlib.crc32(tipo + datos) & 0xFFFFFFFF))

    png = (b"\x89PNG\r\n\x1a\n"
           + trozo(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
           + trozo(b"IDAT", zlib.compress(crudo, 9))
           + trozo(b"IEND", b""))
    ruta.write_bytes(png)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    for n in TAMANOS:
        escribir_png(SALIDA / f"icono-{n}.png", n, render(n))
        print(f"iconos/icono-{n}.png")


if __name__ == "__main__":
    main()
