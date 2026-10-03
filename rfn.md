# RFN — Requisitos funcionales de Rana QR

> **La rana no tiene voxels. La rana ES los voxels.**
> Toda la anatomía visible surge de la disposición de cubos individuales. No hay malla suave, textura pixelada ni shader que simule cubos.

Estado: **✔ implementado y probado** · **◐ parcial** · **✘ pendiente**. «Probado» significa verificado en el navegador, no solo escrito.

## 1. Principio visual (RF-CUB)

| ID | Requisito | Estado |
|---|---|---|
| RF-CUB-01 | La unidad fundamental es el cubo (posición, color, parte anatómica). Cada cubo se guarda en una rejilla con su región anatómica. | ✔ |
| RF-CUB-02 | La rana se dibuja con `InstancedMesh` de `BoxGeometry` con material compartido y color por instancia. Nunca un `Mesh` por cubo. | ✔ |
| RF-CUB-03 | Se omiten los cubos totalmente rodeados (no pueden verse). | ✔ |
| RF-CUB-04 | La escalera irregular de cubos es parte de la estética: no se suaviza la silueta. | ✔ |
| RF-CUB-05 | El tamaño del cubo es un parámetro global («Cubos a lo largo del cuerpo», 16–128). | ✔ |
| RF-CUB-06 | Cada parte (tronco, cabeza, ojo, pata, pie, dedo) es un volumen de cubos; no se voxeliza una malla suave. | ✔ |
| RF-CUB-07 | Rotación por cubo. | ✘ No hace falta: la rejilla es alineada a ejes, por diseño. |

## 2. Molde base y variantes (RF-MOL)

| ID | Requisito | Estado |
|---|---|---|
| RF-MOL-01 | **Base: rana de Minecraft** (cuerpo en bloque, ojos arriba, patas cortas). Las demás variantes parten de ella. | ✔ |
| RF-MOL-02 | *Rhinella horribilis*: cuerpo robusto, cabeza ancha, parotoides con volumen, crestas craneales, verrugas, tímpano. | ✔ probado en 4 ángulos |
| RF-MOL-03 | *Pristimantis*: cabeza grande, ojos saltones, discos digitales, patas largas, franja oscura del hocico a través del ojo hasta el flanco, barra interorbital. | ✔ probado en 4 ángulos |
| RF-MOL-04 | Rana de cristal: cuerpo plano, ojos frontales, dorso verde con puntos, vientre translúcido y órganos (corazón, hígado, intestino). | ✔ probado en 4 ángulos |
| RF-MOL-05 | *Atelopus* (rana arlequín): cuerpo estrecho con cintura, hocico puntiagudo, patas finas, colores de advertencia. | ✔ — *interpretación de «alata»; confirmar* |
| RF-MOL-06 | Reconocimiento antes que belleza: se prioriza silueta y rasgo distintivo sobre el detalle (regla de máxima fidelidad). | ✔ |
| RF-MOL-07 | Cada molde se ve bien desde 3/4, lateral, cenital y frontal; las vistas están a un clic. | ✔ |

## 3. Personalización (RF-PER)

| ID | Requisito | Estado |
|---|---|---|
| RF-PER-01 | Más de 50 parámetros: tronco (ancho, alto, cuadratura, postura, joroba, cadera), cabeza (ancho, largo, alto, hocico), ojos (tamaño, separación, posición, protuberancia, mirada frontal, pupila, tímpano), patas (largo, grosor, apertura, pose, dedos, discos, membrana). | ✔ |
| RF-PER-02 | Rasgos con volumen: parotoides, crestas, verrugas, translucidez, órganos. | ✔ |
| RF-PER-03 | Patrones por cubo: franja a través del ojo, línea vertebral, dorsolaterales, barra interorbital, manchas, barras en patas, degradado, variación por cubo, boca. | ✔ |
| RF-PER-04 | Paleta de 17 colores editables. | ✔ |
| RF-PER-05 | Ojos de cubos: órbita, iris, pupila (redonda, horizontal, vertical) y brillo. | ✔ |
| RF-PER-06 | Editor cubo a cubo: pintar, añadir, quitar, gotero, pincel 1–4, simetría, deshacer/rehacer (Ctrl+Z). | ◐ implementado; la prueba de interacción con el ratón queda pendiente |
| RF-PER-07 | Semilla y botón «Variar patrón». | ✔ |
| RF-PER-08 | Guardar y abrir proyectos (JSON) y guardado automático en el navegador. | ✔ |

## 4. Rana real → rana cúbica (RF-FOTO)

La foto **no** se proyecta como textura: se analiza, se ajusta el volumen y cada cubo recibe un color de una paleta reducida.

| ID | Requisito | Estado |
|---|---|---|
| RF-FOTO-01 | Cargar una foto cenital; se procesa en el equipo. | ◐ implementado; no probado con una foto real |
| RF-FOTO-02 | Separar la rana del fondo y medir su silueta (ancho de tronco, cabeza, cintura, hocico). | ✔ probado con imagen sintética |
| RF-FOTO-03 | Ajustar proporciones del molde a la silueta. | ◐ solo las proporciones visibles desde arriba; altura, patas y ojos son manuales |
| RF-FOTO-04 | Extraer paleta de la rana (sin fondo) y asignarla. | ✔ |
| RF-FOTO-05 | Reconstruir el patrón en cubos con 2–12 colores. | ◐ |
| RF-FOTO-06 | Foto translúcida encima para calcar a mano. | ✔ |
| RF-FOTO-07 | Reconstrucción de volumen a partir de varias fotos o de un modelo 3D. | ◐ solo con GLB (ver RF-GLB); desde varias fotos ✘ |

## 5. GLB → cubos (RF-GLB)

| ID | Requisito | Estado |
|---|---|---|
| RF-GLB-01 | Cargar un `.glb` (Draco y Meshopt incluidos) y reconstruirlo como volumen de cubos. | ✔ probado con un modelo generado |
| RF-GLB-02 | Cada cubo toma el color promedio de textura, color de vértice y material que cae dentro. | ✔ rojo/azul de textura y verde de material se conservaron |
| RF-GLB-03 | Girar, inclinar y reducir niveles de color (más aspecto Minecraft). | ✔ |
| RF-GLB-04 | El modelo importado se convierte en QR igual que los moldes y se puede editar cubo a cubo. | ✔ |
| RF-GLB-05 | Modelos de hasta 80 MB y 2 millones de triángulos. | ✔ |

## 5b. Procesamiento automático (RF-AUTO)

| ID | Requisito | Estado |
|---|---|---|
| RF-AUTO-01 | `cubizar.mjs`: un `.glb` (o una carpeta) entra y salen cubos y QR sin intervención. | ✔ probado con un modelo generado y con moldes |
| RF-AUTO-02 | Salidas: QR PNG, GLB y VOX de cubos, GLB del QR, vistas PNG, proyecto JSON e informe JSON. | ✔ |
| RF-AUTO-03 | Opciones: texto, resolución, giro, niveles de color, corrección de errores, colores del QR, molde. Valores validados. | ✔ |
| RF-AUTO-04 | Cada QR se decodifica; si no se lee se informa y con `--estricto` el programa falla. | ✔ |
| RF-AUTO-05 | Mismo resultado que la interfaz (usa la misma app en un navegador sin ventana). | ✔ |
| RF-AUTO-06 | Arrastrar un GLB al visor o abrir `?glb=ruta.glb`. | ◐ implementado, no probado a mano |
| RF-AUTO-07 | Probado con un GLB real de rana. | ✘ pendiente: falta el archivo |

## 5c. Flujo de creación, entrega y base de datos (RF-PUB, RF-NAV)

| ID | Requisito | Estado |
|---|---|---|
| RF-PUB-01 | En la interfaz (`/`) se carga un `.glb` y se convierte en cubos con sus colores (detalle, giro, inclinación y estilo de bloque ajustables). | ✔ probado con tu GLB (186 mil triángulos → 10 976 cubos) |
| RF-PUB-02 | Se escribe el enlace; se valida (solo http/https; sin esquema se añade https, `localhost` usa http) y se convierte en el QR. | ✔ `javascript:` rechazado |
| RF-PUB-03 | Vista previa en vivo con la animación; avisa si el QR no se lee y entonces no permite guardar. | ✔ |
| RF-PUB-04 | «Guardar» escribe todo en SQLite (un archivo) **sin token**; entrega un enlace final `/v/<id>` con copiar y abrir. | ✔ probado dentro de Docker |
| RF-PUB-05 | Se pueden cargar varios GLB; «Mis QR» lista los creados desde ese navegador, con abrir, copiar y eliminar. | ✔ |
| RF-PUB-06 | Cada QR tiene una clave propia (que solo guarda el navegador que lo creó) para borrarlo o reemplazarlo. | ✔ borrar o reemplazar sin ella → 403 |
| RF-PUB-07 | Subida automática: `cubizar --subir <url>`; imprime el enlace final y la clave. | ✔ |
| RF-PUB-08 | Contenedor Docker con volumen para la base. | ✔ imagen construida, saludable, datos conservados al recrear |
| RF-NAV-01 | En la entrega, la figura aparece armándose (los bloques vuelan y se juntan). | ✔ verificado con fotogramas fijos |
| RF-NAV-02 | La figura **gira sola** mientras el mouse no está encima, y vuelve a girar al alejarlo. | ✔ comprobado con capturas consecutivas |
| RF-NAV-03 | **Acercar el mouse** transforma la figura en QR; **alejarlo** la devuelve. | ✔ probado en ambos sentidos |
| RF-NAV-04 | **Clic en el QR redirige** al enlace. | ✔ probado (escritorio y móvil emulado) |
| RF-NAV-05 | Móvil: un toque muestra el QR y un segundo toque lo abre. | ✔ emulado; no probado en un teléfono real |
| RF-NAV-06 | Teclado y botones; respeta «reducir movimiento», con un botón para activar la animación. | ✔ |
| RF-NAV-07 | Fluidez con unos 14 mil cubos en un equipo real. | ✘ solo se midió con render por software |

## 6. Estado QR y transformación (RF-QR)

| ID | Requisito | Estado |
|---|---|---|
| RF-QR-01 | La rana se muestra completa en 3D, **sin QR encima**. | ✔ |
| RF-QR-02 | Al hacer clic en la rana, o en «Convertir en QR», **sus propios cubos** vuelan y forman el código. Otro clic los devuelve. | ✔ transformación en GPU; probada a mitad de camino y al final |
| RF-QR-03 | Los cubos se emparejan por posición para un vuelo ordenado; los sobrantes se encogen o nacen. | ✔ |
| RF-QR-04 | Cámara hacia la vista frontal del QR durante la transformación. | ✔ |
| RF-QR-05 | Contenido libre (UTF-8: tildes, eñes), corrección de errores L/M/Q/H, versión mínima, margen claro 2–4. | ✔ |
| RF-QR-06 | Resolución del QR en cubos por módulo calculada para aprovechar los cubos de la rana; relieve configurable. | ✔ |
| RF-QR-07 | Colores del QR: dos colores a elegir, o colores de la rana oscurecidos. | ✔ |
| RF-QR-08 | En estado QR los cubos pasan a color plano para que lo verificado sea lo que se ve. | ✔ |

## 7. Capa de protección del QR (RF-SCAN)

| ID | Requisito | Estado |
|---|---|---|
| RF-SCAN-01 | El QR se decodifica con jsQR sobre el raster de los cubos reales tras cada cambio. | ✔ |
| RF-SCAN-02 | Si el tinte de la rana impide la lectura, los colores se oscurecen por pasos (100/60/30/0 %) hasta que se lee, y se avisa. | ✔ |
| RF-SCAN-03 | Un aviso rojo si el QR no se lee (p. ej. contraste insuficiente). Nunca se pierde información en silencio. | ✔ probado con claro sobre claro |
| RF-SCAN-04 | Lo que se pinte en la rana no puede romper el QR: los colores del QR se limitan solos. | ✔ |
| RF-SCAN-05 | Probado en los 5 moldes a 24, 64 y 110 cubos de largo. | ✔ 15/15 legibles |
| RF-SCAN-06 | Prueba con teléfonos y lectores reales. | ✘ pendiente; solo se probó con jsQR |

## 8. Exportación (RF-EXP)

| ID | Requisito | Estado |
|---|---|---|
| RF-EXP-01 | PNG del QR a gran tamaño (imprimir o escanear). | ✔ |
| RF-EXP-02 | PNG de la vista 3D. | ✔ |
| RF-EXP-03 | **GLB** con solo las caras visibles y color por vértice (traslúcido aparte). | ✔ |
| RF-EXP-04 | **VOX** (MagicaVoxel), formato nativo de cubos con paleta de 255 colores. | ◐ generado y con cabecera válida; no abierto en MagicaVoxel |
| RF-EXP-05 | Proyecto JSON con validación estricta al abrir. | ✔ probado con entradas hostiles |

### ¿Hay un mejor formato que GLB?
- **Para entrada** (tu rana real): GLB es el correcto, porque lleva malla, textura y color en un solo archivo.
- **Para salida de cubos**: `.vox` es el formato nativo de cubos (paleta, un cubo = un dato, archivos pequeños) y lo abren MagicaVoxel y otros editores voxel. **GLB** sirve para visores, web, Blender y realidad aumentada. La app exporta ambos.

## 9. Interfaz (RF-UI)

| ID | Requisito | Estado |
|---|---|---|
| RF-UI-01 | Panel en pestañas (Molde, QR, Cuerpo, Patas, Piel, Cubos, Foto, GLB, Exportar), todo en español. | ✔ |
| RF-UI-02 | Vistas 3/4, frente, cenital, lateral, rotación automática. | ✔ |
| RF-UI-03 | Insignia de lectura del QR y contador de cubos en pantalla. | ✔ |
| RF-UI-04 | Diseño adaptable a móvil (panel debajo del visor). | ◐ estilos listos; no revisado en un teléfono |
| RF-UI-05 | Primer plano de la rana al abrir (cámara ajustada). | ◐ la distancia de cámara se ajustó una vez; falta revisarla en un pantalla real |

## 10. Pendientes conocidos
1. Prueba de la interacción del editor (clic y arrastre) con el ratón.
2. Prueba con una foto real y con un GLB de rana real.
3. Probar el QR con lectores reales de teléfono.
4. Validar el `.vox` en MagicaVoxel.
5. Confirmar que «alata» es *Atelopus*.
6. Reconstrucción multi-foto (ángulos distintos) para el volumen.
