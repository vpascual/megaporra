<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { fetchData } from './utils/csvParser.js'
const PAKO    = '/assets/pako.jpeg'
const BECARIO = '/assets/becario.jpeg'
const MADRE   = '/assets/madre.jpeg'
const PAMELA  = '/assets/pamela.jpeg'

// ─── router ──────────────────────────────────────────────────────────────────
const router = useRouter()
const route  = useRoute()

// ─── state ───────────────────────────────────────────────────────────────────
const view         = ref('clasificacion')
const jornadaNum   = ref(1)
const query        = ref('')
const filter       = ref('')
const selectedName = ref(null)
const isMobile     = ref(false)
const players      = ref([])
const jornadas     = ref([])
const lastPlayed   = ref(1)
const loading      = ref(true)
const error        = ref(null)
const railEl       = ref(null)
const sparkTip     = ref({ show: false, x: 0, y: 0, text: '' })

// ─── helpers ─────────────────────────────────────────────────────────────────
function onSparkEnter(evt, text) { sparkTip.value = { show: true, x: evt.clientX, y: evt.clientY, text } }
function onSparkMove(evt) { sparkTip.value.x = evt.clientX; sparkTip.value.y = evt.clientY }
function onSparkLeave() { sparkTip.value.show = false }

function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function cumScore(scores, u) {
  let s = 0
  for (let i = 0; i < u && i < scores.length; i++) {
    if (scores[i] != null) s += scores[i]
  }
  return s
}

function computeRanking(u) {
  const arr = players.value.map((d, i) => ({
    name: d.name, scores: d.scores,
    pts: cumScore(d.scores, u), idx: i,
  }))
  arr.sort((a, b) => b.pts - a.pts || a.idx - b.idx)
  let lp = null, lr = 0
  arr.forEach((e, i) => {
    if (e.pts === lp) { e.pos = lr }
    else { e.pos = i + 1; lr = i + 1; lp = e.pts }
  })
  return arr
}

// Deterministic verdicts — 100% offline, no AI, texts chosen by pos % variants
function verdict(pos, n) {
  const pick = a => a[pos % a.length]
  if (pos === 1) return {
    tag: 'EL CAUDILLO EN PERSONA',
    title: 'Encabezas el marcador con autoridad imperial.',
    body: pick([
      'Los demás, lamiendo el polvo de tus botas. Disfruta de la cima — el Mundial es largo y la gloria, traicionera.',
      'El Becario ha enmarcado tu alias y Pamela rechaza ya, de oficio, cualquier reclamación presentada contra ti.',
    ]),
  }
  if (pos <= 3) return {
    tag: 'PODIO IMPERIAL',
    title: 'Respiras el aire enrarecido de la cumbre.',
    body: pick([
      'A un solo traspié del trono. El caudillo te observa con algo sospechosamente parecido al respeto. No lo estropees.',
      'Hueles el metal de las medallas. Sonríe para la foto oficial antes de que todo, inevitablemente, se tuerza.',
    ]),
  }
  if (pos <= Math.ceil(n * 0.15)) return {
    tag: 'CORTESANO DE CONFIANZA',
    title: 'Cabalgas en la vanguardia del ejército apostante.',
    body: pick([
      'Tu posición honra a la Corporación. Mantén el pulso firme y la mirada clavada en el podio.',
      'El caudillo te incluiría en su séquito de aduladores de confianza. Viniendo de él, es casi una condecoración.',
    ]),
  }
  if (pos <= Math.ceil(n * 0.5)) return {
    tag: 'SÚBDITO CORRIENTE',
    title: 'Sobrevives en la dorada medianía del Imperio.',
    body: pick([
      'Ni gloria ni miseria: la tibieza de quien aún no ha jurado lealtad a bando alguno. El caudillo apenas recuerda tu alias.',
      'Una posición tan razonable como olvidable. El HAL200 te tiene registrado, pero en letra muy pequeña.',
    ]),
  }
  if (pos <= n - 10) return {
    tag: 'CARNE DE CAÑÓN',
    title: 'Te arrastras por los suburbios de la clasificación.',
    body: pick([
      'No es aún la deshonra absoluta, pero Madre ya te vigila desde el terrado. Reacciona antes de que cebe la trampa.',
      'Cada jornada te empuja un palmo más hacia el precipicio. Pamela ya tiene a mano tu carpeta de reclamaciones.',
    ]),
  }
  return {
    tag: 'ZONA DE MISERIA',
    title: 'Habitas el fango de los últimos diez.',
    body: pick([
      'Te transmitimos toda nuestra solidaridad imperial, que no es mucha. Madre te ha reservado un plato de su estofado de nutria. No se conoce escapatoria.',
      'El sótano del Imperio luce tu nombre en la puerta. Madre ha cebado la trampa para ratas y el Becario ha dejado de actualizar tu casilla, por pura lástima.',
    ]),
  }
}

// ─── computed ─────────────────────────────────────────────────────────────────
const cur  = computed(() => computeRanking(jornadaNum.value))
const prev = computed(() => jornadaNum.value > 1 ? computeRanking(jornadaNum.value - 1) : null)
const pmap = computed(() => {
  const m = {}
  if (prev.value) prev.value.forEach(e => { m[e.name] = e.pos })
  return m
})
const n             = computed(() => cur.value.length)
const miseryStart   = computed(() => n.value > 10 ? n.value - 10 : -1)
const top3pts       = computed(() => cur.value[2] ? cur.value[2].pts : 0)
const miseryTopPts  = computed(() => miseryStart.value >= 0 && cur.value[miseryStart.value] ? cur.value[miseryStart.value].pts : 0)

const phaseLabel = computed(() => {
  const j = jornadas.value.find(j => j.n === jornadaNum.value)
  if (!j) return ''
  return j.phase.replace(/\s*\(\d+\)/, '').replace('FASE GRUPOS', 'Fase de Grupos')
})

// jornada rail chips
const jornadasRail = computed(() => jornadas.value.map(j => {
  const played = j.n <= lastPlayed.value
  const active = j.n === jornadaNum.value
  return { ...j, played, active }
}))

// ranking rows
const filteredRows = computed(() => {
  const fq = norm(filter.value)
  const list = fq.length >= 1 ? cur.value.filter(e => norm(e.name).includes(fq)) : cur.value
  const p1 = cur.value[0] ? cur.value[0].pts : 0

  return list.map(e => {
    const idx = cur.value.indexOf(e)
    const top = e.pos <= 3
    const mis = miseryStart.value >= 0 && idx >= miseryStart.value

    // evolution arrow
    let arrow = '·', arrowColor = '#766f5f'
    if (prev.value) {
      const pp = pmap.value[e.name]
      if (pp != null) {
        const d = pp - e.pos
        if (d > 0) { arrow = '▲'; arrowColor = '#46b884' }
        else if (d < 0) { arrow = '▼'; arrowColor = '#dd5d42' }
        else { arrow = '='; arrowColor = '#766f5f' }
      } else { arrow = '+'; arrowColor = '#e7b656' }
    }

    // micro-tag
    let tag = null, tagColor = '#8a8170'
    if (e.pos === 1) {
      tag = 'manda en el Imperio con mano de hierro'; tagColor = '#f7d684'
    } else if (top) {
      const dt = p1 - e.pts
      tag = dt <= 0 ? 'empatado con el mismísimo trono' : `a ${dt} pts del trono`; tagColor = '#f7d684'
    } else if (!mis) {
      const dPod = top3pts.value - e.pts, dMis = e.pts - miseryTopPts.value
      if (dPod > 0 && dPod <= 8) {
        tag = [`a ${dPod} pts de tocar la gloria`, `a ${dPod} pts de oler el bronce`, `el podio a tiro de ${dPod} pts`][e.pos % 3]
        tagColor = '#f7d684'
      } else if (dMis >= 0 && dMis <= 6) {
        tag = [`a ${dMis} pts de cenar nutria con Madre`, `a ${dMis} pts del precipicio imperial`, `Madre afila la trampa: ${dMis} pts`][e.pos % 3]
        tagColor = '#dd5d42'
      }
    } else {
      tag = ['Madre ya calienta el estofado', 'solidaridad imperial (más bien poca)', 'polvo, escombro y deshonra', 'el HAL200 ni se molesta en registrarte'][e.pos % 4]
      tagColor = '#dd5d42'
    }

    // sparkline bars (played jornadas only)
    const spark = e.scores.slice(0, lastPlayed.value).map((sc, si) => ({
      h: Math.max(0, Math.round(((sc ?? 0) / 24) * 100)),
    }))
    const sparkTooltip = e.scores.slice(0, lastPlayed.value)
      .map((sc, si) => `J${si + 1}: ${sc == null ? '—' : sc + ' pts'}`)
      .join(' · ')

    return {
      name: e.name, pos: e.pos, pts: e.pts,
      top, mis, arrow, arrowColor, tag, tagColor, spark, sparkTooltip,
      isMiseryStart: fq.length < 1 && idx === miseryStart.value,
    }
  })
})

// búscate
const suggestions = computed(() => {
  if (view.value !== 'buscate' || query.value.length < 1) return []
  if (selectedName.value && norm(selectedName.value) === norm(query.value)) return []
  const sq = norm(query.value)
  return cur.value.filter(e => norm(e.name).includes(sq)).slice(0, 7)
})

const mePlayer = computed(() => {
  if (!selectedName.value) return null
  const i = cur.value.findIndex(e => e.name === selectedName.value)
  if (i < 0) return null
  const e  = cur.value[i]
  const inTop3 = e.pos <= 3
  const inMis  = miseryStart.value >= 0 && i >= miseryStart.value
  const v      = verdict(e.pos, n.value)

  const lo = Math.max(0, i - 3), hi = Math.min(n.value - 1, i + 3)
  const neighbors = []
  for (let k = lo; k <= hi; k++) {
    const x = cur.value[k], meRow = k === i, d = x.pts - e.pts
    const spark = x.scores.slice(0, lastPlayed.value).map(sc => ({
      h: Math.max(0, Math.round(((sc ?? 0) / 24) * 100)),
    }))
    neighbors.push({
      posLabel: '#' + x.pos, name: x.name, pts: x.pts, meRow, ab: k < i,
      deltaLabel: meRow ? '◆ TÚ' : (d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '='),
      deltaColor: meRow ? '#f7d684' : (k < i ? '#46b884' : '#dd5d42'),
      spark,
    })
  }

  const top3Gap    = top3pts.value - e.pts
  const cushionPts = e.pts - miseryTopPts.value

  return {
    name: e.name, pos: e.pos, pts: e.pts, n: n.value,
    inTop3, inMis, vtag: v.tag, vtitle: v.title, vbody: v.body,
    top3Label:   inTop3 ? 'EN EL PODIO'    : top3Gap + ' pts',
    top3Sub:     inTop3 ? 'ya reinas en la cumbre'     : 'para asaltar el podio imperial',
    cushionLabel: inMis ? '¡DENTRO!'       : cushionPts + ' pts',
    cushionSub:   inMis ? 'Madre ya te tiene fichado'  : 'antes de hundirte en la miseria',
    top3Color:    inTop3 ? '#46b884' : '#f7d684',
    cushionColor: inMis  ? '#dd5d42' : '#ece3d2',
    bannerBg:     inTop3 ? 'linear-gradient(150deg,rgba(231,182,86,.22),rgba(231,182,86,.05))' : inMis ? 'linear-gradient(150deg,rgba(221,93,66,.22),rgba(221,93,66,.04))' : 'linear-gradient(150deg,#1c2231,#161b27)',
    bannerBorder: inTop3 ? 'rgba(231,182,86,.5)' : inMis ? 'rgba(221,93,66,.5)' : 'rgba(255,255,255,.1)',
    bannerColor:  inTop3 ? '#f7d684' : inMis ? '#dd5d42' : '#ece3d2',
    neighbors,
  }
})

const examples = computed(() => {
  if (!cur.value.length) return []
  return [cur.value[0], cur.value[Math.floor(n.value * 0.5)], cur.value[n.value - 1]].filter(Boolean)
})

const noResults = computed(() => filter.value.length >= 1 && filteredRows.value.length === 0)
const showSpark  = computed(() => !isMobile.value && players.value.length > 0)

// today stamp
const today = new Date()
const todayStr = `${String(today.getDate()).padStart(2,'0')}·${String(today.getMonth()+1).padStart(2,'0')}·${today.getFullYear()}`

// ─── rail scroll ─────────────────────────────────────────────────────────────
function scrollRail() {
  nextTick(() => {
    if (!railEl.value) return
    const chip = railEl.value.children[jornadaNum.value - 1]
    if (!chip) return
    chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  })
}
watch(jornadaNum, scrollRail)

// ─── route sync ──────────────────────────────────────────────────────────────
watch(
  () => route.params.id,
  (id) => {
    if (id) {
      const name = decodeURIComponent(id)
      view.value = 'buscate'
      selectedName.value = name
      query.value = name
    } else if (route.path === '/') {
      view.value = 'clasificacion'
      selectedName.value = null
    }
  },
  { immediate: true },
)

// ─── lifecycle ────────────────────────────────────────────────────────────────
async function load() {
  try {
    loading.value = true; error.value = null
    const data = await fetchData()
    players.value  = data.players
    jornadas.value = data.jornadas
    lastPlayed.value = data.lastPlayed
    jornadaNum.value = data.lastPlayed
    await nextTick()
    scrollRail()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  isMobile.value = window.innerWidth < 760
  const rz = () => { isMobile.value = window.innerWidth < 760 }
  window.addEventListener('resize', rz)
  onUnmounted(() => window.removeEventListener('resize', rz))
})

// ─── actions ──────────────────────────────────────────────────────────────────
function selectJornada(j) { if (j.played) jornadaNum.value = j.n }
function goClas() { view.value = 'clasificacion'; selectedName.value = null; router.push('/') }
function goBusca() { view.value = 'buscate'; selectedName.value = null; query.value = '' }
function openBuscate(name) { router.push('/participant/' + encodeURIComponent(name)) }
function onQuery(e) { query.value = e.target.value; selectedName.value = null }
function onFilter(e) { filter.value = e.target.value }
function onSearchKey(e) {
  if (e.key === 'Enter' && suggestions.value.length) {
    router.push('/participant/' + encodeURIComponent(suggestions.value[0].name))
  }
}
function selectSugg(s) { router.push('/participant/' + encodeURIComponent(s.name)) }
function selectNeighbor(nb) { if (!nb.meRow) router.push('/participant/' + encodeURIComponent(nb.name)) }
</script>

<template>
<div style="min-height:100vh; background:#0e1016; color:#ece3d2; font-family:Archivo,system-ui,sans-serif; position:relative; overflow-x:hidden;">

  <!-- background glows -->
  <div style="position:fixed; top:0; left:0; right:0; height:55vh; pointer-events:none; z-index:0; background:radial-gradient(120% 80% at 50% -18%, rgba(231,182,86,0.16), rgba(231,182,86,0.04) 38%, transparent 62%);"></div>
  <div style="position:fixed; inset:0; pointer-events:none; z-index:0; opacity:.5; background:linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.5));"></div>

  <!-- ═══ HEADER ═══ -->
  <header style="position:sticky; top:0; z-index:50; background:rgba(15,18,26,0.86); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid rgba(231,182,86,0.18);">
    <!-- marquee lights -->
    <div style="height:9px; background:radial-gradient(circle at center, #f7d684 0 1.7px, rgba(247,214,132,0.18) 2.1px, transparent 2.7px); background-size:21px 100%; filter:drop-shadow(0 0 3px rgba(247,214,132,0.55)); animation:mpGlow 3.2s ease-in-out infinite;"></div>

    <div style="max-width:1120px; margin:0 auto; padding:14px 18px 0;">
      <!-- brand row -->
      <div style="display:flex; align-items:center; gap:14px; justify-content:space-between; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:13px; min-width:0;">
          <img :src="PAKO" alt="Pako Porras"
               style="width:48px; height:48px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:2px solid #e7b656; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); flex:0 0 auto;">
          <div style="min-width:0;">
            <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:25px; letter-spacing:2px; line-height:1; color:#f7d684; text-shadow:0 0 14px rgba(231,182,86,0.45);">MEGAPORRA</div>
            <div style="font-family:'Space Mono',monospace; font-weight:400; font-size:10.5px; letter-spacing:5.5px; color:#b08a3e; margin-top:3px;">C O R P O R A T I O N</div>
          </div>
        </div>
        <div>
          <div style="font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:1.6px; color:#b08a3e; font-weight:700;">LA MÁS AMBICIOSA EDICIÓN</div>
        </div>
      </div>

      <div style="font-family:'Space Mono',monospace; font-size:10.5px; letter-spacing:2.2px; color:#8a8170; margin-top:9px;">QUINIELA IMPERIAL · MUNDIAL 2026 · EE.UU · MÉXICO · CANADÁ</div>

      <!-- tabs -->
      <div style="display:flex; gap:8px; margin:13px 0 14px;">
        <div @click="goClas"
             :style="`flex:1 1 0; padding:${isMobile?'12px 6px':'13px 16px'}; text-align:center; cursor:pointer; font-family:'Space Mono',monospace; font-weight:700; font-size:${isMobile?'11.5px':'13px'}; letter-spacing:1.5px; border-radius:10px; white-space:nowrap; ${view==='clasificacion' ? 'background:linear-gradient(160deg,#f7d684,#d2a23f); color:#1a1205; box-shadow:0 3px 14px rgba(231,182,86,0.3);' : 'background:transparent; color:#8a8170; border:1px solid rgba(231,182,86,0.18);'}`">
          LA CLASIFICACIÓN
        </div>
        <div @click="goBusca"
             :style="`flex:1 1 0; padding:${isMobile?'12px 6px':'13px 16px'}; text-align:center; cursor:pointer; font-family:'Space Mono',monospace; font-weight:700; font-size:${isMobile?'11.5px':'13px'}; letter-spacing:1.5px; border-radius:10px; white-space:nowrap; ${view==='buscate' ? 'background:linear-gradient(160deg,#f7d684,#d2a23f); color:#1a1205; box-shadow:0 3px 14px rgba(231,182,86,0.3);' : 'background:transparent; color:#8a8170; border:1px solid rgba(231,182,86,0.18);'}`">
          BÚSCATE
        </div>
      </div>
    </div>
  </header>

  <!-- ═══ MAIN ═══ -->
  <main style="position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:20px 18px 60px;">

    <!-- loading -->
    <div v-if="loading" style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:16px; padding:60px 20px;">
      <img :src="BECARIO" style="width:54px; height:54px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:2px solid #46b884; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); animation:mpSpot 2s ease-in-out infinite;">
      <div style="font-family:'Spectral',serif; font-style:italic; font-size:16px; color:#bfb6a3;">El Becario está interrogando al HAL200. Aguardad, fauna variada…</div>
    </div>

    <!-- error -->
    <div v-else-if="error" style="padding:30px; border:1px solid rgba(221,93,66,0.3); border-radius:14px; background:#161b27; text-align:center;">
      <div style="font-family:'Space Mono',monospace; font-size:12px; letter-spacing:1px; color:#dd5d42; margin-bottom:12px;">ERROR DE TRANSMISIÓN</div>
      <div style="font-family:'Spectral',serif; font-style:italic; color:#bfb6a3; margin-bottom:16px;">{{ error }}</div>
      <button @click="load" style="background:linear-gradient(160deg,#f7d684,#d2a23f); color:#1a1205; border:none; border-radius:8px; padding:10px 20px; font-family:'Space Mono',monospace; font-weight:700; font-size:12px; letter-spacing:1px; cursor:pointer;">REINTENTAR</button>
    </div>

    <!-- ═══ CLASIFICACIÓN ═══ -->
    <div v-else-if="view === 'clasificacion'">

      <!-- jornada rail -->
      <div style="margin-bottom:18px;">
        <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:9px;">
          <div style="font-family:'Space Mono',monospace; font-size:11px; letter-spacing:2px; color:#8a8170;">DESPLIEGUE POR JORNADAS</div>
          <div style="font-family:'Space Mono',monospace; font-size:11px; letter-spacing:1px; color:#b08a3e;">{{ phaseLabel }}</div>
        </div>
        <div ref="railEl" style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px; scrollbar-width:thin;">
          <div v-for="j in jornadasRail" :key="j.n"
               @click="selectJornada(j)"
               :style="`flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; min-width:54px; height:56px; padding:0 12px; border-radius:11px; cursor:${j.played?'pointer':'not-allowed'}; font-family:'Space Mono',monospace; background:${j.active?'linear-gradient(160deg,#f7d684,#d2a23f)':j.played?'rgba(255,255,255,0.05)':'transparent'}; border:1px solid ${j.active?'transparent':j.played?'rgba(231,182,86,0.22)':'rgba(255,255,255,0.06)'}; color:${j.active?'#1a1205':j.played?'#ece3d2':'#8a8170'}; box-shadow:${j.active?'0 3px 14px rgba(231,182,86,0.32)':'none'}; opacity:${j.played?1:0.5};`">
            <span style="font-size:8.5px; letter-spacing:1.5px; opacity:.7;">JOR</span>
            <span style="font-size:17px; font-weight:700; line-height:1;">{{ j.n }}</span>
            <span style="font-size:8px; letter-spacing:.5px; opacity:.85;">{{ j.active ? 'AHORA' : (j.played ? j.dateTag : '—') }}</span>
          </div>
        </div>
      </div>

      <!-- podium -->
      <div style="margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:11px; margin-bottom:13px;">
          <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:14px; letter-spacing:2.5px; color:#f7d684;">EL PODIO DEL IMPERIO</div>
          <div style="flex:1; height:1px; background:linear-gradient(90deg,rgba(231,182,86,0.4),transparent);"></div>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
          <img :src="PAKO" style="width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:1.5px solid #e7b656; box-shadow:0 0 0 2px #0e1016, 0 0 10px rgba(231,182,86,.35);">
          <div style="font-family:'Spectral',serif; font-style:italic; font-size:13.5px; color:#bfb6a3;">Bajo la atenta mirada del caudillo Pako Porras y su séquito de aduladores.</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px;">
          <div v-for="(e, k) in cur.slice(0,3)" :key="e.name"
               :style="`position:relative; overflow:hidden; padding:15px 16px 16px; border-radius:14px; background:${k===0?'linear-gradient(165deg,rgba(231,182,86,0.18),rgba(231,182,86,0.03))':'#161b27'}; border:1px solid ${k===0?'rgba(231,182,86,0.5)':'rgba(255,255,255,0.09)'};`">
            <div :style="`position:absolute; top:-30px; right:-20px; width:120px; height:120px; border-radius:50%; background:radial-gradient(circle, ${['#f7d684','#d7dbe2','#cd9351'][k]}33, transparent 70%); pointer-events:none; animation:mpSpot 4s ease-in-out infinite;`"></div>
            <div style="position:relative; display:flex; align-items:center; justify-content:space-between;">
              <div :style="`width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Mono',monospace; font-weight:700; font-size:14px; color:#1a1205; background:${['#f7d684','#d7dbe2','#cd9351'][k]}; box-shadow:0 2px 10px ${['#f7d684','#d7dbe2','#cd9351'][k]}66;`">{{ e.pos }}</div>
              <div style="font-family:'Space Mono',monospace; font-size:8.5px; letter-spacing:1.5px; color:#8a8170;">{{ ['CAMPEÓN PROVISIONAL','SUBCAMPEÓN','MEDALLA DE BRONCE'][k] }}</div>
            </div>
            <div :style="`position:relative; font-family:Archivo; font-weight:800; font-size:${k===0?'19px':'17px'}; color:${k===0?'#f7d684':'#ece3d2'}; margin-top:11px; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`">{{ e.name }}</div>
            <div style="position:relative; display:flex; align-items:baseline; gap:5px; margin-top:3px;">
              <span :style="`font-family:'Space Mono',monospace; font-weight:700; font-size:${k===0?'30px':'25px'}; color:${['#f7d684','#d7dbe2','#cd9351'][k]}; line-height:1;`">{{ e.pts }}</span>
              <span style="font-family:'Space Mono',monospace; font-size:11px; color:#8a8170;">pts</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ranking list -->
      <div style="margin-top:22px; border:1px solid rgba(231,182,86,0.16); border-radius:14px; overflow:hidden; background:rgba(19,24,34,0.6);">
        <!-- list header -->
        <div style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-bottom:1px solid rgba(231,182,86,0.16); background:#161b27;">
          <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:13px; letter-spacing:1.5px; color:#f7d684; flex:0 0 auto;">CLASIFICACIÓN GENERAL</div>
          <div style="font-family:'Space Mono',monospace; font-size:10px; color:#8a8170; flex:0 0 auto;">· {{ n }} apostantes</div>
          <div style="flex:1;"></div>
          <input :value="filter" @input="onFilter" placeholder="Filtrar nombre…"
                 style="background:#0e1016; border:1px solid rgba(231,182,86,0.22); color:#ece3d2; border-radius:8px; padding:8px 11px; font-size:13px; width:150px; outline:none;">
        </div>

        <!-- column headers -->
        <div style="display:flex; align-items:center; gap:14px; padding:8px 16px; border-bottom:1px solid rgba(255,255,255,0.06); font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:1.5px; color:#766f5f;">
          <span style="width:34px; text-align:center; flex:0 0 auto;">POS</span>
          <span style="width:18px; flex:0 0 auto;"></span>
          <span style="flex:1 1 auto;">APOSTANTE</span>
          <span v-if="showSpark" style="flex:0 0 auto; width:68px; text-align:center;">J1–J{{ lastPlayed }}</span>
          <span style="flex:0 0 auto; text-align:right; min-width:46px;">PTS</span>
        </div>

        <!-- rows -->
        <template v-for="row in filteredRows" :key="row.name">
          <!-- zona de miseria banner -->
          <div v-if="row.isMiseryStart"
               style="display:flex; align-items:center; gap:11px; padding:11px 16px; background:linear-gradient(90deg,rgba(221,93,66,0.18),rgba(221,93,66,0.02)); border-top:1px solid rgba(221,93,66,0.35); border-bottom:1px solid rgba(221,93,66,0.25);">
            <img :src="MADRE" style="width:30px; height:30px; border-radius:50%; object-fit:cover; object-position:50% 38%; border:1.5px solid #dd5d42; box-shadow:0 0 0 2px #0e1016, 0 0 10px rgba(221,93,66,.35); flex:0 0 auto;">
            <div>
              <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:11px; letter-spacing:1.5px; color:#dd5d42;">ZONA DE MISERIA · LOS ÚLTIMOS 10</div>
              <div style="font-family:'Spectral',serif; font-style:italic; font-size:12px; color:#b8a99c;">Vigilada por Madre desde el terrado, trampa para ratas cebada.</div>
            </div>
          </div>

          <!-- player row -->
          <div @click="openBuscate(row.name)"
               :style="`display:flex; align-items:center; gap:${isMobile?'10px':'14px'}; padding:${isMobile?'7px 12px':'8px 16px'}; min-height:${isMobile?54:58}px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.06); border-left:3px solid ${row.top?'#e7b656':row.mis?'#dd5d42':'transparent'}; background:${row.top?'linear-gradient(90deg,rgba(231,182,86,0.12),rgba(231,182,86,0.015))':row.mis?'linear-gradient(90deg,rgba(221,93,66,0.1),rgba(221,93,66,0.01))':filteredRows.indexOf(row)%2?'rgba(255,255,255,0.012)':'transparent'};`">

            <!-- position badge -->
            <div :style="`flex:0 0 auto; width:${isMobile?'30px':'34px'}; height:${isMobile?'30px':'34px'}; border-radius:50%; display:flex; align-items:center; justify-content:center; font-family:'Space Mono',monospace; font-weight:700; font-size:${isMobile?'12px':'13px'}; color:${row.top?'#1a1205':row.mis?'#dd5d42':'#bfb6a3'}; background:${row.top?'linear-gradient(160deg,#f7d684,#d2a23f)':'rgba(255,255,255,0.05)'}; border:${row.mis?'1.5px solid #dd5d42':row.top?'none':'1px solid rgba(255,255,255,0.08)'}; box-shadow:${row.top?'0 2px 10px rgba(231,182,86,0.4)':'none'};`">
              {{ row.pos }}
            </div>

            <!-- arrow -->
            <div :style="`flex:0 0 auto; width:18px; text-align:center; font-size:12px; color:${row.arrowColor}; font-family:'Space Mono',monospace;`">{{ row.arrow }}</div>

            <!-- name + tag -->
            <div style="flex:1 1 auto; min-width:0; display:flex; flex-direction:column; justify-content:center; gap:2px;">
              <div :style="`min-width:0; font-family:Archivo; font-weight:${row.top?700:600}; font-size:${isMobile?'14px':'15.5px'}; color:${row.top?'#f7d684':row.mis?'#e7b8ad':'#ece3d2'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; letter-spacing:0.1px;`">{{ row.name }}</div>
              <div v-if="row.tag" :style="`font-family:'Space Mono',monospace; font-size:${isMobile?'9.5px':'10.5px'}; font-weight:700; letter-spacing:0.2px; color:${row.tagColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`">{{ row.tag }}</div>
            </div>

            <!-- sparkline -->
            <div v-if="showSpark"
                 @mouseenter="e => onSparkEnter(e, row.sparkTooltip)"
                 @mousemove="onSparkMove"
                 @mouseleave="onSparkLeave"
                 style="display:flex; align-items:flex-end; gap:3px; height:28px; flex:0 0 auto; cursor:default;">
              <div v-for="(b, bi) in row.spark" :key="bi"
                   style="width:5px; height:26px; background:rgba(255,255,255,0.06); border-radius:2px; display:flex; align-items:flex-end; overflow:hidden;">
                <div :style="`width:100%; height:${b.h}%; background:linear-gradient(180deg,#f7d684,#c79433); border-radius:2px;`"></div>
              </div>
            </div>

            <!-- points -->
            <div :style="`flex:0 0 auto; font-family:'Space Mono',monospace; font-weight:700; font-size:${row.top?(isMobile?'17px':'20px'):(isMobile?'15px':'17px')}; color:${row.top?'#f7d684':'#e7b656'}; min-width:${isMobile?'34px':'46px'}; text-align:right;`">{{ row.pts }}</div>
          </div>
        </template>

        <!-- no results -->
        <div v-if="noResults" style="padding:34px 16px; text-align:center; font-family:'Spectral',serif; font-style:italic; color:#8a8170; font-size:14px;">
          Ningún apostante responde a ese nombre. El HAL200 se encoge de hombros.
        </div>
      </div>

      <!-- becario stamp -->
      <div style="display:flex; align-items:center; gap:13px; margin-top:20px; padding:14px 16px; border:1px dashed rgba(70,184,132,0.4); border-radius:12px; background:rgba(20,58,43,0.22);">
        <img :src="BECARIO" style="width:42px; height:42px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:2px solid #46b884; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); flex:0 0 auto;">
        <div style="font-family:'Spectral',serif; font-style:italic; font-size:13.5px; color:#bfb6a3; line-height:1.5;">
          El Becario actualizó el marcador el <span style="color:#7fd3a8; font-style:normal; font-family:'Space Mono',monospace; font-size:12px;">{{ todayStr }}</span> tras varias horas frente al HAL200.
        </div>
      </div>

    </div>
    <!-- ═══ end CLASIFICACIÓN ═══ -->

    <!-- ═══ BÚSCATE ═══ -->
    <div v-else-if="view === 'buscate'">

      <!-- back breadcrumb -->
      <div style="margin-bottom:14px;">
        <button @click="goClas()"
                style="display:inline-flex; align-items:center; gap:7px; background:transparent; border:1px solid rgba(231,182,86,0.22); color:#b08a3e; border-radius:8px; padding:7px 14px; font-family:'Space Mono',monospace; font-size:11px; letter-spacing:1.2px; cursor:pointer; transition:border-color .15s,color .15s;"
                onmouseover="this.style.borderColor='#e7b656';this.style.color='#f7d684'"
                onmouseout="this.style.borderColor='rgba(231,182,86,0.22)';this.style.color='#b08a3e'">
          ← CLASIFICACIÓN GENERAL
        </button>
      </div>

      <!-- search box -->
      <div style="position:relative; border:1px solid rgba(231,182,86,0.2); border-radius:16px; padding:26px 22px; background:linear-gradient(160deg,#1a2030,rgba(19,24,34,0.5));">
        <div style="position:absolute; top:-40px; right:-30px; width:180px; height:180px; background:radial-gradient(circle,rgba(231,182,86,0.16),transparent 70%); pointer-events:none;"></div>
        <div style="display:flex; align-items:center; gap:13px; margin-bottom:6px;">
          <img :src="PAMELA" style="width:46px; height:46px; border-radius:50%; object-fit:cover; object-position:50% 26%; border:2px solid #e7b656; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); flex:0 0 auto;">
          <div style="font-family:'Space Mono',monospace; font-size:10px; letter-spacing:2px; color:#b08a3e;">DEPARTAMENTO DE RECLAMACIONES · PAMELA</div>
        </div>
        <h1 style="font-family:'Space Mono',monospace; font-weight:700; font-size:clamp(16px,4vw,23px); line-height:1.15; letter-spacing:0.5px; color:#f7d684; margin:8px 0 7px; text-shadow:0 0 16px rgba(231,182,86,0.3);">Localiza tu miserable posición en el Imperio</h1>
        <p style="font-family:'Spectral',serif; font-size:15px; color:#bfb6a3; margin:0 0 18px; max-width:560px;">Escribe tu alias de guerra. El HAL200 hará el resto y Pamela despachará tu reclamación sin miramientos.</p>

        <div style="position:relative; max-width:480px;">
          <input :value="query" @input="onQuery" @keydown="onSearchKey"
                 placeholder="Tu alias de apostante…"
                 style="width:100%; background:#0e1016; border:1.5px solid rgba(231,182,86,0.35); color:#ece3d2; border-radius:11px; padding:15px 16px; font-size:16px; outline:none; box-shadow:0 0 24px rgba(231,182,86,0.08);">
          <!-- autocomplete dropdown -->
          <div v-if="suggestions.length"
               style="position:absolute; top:calc(100% + 6px); left:0; right:0; background:#1a2030; border:1px solid rgba(231,182,86,0.3); border-radius:11px; overflow:hidden; z-index:20; box-shadow:0 16px 40px rgba(0,0,0,0.55);">
            <div v-for="s in suggestions" :key="s.name" @click="selectSugg(s)"
                 style="display:flex; align-items:center; gap:10px; padding:11px 14px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05);">
              <span style="font-family:'Space Mono',monospace; font-size:11px; color:#b08a3e; min-width:34px;">#{{ s.pos }}</span>
              <span style="font-weight:600; font-size:14px; color:#ece3d2; flex:1;">{{ s.name }}</span>
              <span style="font-family:'Space Mono',monospace; font-size:13px; color:#e7b656;">{{ s.pts }}</span>
            </div>
          </div>
        </div>

        <!-- example chips -->
        <div v-if="!selectedName && examples.length" style="display:flex; align-items:center; gap:8px; margin-top:16px; flex-wrap:wrap;">
          <span style="font-family:'Space Mono',monospace; font-size:10px; letter-spacing:1px; color:#766f5f;">PRUEBA:</span>
          <div v-for="ex in examples" :key="ex.name"
               @click="selectSugg(ex)"
               style="font-family:'Space Mono',monospace; font-size:12px; color:#ece3d2; padding:6px 12px; border:1px solid rgba(231,182,86,0.3); border-radius:20px; cursor:pointer; background:rgba(231,182,86,0.06);">
            {{ ex.name }}
          </div>
        </div>
      </div>

      <!-- dossier -->
      <div v-if="mePlayer" style="margin-top:18px; animation:mpFade .3s ease;">

        <!-- banner -->
        <div :style="`padding:20px 22px; border-radius:16px; background:${mePlayer.bannerBg}; border:1px solid ${mePlayer.bannerBorder}; color:${mePlayer.bannerColor};`">
          <div style="font-family:'Space Mono',monospace; font-size:10px; letter-spacing:2.5px; opacity:.9;">{{ mePlayer.vtag }}</div>
          <div style="margin-top:10px;">
            <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:clamp(40px,10vw,58px); line-height:.85; letter-spacing:-1px;">#{{ mePlayer.pos }}</div>
            <div style="font-family:'Space Mono',monospace; font-weight:700; font-size:20px; letter-spacing:-.5px; opacity:.85; margin-top:8px;">{{ mePlayer.pts }}<span style="font-size:12px; letter-spacing:2px; opacity:.7; margin-left:5px;">PTS</span></div>
            <div style="font-family:'Space Mono',monospace; font-size:11px; opacity:.55; margin-top:6px; letter-spacing:.3px;">{{ mePlayer.name }} · de {{ mePlayer.n }} apostantes</div>
          </div>
        </div>

        <!-- pako verdict -->
        <div style="margin-top:13px; padding:18px 20px; border:1px solid rgba(231,182,86,0.18); border-radius:14px; background:#161b27;">
          <div style="display:flex; align-items:flex-start; gap:13px;">
            <img :src="PAKO" style="width:40px; height:40px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:2px solid #e7b656; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); flex:0 0 auto;">
            <div>
              <div style="font-family:'Spectral',serif; font-weight:600; font-size:18px; color:#f7d684; line-height:1.25;">{{ mePlayer.vtitle }}</div>
              <div style="font-family:'Spectral',serif; font-style:italic; font-size:15px; color:#cabfa9; line-height:1.55; margin-top:7px;">{{ mePlayer.vbody }}</div>
              <div style="font-family:'Space Mono',monospace; font-size:10px; letter-spacing:1px; color:#766f5f; margin-top:11px;">— Crónica firmada por el caudillo Pako Porras</div>
            </div>
          </div>
        </div>

        <!-- stats cards -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:11px; margin-top:13px;">
          <div style="padding:15px 16px; border:1px solid rgba(231,182,86,0.16); border-radius:12px; background:rgba(19,24,34,0.5);">
            <div style="font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:1.5px; color:#8a8170;">PARA SALTAR AL PODIO</div>
            <div :style="`font-family:'Space Mono',monospace; font-weight:700; font-size:${mePlayer.inTop3?'18px':'26px'}; color:${mePlayer.top3Color}; margin-top:5px;`">{{ mePlayer.top3Label }}</div>
            <div style="font-family:'Spectral',serif; font-style:italic; font-size:12px; color:#8a8170; margin-top:3px;">{{ mePlayer.top3Sub }}</div>
          </div>
          <div style="padding:15px 16px; border:1px solid rgba(221,93,66,0.22); border-radius:12px; background:rgba(19,24,34,0.5);">
            <div style="font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:1.5px; color:#8a8170;">COLCHÓN ANTE LA MISERIA</div>
            <div :style="`font-family:'Space Mono',monospace; font-weight:700; font-size:${mePlayer.inMis?'18px':'26px'}; color:${mePlayer.cushionColor}; margin-top:5px;`">{{ mePlayer.cushionLabel }}</div>
            <div style="font-family:'Spectral',serif; font-style:italic; font-size:12px; color:#8a8170; margin-top:3px;">{{ mePlayer.cushionSub }}</div>
          </div>
        </div>

        <!-- neighbors -->
        <div style="margin-top:13px; border:1px solid rgba(231,182,86,0.16); border-radius:14px; overflow:hidden;">
          <div style="padding:11px 15px; background:#161b27; border-bottom:1px solid rgba(231,182,86,0.16); display:flex; align-items:center; gap:8px;">
            <span style="font-family:'Space Mono',monospace; font-size:10px; letter-spacing:1.5px; color:#f7d684;">QUIÉN TE RODEA EN EL ESCALAFÓN</span>
            <span style="font-family:'Spectral',serif; font-style:italic; font-size:12px; color:#8a8170;">— tres por arriba, tres por abajo</span>
          </div>
          <div v-for="nb in mePlayer.neighbors" :key="nb.name"
               @click="selectNeighbor(nb)"
               :style="`display:flex; align-items:center; gap:12px; padding:12px 15px; cursor:${nb.meRow?'default':'pointer'}; border-bottom:1px solid rgba(255,255,255,0.05); background:${nb.meRow?'linear-gradient(90deg,rgba(231,182,86,0.2),rgba(231,182,86,0.03))':nb.ab?'rgba(70,184,132,0.05)':'rgba(221,93,66,0.045)'};`">
            <span :style="`font-family:'Space Mono',monospace; font-size:11px; font-weight:700; color:${nb.meRow?'#f7d684':'#8a8170'}; width:38px; flex:0 0 auto;`">{{ nb.posLabel }}</span>
            <span :style="`flex:1 1 auto; min-width:0; font-family:Archivo; font-weight:${nb.meRow?700:500}; font-size:14px; color:${nb.meRow?'#f7d684':'#bfb6a3'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`">{{ nb.name }}</span>
            <div style="display:flex; gap:1.5px; align-items:flex-end; flex:0 0 auto;">
              <div v-for="(b, bi) in nb.spark" :key="bi"
                   style="width:4px; height:22px; background:rgba(255,255,255,0.06); border-radius:1.5px; display:flex; align-items:flex-end; overflow:hidden;">
                <div :style="`width:100%; height:${b.h}%; background:linear-gradient(180deg,#f7d684,#c79433); border-radius:1.5px;`"></div>
              </div>
            </div>
            <span :style="`font-family:'Space Mono',monospace; font-weight:700; font-size:16px; letter-spacing:-0.5px; color:${nb.meRow?'#f7d684':'#ece3d2'}; flex:0 0 auto; min-width:52px; text-align:right;`">{{ nb.pts }}<span style="font-size:10px; letter-spacing:1px; opacity:.6; margin-left:3px;">pts</span></span>
            <span :style="`font-family:'Space Mono',monospace; font-size:12px; font-weight:700; color:${nb.deltaColor}; width:46px; text-align:right; flex:0 0 auto;`">{{ nb.deltaLabel }}</span>
          </div>
        </div>

        <!-- pamela note -->
        <div style="display:flex; align-items:center; gap:11px; margin-top:14px; padding:13px 15px; border-radius:12px; background:rgba(231,182,86,0.06); border:1px dashed rgba(231,182,86,0.3);">
          <img :src="PAMELA" style="width:34px; height:34px; border-radius:50%; object-fit:cover; object-position:50% 26%; border:1.5px solid #e7b656; box-shadow:0 0 0 2px #0e1016, 0 0 10px rgba(231,182,86,.35); flex:0 0 auto;">
          <div style="font-family:'Spectral',serif; font-style:italic; font-size:13px; color:#bfb6a3;">Reclamación despachada por Pamela. Si no estás conforme, ya sabes dónde no quejarte.</div>
        </div>
      </div>

      <!-- idle state -->
      <div v-if="!selectedName" style="margin-top:22px; text-align:center; padding:30px 20px;">
        <img :src="BECARIO" style="width:64px; height:64px; border-radius:50%; object-fit:cover; object-position:50% 30%; border:2px solid #46b884; box-shadow:0 0 0 3px #0e1016, 0 0 16px rgba(231,182,86,.35); opacity:.85;">
        <div style="font-family:'Spectral',serif; font-style:italic; font-size:15px; color:#8a8170; margin-top:14px; max-width:420px; margin-left:auto; margin-right:auto;">Distinguido megaporrero: aún no has tecleado tu nombre. El HAL200 aguarda. El Becario, también.</div>
      </div>

    </div>
    <!-- ═══ end BÚSCATE ═══ -->

  </main>

  <!-- ═══ FOOTER ═══ -->
  <footer style="position:relative; z-index:1; max-width:1120px; margin:0 auto; padding:22px 18px 40px; border-top:1px solid rgba(231,182,86,0.12);">
    <div style="font-family:'Spectral',serif; font-style:italic; font-size:13px; color:#8a8170; line-height:1.6;">Crónica oficial firmada por el caudillo <span style="color:#e7b656; font-style:normal;">Pako Porras</span>. Datos custodiados por el Becario en el HAL200. Reclamaciones a Pamela. Quejas, a Madre — bajo vuestra entera responsabilidad.</div>
    <div style="font-family:'Space Mono',monospace; font-size:9.5px; letter-spacing:1.5px; color:#5a5444; margin-top:9px;">MEGAPORRA CORPORATION © MUNDIAL 2026</div>
  </footer>

  <!-- sparkline tooltip (teleported to body to escape overflow:hidden containers) -->
  <Teleport to="body">
    <div v-if="sparkTip.show"
         :style="`position:fixed; left:${sparkTip.x}px; top:${sparkTip.y - 14}px; transform:translate(-50%,-100%); background:#161b27; border:1px solid rgba(231,182,86,0.35); color:#f7d684; font-family:'Space Mono',monospace; font-size:11px; letter-spacing:.3px; padding:7px 11px; border-radius:8px; white-space:nowrap; pointer-events:none; z-index:9999; box-shadow:0 4px 20px rgba(0,0,0,0.6);`">
      {{ sparkTip.text }}
    </div>
  </Teleport>

</div>
</template>
