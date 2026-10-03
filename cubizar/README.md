# cubizar

Procesa modelos `.glb` de forma automática: los convierte en cubos (conservando sus colores) y genera el QR con esos mismos cubos.

```bash
npm install                                   # una sola vez
node cubizar.mjs mi-rana.glb --text "https://mi-sitio.org" --res 64
node cubizar.mjs ../entrada --out ../salida   # una carpeta entera
node cubizar.mjs --probar                     # autoprueba
node cubizar.mjs --help
```

Por cada modelo escribe en `--out` (por defecto `./salida`):

| Archivo | Contenido |
|---|---|
| `<n>_qr.png` | El QR plano, listo para imprimir o escanear |
| `<n>_cubos.glb` / `<n>_cubos.vox` | El modelo hecho de cubos (visores, Blender / MagicaVoxel) |
| `<n>_qr.glb` | Esos mismos cubos colocados como QR |
| `<n>_vista_cubos.png`, `<n>_vista_qr.png` | Imágenes de ambos estados |
| `<n>_proyecto.json` | Se abre en la app para seguir editando a mano |
| `<n>_informe.json` | Cubos, versión del QR y si se leyó |

Con `--subir <url>` cada modelo se guarda además en la base de datos del sitio y se imprime su enlace final `/v/<id>` y la clave para borrarlo; `--text` es el enlace al que llevará el QR, y `--manifiesto` da título y enlace por modelo.

Cada QR se decodifica antes de darlo por bueno. Si no se lee, se avisa (y con `--estricto` el programa termina con error).

Funciona con la app de `../rana-qr` dentro de un Chrome o Edge sin ventana, así el resultado es idéntico al de la interfaz. Necesita Node 18+, un Chrome/Edge instalado (o `--chrome <ruta>`) y conexión a internet para cargar three.js desde el CDN.
