#!/usr/bin/env python3
"""Servidor local para desarrollo y pruebas.

Igual que `python3 -m http.server`, pero manda Cache-Control: no-store en todo.

Por qué existe: el navegador guarda los módulos de JavaScript en memoria y
sigue sirviendo la versión anterior después de editar un archivo. Eso ya costó
varias horas persiguiendo errores que en realidad ya estaban corregidos. Con
no-store, lo que se ve en pantalla es siempre lo que está en el disco.

Esto es solo para desarrollo. En el iPad, la app se sirve por HTTPS desde un
alojamiento estático normal y el service worker se encarga del uso sin internet.

    python3 herramientas/servidor-dev.py [puerto]
"""
import functools
import http.server
import pathlib
import socketserver
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8787


class SinCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Sin esto el servidor contesta 304 y el navegador reusa su copia vieja,
        # que es exactamente el problema que este servidor viene a resolver.
        for cabecera in ("If-Modified-Since", "If-None-Match"):
            while cabecera in self.headers:
                del self.headers[cabecera]
        return super().send_head()

    def log_message(self, formato, *args):
        if "404" in (args[1] if len(args) > 1 else ""):
            super().log_message(formato, *args)


class Servidor(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    manejador = functools.partial(SinCache, directory=str(RAIZ))
    with Servidor(("", PUERTO), manejador) as httpd:
        print(f"Almacén de Licores en http://localhost:{PUERTO}/index.html")
        print(f"Pruebas en          http://localhost:{PUERTO}/pruebas.html")
        print("Sin caché: lo que ves es siempre lo que está en el disco.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")


if __name__ == "__main__":
    main()
