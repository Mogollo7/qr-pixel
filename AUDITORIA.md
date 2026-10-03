# Auditoría

## 1. Skill `three-agent-skills` (emalorenzo)

Origen: `https://github.com/emalorenzo/three-agent-skills.git`. Instalada a nivel de proyecto en `.claude/skills/` (`three-best-practices` y `r3f-best-practices`). Los `.zip` de distribución no se instalaron.

**Seguridad**
- Solo contiene Markdown y un `package.json` sin scripts. No hay hooks, ejecutables, `postinstall` ni cadenas de inyección de instrucciones.
- Las URL son documentación y CDN conocidos (threejs.org, jsDelivr, cdnjs, gstatic).
- Veredicto: **sin hallazgos de seguridad**.

**Coherencia interna (hallazgos)**
| # | Hallazgo | Acción |
|---|---|---|
| 1 | `r3f-best-practices/SKILL.md` apunta a `rules/state-zustand-selectors.md`, que no existe (el archivo es `perf-zustand-selectors.md`). | Corregido en la copia instalada. |
| 2 | `three-best-practices` dice «120+ reglas, 18 categorías», pero hay 27 archivos; casi todos sin referencia desde `SKILL.md`. El resto de reglas viven en el propio `SKILL.md` y en `THREE_BEST_PRACTICES.md`. | Sin cambios; conviene leer ambos. |
| 3 | `setup-use-import-maps.md` muestra el script de r128 como ejemplo «malo»; es intencional. | Ninguna. |
| 4 | Versión de three.js fijada en 0.182.0; confirmada disponible en jsDelivr. | Usada en la app. |

## 2. La app frente a la skill

| Regla | Cómo se cumple |
|---|---|
| `setup-use-import-maps` | Import map con three@0.182.0 y addons. |
| `setup-animation-loop` | `renderer.setAnimationLoop`. |
| `geometry-instanced-mesh`, `draw-call-optimization` | 2 `InstancedMesh`; ver RFNO-RND-01. |
| `render-conditional`, `render-delta-time` | Bucle bajo demanda con delta acotado. |
| `render-pixel-ratio` | `Math.min(devicePixelRatio, 2)`. |
| `memory-dispose-*` | Se liberan mallas, geometrías clonadas y texturas; ver RFNO-MEM. |
| `lighting-shadow-camera-tight`, `lighting-limit-lights` | 2 luces; cámara de sombra ajustada. |
| `raycasting-optimization` | Un solo rayo por clic y movimiento limitado por fotograma; sin BVH (la escena es pequeña). |
| `error-handling-recovery` | Aviso de pérdida de contexto; falta reconstrucción probada. |
| `material-reuse` | 3 materiales compartidos. |
| `camera-near-far` | Near/far ajustados al tamaño del modelo. |

**Desviaciones conscientes**
- Los cubos se desplazan en el shader (`frustumCulled = false`) para la transformación en GPU.
- Cada malla clona la geometría del cubo para llevar sus atributos por instancia.

## 3. Instrucciones del usuario

- Tu primer mensaje se cortó en «audita las instrucciones con…». Auditaron la skill y la app; si querías otra herramienta o criterio, dímelo.
- «Alata» se interpretó como *Atelopus*.
- La corrección sobre «la rana ES los voxels» se aplicó íntegra; el punto sobre 3D sin QR y transformación al hacer clic también.

## 4. Verificado vs. no verificado

**Verificado en el navegador**: construcción de los 5 moldes; vistas desde cuatro ángulos; QR legible en 15 combinaciones de molde y resolución; fallo detectado con colores sin contraste; texto largo y UTF-8; transformación a mitad de camino y al final; GLB → cubos con color; JSON con entradas hostiles; cabecera `.vox`.

**No verificado**: editor con ratón; foto real; QR con teléfono; `.vox` en MagicaVoxel; móvil; otros navegadores.
