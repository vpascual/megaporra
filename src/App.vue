<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchStandings } from './utils/csvParser.js'

const players = ref([])
const completedRounds = ref([])
const loading = ref(true)
const error = ref(null)
const search = ref('')
const selectedRound = ref(null)
const lastUpdated = ref(null)

async function load() {
  try {
    loading.value = true
    error.value = null
    const data = await fetchStandings()
    players.value = data.players
    completedRounds.value = data.completedRounds
    lastUpdated.value = new Date()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)

const filtered = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return players.value
  return players.value.filter(p => p.name.toLowerCase().includes(q))
})

const leader = computed(() => players.value[0])
const roundsPlayed = computed(() => completedRounds.value.length)

function scoreColor(score) {
  if (score === null) return 'score-empty'
  if (score === 0) return 'score-zero'
  if (score >= 18) return 'score-max'
  if (score >= 14) return 'score-high'
  if (score >= 9) return 'score-good'
  if (score >= 7) return 'score-ok'
  return 'score-low'
}

function getScoreForRound(player, roundName) {
  const s = player.scores.find(sc => sc.roundName === roundName)
  return s ? s.score : null
}

function formatDate(d) {
  if (!d) return ''
  return d
}

const topThree = computed(() => players.value.slice(0, 3))
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-inner">
        <div class="header-brand">
          <span class="header-ball">⚽</span>
          <div>
            <h1 class="header-title">La Megaporra</h1>
            <p class="header-sub">Mundial 2026 · Clasificación General</p>
          </div>
        </div>
        <button class="refresh-btn" @click="load" :disabled="loading" title="Actualizar">
          <span :class="{ spinning: loading }">↻</span>
        </button>
      </div>
    </header>

    <!-- Stats bar -->
    <div v-if="!loading && !error && players.length" class="stats-bar">
      <div class="stat">
        <span class="stat-value">{{ players.length }}</span>
        <span class="stat-label">Participantes</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">{{ roundsPlayed }}</span>
        <span class="stat-label">Jornadas jugadas</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value gold">{{ leader?.total ?? '—' }}</span>
        <span class="stat-label">Puntos del líder</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-value">{{ leader?.name ?? '—' }}</span>
        <span class="stat-label">Líder actual</span>
      </div>
    </div>

    <!-- Podium (top 3) -->
    <div v-if="!loading && !error && topThree.length" class="podium">
      <div
        v-for="(p, i) in topThree"
        :key="p.name"
        class="podium-card"
        :class="['podium-' + (i + 1)]"
      >
        <span class="podium-medal">{{ ['🥇', '🥈', '🥉'][i] }}</span>
        <span class="podium-name">{{ p.name }}</span>
        <span class="podium-pts">{{ p.total }} pts</span>
      </div>
    </div>

    <!-- Main content -->
    <main class="main">
      <!-- Loading -->
      <div v-if="loading" class="state-center">
        <div class="loader"></div>
        <p>Cargando clasificación…</p>
      </div>

      <!-- Error -->
      <div v-else-if="error" class="state-center error-state">
        <span class="state-icon">⚠️</span>
        <p>Error al cargar los datos</p>
        <p class="error-detail">{{ error }}</p>
        <button class="retry-btn" @click="load">Reintentar</button>
      </div>

      <!-- Table -->
      <div v-else class="table-wrapper">
        <!-- Controls -->
        <div class="controls">
          <div class="search-wrap">
            <span class="search-icon">🔍</span>
            <input
              v-model="search"
              type="search"
              placeholder="Buscar participante…"
              class="search-input"
            />
          </div>
          <span class="result-count" v-if="search">
            {{ filtered.length }} resultado{{ filtered.length !== 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Round tabs -->
        <div v-if="completedRounds.length" class="round-tabs">
          <button
            class="round-tab"
            :class="{ active: !selectedRound }"
            @click="selectedRound = null"
          >Todas</button>
          <button
            v-for="r in completedRounds"
            :key="r.roundName"
            class="round-tab"
            :class="{ active: selectedRound === r.roundName }"
            @click="selectedRound = selectedRound === r.roundName ? null : r.roundName"
          >
            {{ r.roundName }}
          </button>
        </div>

        <!-- Selected round info -->
        <div v-if="selectedRound" class="round-info">
          <template v-for="r in completedRounds" :key="r.roundName">
            <span v-if="r.roundName === selectedRound" class="round-info-text">
              {{ r.phase }} · {{ formatDate(r.date) }}
            </span>
          </template>
        </div>

        <!-- Table -->
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th class="th-rank">#</th>
                <th class="th-name">Participante</th>
                <template v-if="!selectedRound">
                  <th
                    v-for="r in completedRounds"
                    :key="r.roundName"
                    class="th-round"
                    :title="r.phase + (r.date ? ' · ' + r.date : '')"
                  >{{ r.roundName.replace('JORNADA ', 'J') }}</th>
                </template>
                <template v-else>
                  <th class="th-round">Puntos</th>
                </template>
                <th class="th-total">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="player in filtered"
                :key="player.name"
                class="tr"
                :class="{
                  'tr-gold': player.rank === 1,
                  'tr-silver': player.rank === 2,
                  'tr-bronze': player.rank === 3,
                }"
              >
                <td class="td-rank">
                  <span v-if="player.rank === 1" class="medal">🥇</span>
                  <span v-else-if="player.rank === 2" class="medal">🥈</span>
                  <span v-else-if="player.rank === 3" class="medal">🥉</span>
                  <span v-else class="rank-num">{{ player.rank }}</span>
                </td>
                <td class="td-name">{{ player.name }}</td>
                <template v-if="!selectedRound">
                  <td
                    v-for="r in completedRounds"
                    :key="r.roundName"
                    class="td-score"
                  >
                    <span
                      class="score-pill"
                      :class="scoreColor(getScoreForRound(player, r.roundName))"
                    >
                      {{ getScoreForRound(player, r.roundName) ?? '—' }}
                    </span>
                  </td>
                </template>
                <template v-else>
                  <td class="td-score">
                    <span
                      class="score-pill"
                      :class="scoreColor(getScoreForRound(player, selectedRound))"
                    >
                      {{ getScoreForRound(player, selectedRound) ?? '—' }}
                    </span>
                  </td>
                </template>
                <td class="td-total">
                  <span class="total-val">{{ player.total }}</span>
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td :colspan="(selectedRound ? 1 : completedRounds.length) + 3" class="empty-row">
                  No se encontraron participantes
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer v-if="lastUpdated" class="footer">
      Última actualización: {{ lastUpdated.toLocaleTimeString('es-ES') }}
      · Datos en tiempo real desde Google Sheets
    </footer>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

/* Header */
.header {
  background: linear-gradient(135deg, #0d1f0d 0%, #162816 50%, #0a160a 100%);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1400px;
  margin: 0 auto;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-ball {
  font-size: 36px;
  filter: drop-shadow(0 0 12px rgba(255, 255, 255, 0.3));
}

.header-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-bright);
  letter-spacing: -0.5px;
  line-height: 1.2;
}

.header-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.refresh-btn {
  background: var(--surface);
  border: 1px solid var(--border-light);
  color: var(--text-muted);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.refresh-btn:hover { color: var(--accent); border-color: var(--accent); }
.refresh-btn:disabled { opacity: 0.5; cursor: default; }

.spinning {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* Stats bar */
.stats-bar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex-wrap: wrap;
}

.stat {
  padding: 12px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-bright);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.stat-value.gold { color: var(--gold); }

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.8px;
}

.stat-divider {
  width: 1px;
  height: 32px;
  background: var(--border);
}

/* Podium */
.podium {
  display: flex;
  gap: 12px;
  padding: 20px 24px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.podium-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  min-width: 0;
}

.podium-1 { border-color: var(--gold); background: linear-gradient(135deg, var(--surface) 0%, rgba(245, 197, 24, 0.08) 100%); }
.podium-2 { border-color: rgba(176, 184, 196, 0.4); }
.podium-3 { border-color: rgba(205, 127, 50, 0.4); }

.podium-medal { font-size: 22px; flex-shrink: 0; }
.podium-name {
  font-weight: 600;
  color: var(--text-bright);
  font-size: 14px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.podium-pts {
  font-weight: 700;
  font-size: 16px;
  color: var(--gold);
  flex-shrink: 0;
}

/* Main */
.main {
  flex: 1;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
  padding: 0 24px 24px;
  box-sizing: border-box;
}

/* State centers */
.state-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 300px;
  color: var(--text-muted);
}

.state-icon { font-size: 40px; }

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.error-state { color: var(--red); }
.error-detail { font-size: 12px; opacity: 0.7; }
.retry-btn {
  padding: 8px 20px;
  background: var(--surface-2);
  border: 1px solid var(--border-light);
  color: var(--text);
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}
.retry-btn:hover { border-color: var(--accent); color: var(--accent); }

/* Table wrapper */
.table-wrapper { padding-top: 4px; }

/* Controls */
.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.search-wrap {
  display: flex;
  align-items: center;
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 0 12px;
  gap: 8px;
  transition: border-color 0.2s;
}
.search-wrap:focus-within { border-color: var(--accent); }

.search-icon { font-size: 14px; }
.search-input {
  background: none;
  border: none;
  outline: none;
  color: var(--text-bright);
  font-size: 13px;
  padding: 8px 0;
  width: 220px;
}
.search-input::placeholder { color: var(--text-muted); }
.search-input::-webkit-search-cancel-button { cursor: pointer; }

.result-count {
  font-size: 12px;
  color: var(--text-muted);
}

/* Round tabs */
.round-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.round-tab {
  padding: 5px 12px;
  border-radius: 20px;
  border: 1px solid var(--border-light);
  background: var(--surface);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.round-tab:hover { color: var(--text-bright); border-color: var(--text-muted); }
.round-tab.active {
  background: var(--accent-dim);
  border-color: var(--accent);
  color: var(--accent);
}

/* Round info */
.round-info {
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

/* Table scroll */
.table-scroll {
  overflow-x: auto;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

thead { position: sticky; top: 65px; z-index: 10; }

th {
  background: var(--surface-2);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 10px 8px;
  white-space: nowrap;
  border-bottom: 1px solid var(--border);
  text-align: center;
}

.th-rank { width: 48px; }
.th-name { text-align: left; padding-left: 16px; min-width: 160px; }
.th-round { min-width: 48px; }
.th-total { min-width: 64px; color: var(--text-bright); }

.tr {
  border-bottom: 1px solid var(--border);
  transition: background 0.1s;
}
.tr:hover { background: var(--surface); }
.tr:last-child { border-bottom: none; }
.tr-gold { background: rgba(245, 197, 24, 0.04); }
.tr-silver { background: rgba(176, 184, 196, 0.03); }
.tr-bronze { background: rgba(205, 127, 50, 0.03); }

td {
  padding: 9px 8px;
  text-align: center;
  vertical-align: middle;
}

.td-rank { text-align: center; }
.td-name {
  text-align: left;
  padding-left: 16px;
  font-weight: 500;
  color: var(--text-bright);
  white-space: nowrap;
}

.medal { font-size: 16px; }
.rank-num { font-weight: 600; color: var(--text-muted); font-size: 12px; }

/* Score pills */
.score-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 12px;
}

.score-empty { color: var(--text-muted); background: transparent; }
.score-zero { color: var(--red); background: var(--red-dim); }
.score-low { color: #fb923c; background: rgba(251, 146, 60, 0.12); }
.score-ok { color: var(--text); background: var(--surface-2); }
.score-good { color: var(--green); background: var(--green-dim); }
.score-high { color: var(--gold); background: var(--gold-dim); }
.score-max { color: #fff; background: linear-gradient(135deg, #f59e0b, #ef4444); font-weight: 700; }

.td-total { font-weight: 700; font-size: 15px; color: var(--gold); }

.empty-row {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
  font-size: 14px;
}

/* Footer */
.footer {
  border-top: 1px solid var(--border);
  padding: 12px 24px;
  text-align: center;
  font-size: 11px;
  color: var(--text-muted);
}

/* Responsive */
@media (max-width: 640px) {
  .header-inner { padding: 12px 16px; }
  .header-title { font-size: 18px; }
  .header-ball { font-size: 28px; }

  .stats-bar { justify-content: flex-start; overflow-x: auto; flex-wrap: nowrap; }
  .stat { padding: 10px 16px; }
  .stat-value { font-size: 16px; }

  .podium { flex-direction: column; padding: 12px 16px; }

  .main { padding: 0 12px 16px; }
  .search-input { width: 160px; }
  .table-scroll { border-radius: 8px; }
}
</style>
