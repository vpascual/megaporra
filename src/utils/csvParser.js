const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTXkYTxBqRAob7uos5aRrDFXifXnkWthk7khZUQEZ1VD0VzVOf2vMKYEmgoJQXoGuDKlyJZ1lYZtKRj/pub?output=csv'

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function formatDateTag(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('/')
  if (parts.length >= 2) return parts[0].padStart(2, '0') + '·' + parts[1].padStart(2, '0')
  return dateStr
}

export async function fetchData() {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  const row0 = parseCSVLine(lines[0]) // jornada names
  const row1 = parseCSVLine(lines[1]) // phase names
  const row2 = parseCSVLine(lines[2]) // dates / TOTAL marker

  // Find TOTAL column index
  const totalColIdx = row2.findIndex(h => h === 'TOTAL')

  // Build jornada groups: fill forward JORNADA N labels, stop before TOTAL/EXTRES
  const jornadaGroups = new Map() // jornada number -> { phase, date, dateTag, cols[] }
  let lastJNum = 0
  const endIdx = totalColIdx > 0 ? totalColIdx : row0.length

  for (let i = 1; i < endIdx; i++) {
    const label = row0[i]
    const phase = row1[i] || ''
    if (phase === 'EXTRES') break

    if (label && /JORNADA\s+\d+/.test(label)) {
      const num = parseInt(label.match(/\d+/)[0])
      lastJNum = num
      if (!jornadaGroups.has(num)) {
        jornadaGroups.set(num, {
          n: num,
          phase,
          date: row2[i] || '',
          dateTag: formatDateTag(row2[i] || ''),
          cols: []
        })
      }
    }
    if (lastJNum > 0) {
      jornadaGroups.get(lastJNum).cols.push(i)
    }
  }

  // Sort jornadas by number
  const jornadas = [...jornadaGroups.values()].sort((a, b) => a.n - b.n)

  // Parse players
  const players = []
  for (let r = 3; r < lines.length; r++) {
    const row = parseCSVLine(lines[r])
    const name = row[0]
    if (!name) continue

    const scores = jornadas.map(j => {
      const vals = j.cols
        .map(c => row[c])
        .filter(v => v !== '' && v !== undefined && v !== null)
        .map(v => parseInt(v, 10))
        .filter(v => !isNaN(v))
      if (vals.length === 0) return null
      return vals.reduce((a, b) => a + b, 0)
    })

    const total = totalColIdx >= 0 && row[totalColIdx] !== ''
      ? parseInt(row[totalColIdx], 10) || 0
      : scores.reduce((s, v) => s + (v ?? 0), 0)

    players.push({ name, scores, total })
  }

  // Determine last played jornada (last index with any non-null score)
  let lastPlayedIdx = -1
  for (let k = jornadas.length - 1; k >= 0; k--) {
    if (players.some(p => p.scores[k] !== null)) { lastPlayedIdx = k; break }
  }
  const lastPlayed = lastPlayedIdx >= 0 ? jornadas[lastPlayedIdx].n : 1

  return { players, jornadas, lastPlayed }
}
