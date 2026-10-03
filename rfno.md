# RFNO — Requisitos no funcionales de Rana QR

Las reglas de rendimiento y memoria siguen la skill `three-best-practices` (ver `AUDITORIA.md`).

## 1. Rendimiento (RFNO-RND)

| ID | Requisito | Medido / estado |
|---|---|---|
| RFNO-RND-01 | Todos los cubos opacos en **un** `InstancedMesh` (un draw call) y los translúcidos en otro; sin `Mesh` por cubo. | ✔ 2 mallas |
| RFNO-RND-02 | Bucle único con `renderer.setAnimationLoop` y delta time acotado. | ✔ |
| RFNO-RND-03 | Render bajo demanda: solo se dibuja si algo cambia, gira o se anima. | ✔ |
| RFNO-RND-04 | La transformación rana → QR se calcula en GPU (un uniforme), sin tocar miles de matrices por fotograma. | ✔ |
| RFNO-RND-05 | Pixel ratio máximo 2; sombras con cámara de sombra ajustada a la escena. | ✔ |
| RFNO-RND-06 | Reconstrucción del modelo: ~65 ms a 48 cubos, ~150 ms a 64, 17–20 mil cubos a 110 de largo. | ✔ medido |
| RFNO-RND-07 | Capacidad: hasta 128 cubos de largo (~45 000 cubos visibles). | ✔ |
| RFNO-RND-08 | Reconstrucción en hilo principal, agrupada por fotograma (`requestAnimationFrame`). | ◐ a resoluciones altas puede notarse; mover a un Worker si hiciera falta |

## 2. Memoria (RFNO-MEM)

| ID | Requisito | Estado |
|---|---|---|
| RFNO-MEM-01 | Geometría compartida por tipo de malla y material reutilizado. | ✔ |
| RFNO-MEM-02 | `dispose()` de mallas, geometrías, texturas y malla fusionada de exportación. | ✔ |
| RFNO-MEM-03 | Las mallas se reutilizan y solo crecen cuando hace falta (capacidad con margen del 25 %). | ✔ |
| RFNO-MEM-04 | Texturas de modelos GLB reducidas a 1024 px para muestrear y luego liberadas. | ✔ |
| RFNO-MEM-05 | Foto de referencia reducida a 512 px. | ✔ |
| RFNO-MEM-06 | Pérdida de contexto WebGL avisada y restaurable. | ◐ aviso; la reconstrucción automática no se probó |

## 3. Seguridad y privacidad (RFNO-SEG)

| ID | Requisito | Estado |
|---|---|---|
| RFNO-SEG-01 | Todo se procesa en el navegador: fotos, GLB y textos no se envían a ningún servidor. | ✔ |
| RFNO-SEG-02 | Carga de proyectos JSON validada: formato, tipos, rangos, listas de opciones, colores `#rrggbb`, límite de ediciones. | ✔ probado con datos hostiles |
| RFNO-SEG-03 | Límite de tamaño y tipo en archivos: imagen 15 MB, GLB 80 MB, proyecto 20 MB. | ✔ |
| RFNO-SEG-04 | La interfaz construye el DOM con `textContent`; nunca se inserta HTML de usuario. | ✔ |
| RFNO-SEG-05 | Dependencias externas fijadas por versión y solo desde CDN conocidos (jsDelivr, cdnjs). | ◐ sin hash de integridad (SRI); se puede copiar en local |
| RFNO-SEG-06 | Se oculta la API de depuración salvo con `?debug`. | ✔ |
| RFNO-SEG-07 | Crear es abierto (sin token): clave propia por QR, 30 creaciones por IP y hora, tope de 300 QR y 80 000 cubos por QR, validación de tamaños y formato. | ✔ probado, incluido el 429 |
| RFNO-SEG-08 | El límite por IP usa la IP real tras un túnel (`TRUST_PROXY=1`, `CF-Connecting-IP`). | ✔ probado; exige no publicar el puerto del contenedor directamente |
| RFNO-SEG-10 | **Riesgo abierto:** un QR puede redirigir a cualquier sitio http/https usando tu dominio. Mitigaciones opcionales: `DESTINOS_PERMITIDOS`, `CLAVE_CREAR`, Cloudflare Access. | ◐ no activas por defecto |
| RFNO-SEG-11 | Contenedor sin privilegios, sistema de archivos de solo lectura salvo `/data`, sin capacidades extra. | ✔ comprobado dentro del contenedor |
| RFNO-SEG-09 | CSP estricta en el sitio público (solo scripts propios); archivos internos (`server.mjs`, `datos/`) no se sirven. | ✔ probado |

## 4. Compatibilidad (RFNO-COM)

| ID | Requisito | Estado |
|---|---|---|
| RFNO-COM-01 | Navegadores con WebGL2 y módulos ES (Chrome, Edge, Firefox, Safari recientes). | ◐ solo probado en el navegador integrado de Claude |
| RFNO-COM-02 | Sin paso de compilación: archivos estáticos con import map. | ✔ |
| RFNO-COM-03 | El sitio público incluye three.js; el panel `/admin/` usa CDN (jsDelivr, cdnjs). | ◐ el panel necesita internet |
| RFNO-COM-04 | Móvil: panel bajo el visor y control táctil. | ◐ no probado en teléfono |

## 5. Usabilidad y accesibilidad (RFNO-USA)

| ID | Requisito | Estado |
|---|---|---|
| RFNO-USA-01 | Interfaz en español, con etiquetas asociadas a cada control y orden de foco lógico. | ✔ |
| RFNO-USA-02 | Contraste de texto suficiente y tema oscuro/claro por preferencia del sistema. | ◐ tema oscuro; el claro está definido pero sin conmutador |
| RFNO-USA-03 | Respeta `prefers-reduced-motion` en la interfaz. | ◐ la animación de transformación se mantiene (es la función principal) |
| RFNO-USA-04 | El estado del QR (legible o no) se anuncia con `role="status"`. | ✔ |
| RFNO-USA-05 | Atajos: Ctrl+Z / Ctrl+Y. | ✔ |

## 6. Mantenibilidad (RFNO-MNT)

| ID | Requisito | Estado |
|---|---|---|
| RFNO-MNT-01 | Módulos separados: `params`, `voxelize`, `qrstate`, `glb`, `photo`, `io`, `main`. | ✔ |
| RFNO-MNT-02 | El generador de cubos no depende de three.js y se puede probar aislado. | ✔ |
| RFNO-MNT-03 | Medidas anatómicas relativas a la longitud del cuerpo, no a píxeles. | ✔ |
| RFNO-MNT-04 | Pruebas automáticas. | ✘ las verificaciones se hicieron a mano en el navegador; falta una suite |

## 7. Capacidad y límites
- Resolución: 16–128 cubos de largo. El `.vox` admite 256 por lado.
- QR: versiones 1 a 40; las altas dejan pocos cubos por módulo y la rana se ve más pequeña.
- Cubos del QR: entre 1×1 y 5×5 por módulo, calculados según los cubos de la rana.
