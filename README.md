# Rana QR

Cargas un modelo 3D (`.glb`), se convierte en una figura de **cubos**, le pones un enlace y los mismos cubos forman el **QR**. Cada QR guardado tiene su propia página pública:

- La figura aparece armándose y **gira sola**.
- Al **acercar el mouse**, los cubos se reordenan en el QR; al alejarlo vuelve la figura.
- **Clic en el QR** redirige al enlace (en móvil: un toque muestra el QR, el segundo lo abre).

Todo se guarda en una base de datos SQLite (un archivo). No hay cuentas ni token.

## Con Docker (recomendado)
```bash
docker compose up -d --build     # http://127.0.0.1:8080
```
La base vive en el volumen `rana-datos`: sobrevive a reinicios y a `docker compose down` (`down -v` la borra). El contenedor corre sin privilegios, con el sistema de archivos de solo lectura salvo `/data`.

Respaldo de la base (el volumen se llama `<carpeta>_rana-datos`; compruébalo con `docker volume ls`):
```bash
docker run --rm -v qr_rana-datos:/data -v "$PWD":/copia alpine tar czf /copia/rana-datos.tgz -C /data .
```

## Exponerlo con un túnel
El contenedor solo escucha en `127.0.0.1:8080`. Apunta tu túnel a ese puerto, por ejemplo con Cloudflare:
```bash
cloudflared tunnel --url http://127.0.0.1:8080
```
o un túnel con nombre cuyo servicio sea `http://127.0.0.1:8080`.

`TRUST_PROXY=1` (ya activo en `docker-compose.yml`) hace que el límite por IP use la IP real del visitante (`CF-Connecting-IP`). Si usas otro proxy, comprueba que pone esa cabecera o `X-Forwarded-For`, y no publiques el puerto del contenedor directamente: con `TRUST_PROXY` cualquiera que llegue directo podría falsear su IP y saltarse el límite.

## Qué protege el sitio y qué no
Crear es abierto: cualquiera que llegue por el túnel puede guardar un QR.

| Medida | Detalle |
|---|---|
| Clave por QR | Al guardar, el servidor entrega una clave que solo guarda el navegador que lo creó; sin ella nadie puede borrar ni reemplazar ese QR |
| Límite por IP | 30 creaciones por hora (`LIMITE_HORA`) |
| Topes | 300 QR en total (`MAX_MODELOS`), 80 000 cubos por QR, cuerpo máximo de 8 MB |
| Solo http/https | la página nunca redirige a otros esquemas (`javascript:` y similares se rechazan al crear y al abrir) |
| CSP estricta | en la página pública de cada QR |

**Riesgo que sigue abierto:** como cualquiera puede crear, alguien puede hacer un QR cuyo clic redirija a un sitio malicioso **usando tu dominio** (phishing). Para evitarlo, en `docker-compose.yml`:
- `DESTINOS_PERMITIDOS: "tudominio.com,otro.com"` → solo se aceptan enlaces a esos dominios, o
- `CLAVE_CREAR: "una-clave-larga"` → crear exige esa clave (aparece un campo en la página), o
- protege la ruta `/` con Cloudflare Access (las páginas `/v/…` quedan públicas).

«Mis QR» vive en el navegador de quien los creó, junto con sus claves. Si ese navegador se borra, los enlaces siguen funcionando pero ya no se pueden eliminar desde la interfaz.

## Sin Docker
```bash
node servidor/server.mjs         # Node 22.13 o superior; no hay nada que instalar
```

## Páginas
| Ruta | Qué es |
|---|---|
| `/` | crear: cargar GLB, enlace, vista previa, guardar |
| `/v/<id>` | la entrega final de un QR |
| `/admin/` | editor avanzado (moldes de rana, edición cubo a cubo, foto de referencia) |

## Procesar por lotes
`cubizar/` convierte modelos desde la línea de comandos y puede guardarlos en el sitio: ver `cubizar/README.md`.

## Variables de entorno
`PORT` (8080) · `DATA_DIR` · `TRUST_PROXY` · `LIMITE_HORA` · `MAX_MODELOS` · `DESTINOS_PERMITIDOS` · `CLAVE_CREAR`.

## Documentos del proyecto
`rfn.md` (requisitos funcionales y su estado), `rfno.md` (no funcionales) y `AUDITORIA.md`.
