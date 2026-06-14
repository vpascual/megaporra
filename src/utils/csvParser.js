const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTXkYTxBqRAob7uos5aRrDFXifXnkWthk7khZUQEZ1VD0VzVOf2vMKYEmgoJQXoGuDKlyJZ1lYZtKRj/pub?output=csv'

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
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

export async function fetchStandings() {
  const res = await fetch(CSV_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  const header0 = parseCSVLine(lines[0]) // round names
  const header1 = parseCSVLine(lines[1]) // phase names
  const header2 = parseCSVLine(lines[2]) // dates

  // Build column metadata, filling forward the round names for multi-column rounds
  const columns = []
  let lastRound = ''
  for (let i = 1; i < header0.length; i++) {
    const roundName = header0[i] || lastRound
    if (header0[i]) lastRound = header0[i]
    const phase = header1[i] || ''
    const date = header2[i] || ''
    const label = header2[i] === 'TOTAL' ? 'TOTAL' : roundName
    columns.push({ index: i, roundName, phase, date, label })
  }

  const totalColIndex = header2.findIndex(h => h === 'TOTAL')

  // Parse player rows
  const players = []
  for (let r = 3; r < lines.length; r++) {
    const row = parseCSVLine(lines[r])
    const name = row[0]
    if (!name) continue

    const total = totalColIndex >= 0 ? parseInt(row[totalColIndex], 10) || 0 : 0

    const scores = columns
      .filter(c => c.label !== 'TOTAL' && c.phase !== 'EXTRES' && c.phase !== '')
      .map(c => {
        const val = row[c.index]
        return {
          roundName: c.roundName,
          phase: c.phase,
          date: c.date,
          score: val !== '' && val !== undefined ? parseInt(val, 10) : null,
        }
      })
      .filter(s => s.score !== null && s.roundName)

    // Deduplicate by keeping unique round entries (some rounds span multiple sub-columns)
    const seen = new Set()
    const uniqueScores = []
    for (const s of scores) {
      const key = `${s.roundName}|${s.phase}|${s.date}`
      if (!seen.has(key)) {
        seen.add(key)
        uniqueScores.push(s)
      }
    }

    players.push({ name, total, scores: uniqueScores })
  }

  // Sort by total descending
  players.sort((a, b) => b.total - a.total)

  // Assign ranks (tied players share rank)
  let rank = 1
  for (let i = 0; i < players.length; i++) {
    if (i > 0 && players[i].total < players[i - 1].total) {
      rank = i + 1
    }
    players[i].rank = rank
  }

  // Completed rounds: those that have at least one non-null score across all players
  const completedRounds = []
  const allRoundNames = [...new Set(players.flatMap(p => p.scores.map(s => s.roundName)))]
  for (const rn of allRoundNames) {
    const hasData = players.some(p => p.scores.some(s => s.roundName === rn && s.score !== null))
    if (hasData) {
      const sample = players.flatMap(p => p.scores).find(s => s.roundName === rn)
      completedRounds.push({ roundName: rn, phase: sample?.phase, date: sample?.date })
    }
  }

  return { players, completedRounds }
}
