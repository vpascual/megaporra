# LA MEGAPORRA — Especificación de diseño (para Claude Code)

> **Fuente de verdad:** el archivo `La Megaporra.dc.html` de este proyecto. Ábrelo y lee los estilos inline + la clase de lógica: ahí está cada hex, cada fuente y cada medida. Este documento resume lo esencial y corrige las desviaciones de la implementación actual.

---

## 0. La desviación más importante (corrígela primero)

La implementación actual muestra una **matriz/hoja de cálculo**: todas las jornadas como columnas y un mar de números verdes/rojos. **No es eso.**

El diseño correcto es un **ranking limpio y escaneable**, una fila por apostante:

```
[POS]  [▲/▼/=]  [NOMBRE]            [▍▍▍▍ sparkline J1–J4]   [PTS]
  4      ▲       AGUSTÍN             ▁▃▅▂                      39
                 a 7 pts del podio
```

- El detalle por jornada **no** se muestra como 35 columnas. Vive en: (1) el **selector de jornadas** (cambia la foto del ranking a esa jornada) y (2) el **sparkline** de 4 barras (puntos por jornada jugada), solo en desktop.
- Encima del ranking va un **podio TOP 3**. Debajo, una banda de **ZONA DE MISERIA** (últimos 10).

---

## 1. Paleta (exacta)

Estética: "sala de mando imperial nocturna" + marquesina de bombillas doradas (sale del logo). Fondo **cálido casi negro**, NO verde oliva.

| Rol | Hex |
|---|---|
| Fondo base | `#0e1016` |
| Panel | `#161b27` |
| Panel alt | `#1c2231` |
| Oro (primario) | `#e7b656` |
| Oro brillante | `#f7d684` |
| Oro apagado | `#a9843c` |
| Verde (acento Becario / subidas) | `#46b884` |
| Crema (texto principal) | `#ece3d2` |
| Texto suave | `#bfb6a3` |
| Texto mute | `#8a8170` |
| Rojo miseria / bajadas | `#dd5d42` |
| Hairline | `rgba(255,255,255,0.06)` |
| Línea dorada | `rgba(231,182,86,0.16–0.5)` |

Glows: radial dorado arriba del fondo `radial-gradient(120% 80% at 50% -18%, rgba(231,182,86,0.16), transparent 62%)`.
Botón/medalla/chip activo dorado: `linear-gradient(160deg,#f7d684,#d2a23f)` con texto `#1a1205`.

---

## 2. Tipografía (3 familias, Google Fonts)

```
Space Mono  (400,700)            — marca, titulares, cifras, etiquetas técnicas
Archivo     (400,500,600,700,800) — datos / UI (nombres, botones)
Spectral    (ital 500/600)        — proclamas imperiales / voz de Pako (cursiva)
```

- Marca "MEGAPORRA": Space Mono 700, 25px, `letter-spacing:2px`, color `#f7d684`, `text-shadow:0 0 14px rgba(231,182,86,.45)`. Debajo "C O R P O R A T I O N" Space Mono 10.5px `letter-spacing:5.5px` color `#b08a3e`.
- Nombres de apostante: Archivo 600 (700 si TOP3), 15.5px.
- Puntos: Space Mono 700, tabular, dorado.
- Textos de "crónica": Spectral itálica.

---

## 3. Anatomía de pantalla

### Header (sticky)
1. Tira de **bombillas de marquesina** (9px): `radial-gradient(circle at center, #f7d684 0 1.7px, rgba(247,214,132,.18) 2.1px, transparent 2.7px); background-size:21px 100%; filter:drop-shadow(0 0 3px rgba(247,214,132,.55))`.
2. Fila marca: **foto circular de Pako** (48px, borde oro `2px`, glow) + wordmark MEGAPORRA / CORPORATION. A la derecha badge `LA MÁS AMBICIOSA EDICIÓN`.
3. Subtítulo Space Mono: `QUINIELA IMPERIAL · MUNDIAL 2026 · EE.UU · MÉXICO · CANADÁ`.
4. **Tabs** segmentados: `LA CLASIFICACIÓN` | `BÚSCATE` (activo = gradiente dorado).

### Vista 1 — LA CLASIFICACIÓN
- **Rail de jornadas**: chips horizontales con scroll. Jugadas = clicables; futuras = `—` atenuadas. La jornada actual se mantiene visible (auto-scroll a la derecha). Chip activo dorado con tag `AHORA`.
- **Podio TOP 3**: grid de 3 tarjetas (`minmax(150px,1fr)`). #1 con fondo dorado translúcido y glow; medalla circular (oro `#f7d684` / plata `#d7dbe2` / bronce `#cd9351`). Encima: línea Spectral *"Bajo la atenta mirada del caudillo Pako Porras…"* con mini-foto de Pako.
- **Lista ranking** (tarjeta con borde dorado, una fila por apostante):
  - `borderLeft:3px` dorado si TOP3, rojo si miseria, transparente resto. Fondo alterno sutil.
  - **Badge POS** circular (oro relleno si TOP3, borde rojo si miseria, chip oscuro resto).
  - **Flecha evolución** vs jornada anterior: ▲ verde / ▼ rojo / = mute.
  - **Nombre** + (2ª línea opcional) **micro-tag gamificado** (ver §5).
  - **Sparkline** 4 barras (solo desktop), con `title` "Jornada N · X pts".
  - **Puntos** Space Mono dorado.
  - Click en fila → abre esa persona en BÚSCATE.
  - Filtro por nombre arriba (independiente del buscador de BÚSCATE).
- **Banda ZONA DE MISERIA** antes de los últimos 10: rojo, con **foto de Madre** + *"Vigilada por Madre desde el terrado, trampa para ratas cebada."*
- **Sello de actualización** (Becario): borde verde discontinuo + foto del Becario + *"El Becario actualizó el marcador el 14·06·2026 tras varias horas frente al HAL200."*

### Vista 2 — BÚSCATE
- Caja imperial: foto de **Pamela** + `DEPARTAMENTO DE RECLAMACIONES · PAMELA`, titular Space Mono *"Localiza tu miserable posición en el Imperio"*, input grande con autocompletado (acento-insensible) y chips de ejemplo.
- Al seleccionar, **dossier**:
  1. **Banner** con tag de tramo, `#POS` gigante (Space Mono 46px) + nombre + "de N apostantes · X pts". Color del banner según tramo (oro/rojo/neutro).
  2. **Veredicto** (foto de Pako): título Spectral 600 dorado + cuerpo Spectral itálico + firma *"— Crónica firmada por el caudillo Pako Porras"*. Textos 100% offline, deterministas por posición (ver §5).
  3. **Dos tarjetas**: `PARA SALTAR AL PODIO → X pts` y `COLCHÓN ANTE LA MISERIA → X pts` (con subtítulo).
  4. **TUS PRÓXIMAS APUESTAS** (foto del Becario, borde verde): tarjetas de los próximos partidos con placeholders `POR DEFINIR` / `TU APUESTA: —` (pendiente de datos de pronósticos).
  5. **QUIÉN TE RODEA EN EL ESCALAFÓN**: 3 por encima + tú + 3 por debajo, con diferencia de puntos (+/−). Tú resaltado en oro.
  6. Nota final con foto de Pamela: *"Reclamación despachada por Pamela…"*

---

## 4. Los 4 personajes (avatares de autoridad, NO decoración)

Fotos en `assets/` (`pako.jpeg`, `becario.jpeg`, `madre.jpeg`, `pamela.jpeg`), siempre **círculo, `object-fit:cover`, borde de color**:
- **Pako Porras** — preside el header y firma los veredictos. `object-position:50% 30%`, borde oro.
- **El Becario** — sello de actualización + sección de próximas apuestas. Borde verde.
- **Madre** — guarda la ZONA DE MISERIA. Borde rojo. `object-position:50% 38%`.
- **Pamela** — recepción de BÚSCATE + nota de reclamaciones. Borde oro. `object-position:50% 26%`.

---

## 5. Tono de voz + textos gamificados (deterministas, sin IA)

Registro: crónica colonial absurda, imperial, grandilocuente. **Castellano.** Nada se conecta a ninguna IA: los textos son fijos y se eligen por posición con `pos % variantes`, con umbrales relativos a `n` (siguen funcionando según avanza el Mundial).

**Micro-tags en la lista** (2ª línea, solo cerca de una frontera):
- #1: `manda en el Imperio con mano de hierro`
- TOP3: `a X pts del trono`
- Persiguiendo podio (≤8 pts): `a X pts de tocar la gloria` / `a X pts de oler el bronce` / `el podio a tiro de X pts`
- Al borde de miseria (≤6 pts): `a X pts de cenar nutria con Madre` / `a X pts del precipicio imperial` / `Madre afila la trampa: X pts`
- En miseria: `Madre ya calienta el estofado` / `solidaridad imperial (más bien poca)` / `polvo, escombro y deshonra` / `el HAL200 ni se molesta en registrarte`

**Veredictos BÚSCATE** por tramo (con 2 variantes cada uno) — ver función `verdict()` en el archivo:
`pos===1` → EL CAUDILLO EN PERSONA · `pos<=3` → PODIO IMPERIAL · `pos<=15%` → CORTESANO DE CONFIANZA · `pos<=50%` → SÚBDITO CORRIENTE · `pos<=n-10` → CARNE DE CAÑÓN · resto → ZONA DE MISERIA.

---

## 6. Reglas de datos
- Fuente: CSV (Google Sheets). Columnas vacías (partidos no jugados) = `—`, **nunca 0**.
- Ranking por puntos totales, **competition ranking** (empates comparten posición: 1, 2, 2, 2, 5…).
- Flecha de evolución = comparar el ranking acumulado de la jornada con el de la anterior.
- Mobile-first, responsive. El sparkline se oculta en móvil.
