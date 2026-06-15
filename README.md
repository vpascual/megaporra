# LA MEGAPORRA — Clasificación Interactiva

> *"El becario lleva meses puliendo el sistema. Una joya que colmará todas vuestras más elevadas expectativas."*
> — Pako Porras, Caudillo y Organizador Supremo

---

## ¿Qué es esto?

La **Megaporra** es el evento apostante más importante del hemisferio occidental. 194 almas participantes, un Excel gestionado con mano de hierro por el caudillo Pako Porras, y un sistema de visualización que el becario ha construido con sus propias manos temblorosas para que los súbditos puedan consultar la clasificación en tiempo real sin tener que enviarle mensajes al WhatsApp a las 3 de la mañana.

Esta aplicación web muestra la **clasificación general por jornada**, la **evolución de cada participante** a lo largo del torneo, y permite a cualquier megaporrero encontrar su miserable posición en el ranking con solo escribir su alias.

Stack: **Vue 3 + Vite**, desplegado en **Vercel**, sin base de datos ni backend. Todo el peso recae sobre una Google Sheet pública y los hombros del becario.

---

## Fuente de datos

Los puntos los calcula el caudillo. Esta aplicación no recalcula nada. Se limita a importar y visualizar lo que Pako Porras ha dictaminado en su Excel soberano.

Los datos se leen en cada carga de página desde una **Google Sheet pública exportada como CSV**:

```
https://docs.google.com/spreadsheets/d/1mBLMjjyqSm5E7pnq2G4hJVSJuJJDl3lYrJfuC43diHo/export?format=csv&gid=0
```

Para actualizar la clasificación, el organizador actualiza la Google Sheet y la app refleja los cambios automáticamente en la siguiente carga. Sin deploys. Sin intervención del becario. Tal como debe ser.

---

## Formato del CSV

El CSV tiene **3 filas de cabecera** seguidas de una fila por participante. El becario ha sufrido lo indecible para que el parser lo entienda, así que respetad la estructura o las consecuencias serán vuestras.

### Fila 0 — Etiquetas de jornada

```
NOMBRE | JORNADA 1 | JORNADA 1 | JORNADA 2 | JORNADA 3 | ... | TOTAL
```

Algunas jornadas ocupan **múltiples columnas** (sub-columnas por fase). El parser las agrupa por fill-forward: todas las columnas contiguas sin nueva etiqueta pertenecen a la misma jornada y sus valores se suman.

### Fila 1 — Fase

```
       | FASE GRUPOS | FASE GRUPOS | OCTAVOS | CUARTOS | ...
```

La palabra `EXTRES` actúa como señal de parada: todo lo que venga después se ignora.

### Fila 2 — Fecha y marcador TOTAL

```
       | 11/06/2026  | 11/06/2026  | ...     |         | TOTAL
```

La columna marcada con `TOTAL` es la puntuación acumulada final del participante.

### Filas 3+ — Participantes

```
Victorako | 7 | 9 | 12 | null | ... | 134
```

Cada fila es un participante. El primer campo es el alias. Los campos vacíos (`null`) indican jornadas no jugadas aún. El último campo es el total.

### Ejemplo mínimo válido

```csv
NOMBRE,JORNADA 1,JORNADA 1,JORNADA 2,TOTAL
,FASE GRUPOS,FASE GRUPOS,OCTAVOS,
,11/06/2026,12/06/2026,13/06/2026,TOTAL
Victorako,7,9,12,28
BATCUEVA,5,,8,13
OJETE,,,3,3
```

---

## Cómo correr el proyecto localmente

El becario lo tiene en su Spectrum 128K pero para el resto de mortales:

```bash
npm install
npm run dev       # servidor en localhost:5173
npm run build     # build de producción → dist/
npm run preview   # previsualizar dist/ localmente
```

No hay linter. No hay tests. Hay fe.

---

## Arquitectura

Toda la aplicación vive en **`src/App.vue`**. Sin sub-componentes. Sin CSS framework. Sin pretensiones.

- **`src/utils/csvParser.js`** — fetcha el CSV y devuelve `{ players, jornadas, lastPlayed }`
- **`src/router/index.js`** — hash routing (`#/` y `#/participant/:id`), sin `<router-view>`
- **`public/assets/`** — fotos de los personajes (Pako, el becario, madre, Pamela)

El sistema de ranking se recalcula en cliente al mover el slider de jornada. Las flechas de evolución comparan el ranking de la jornada actual con la anterior.

Dos vistas:
- **Clasificación** (`#/`) — ranking completo con sparklines de evolución
- **Búscate** (`#/participant/:alias`) — dossier individual con veredicto corporativo

---

## Despliegue

La app se despliega automáticamente en **Vercel** desde la rama `main`.

```
main → Vercel (producción)
staging → revisión previa
```

**Nunca commitear directamente a `main`.** Todo pasa por `staging` primero. El becario aprendió esto por las malas.

El fichero `vercel.json` incluye un catch-all rewrite a `index.html` para que el routing por hash funcione correctamente.

Para conectar el repo: Vercel Dashboard → Import Project → GitHub → rama `main`.

---

## Personajes

| Foto | Personaje | Rol |
|---|---|---|
| `/assets/pako.jpeg` | Pako Porras | Caudillo. Calcula los puntos en Excel. Narra las crónicas en tono imperial. |
| `/assets/becario.jpeg` | El Becario | Gestiona el HAL200. Recibe las tareas más degradantes. Mantiene el CSV actualizado. |
| `/assets/madre.jpeg` | Madre | Octogenaria fumadora semiciega. Elemento caótico incontrolable. Cose estofados de nutria. |
| `/assets/pamela.jpeg` | Pamela | Administrativa gallega. Traduce desastrosamente. Despacha reclamaciones sin miramientos. |

---

## Contacto

Las reclamaciones se envían a Pamela, que las despachará sin miramientos desde la sede corporativa en Philadelphia.

El blog oficial de la corporación, con crónicas de jornada y clasificaciones en PDF: [megaporra.wordpress.com](https://megaporra.wordpress.com)

---

*Megaporra Corporation · 25th Edition · EUA-Canadá-México 2026*