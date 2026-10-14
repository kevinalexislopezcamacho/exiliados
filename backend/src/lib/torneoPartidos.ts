import type { Client } from '@libsql/client'
import { COUNTRY_NAMES } from './countries'
import { CAREERS, CRESTS, WORLD_CUP_SCORERS, crestUrlFor } from './footballData'
import { dayKey, GameError, hashString, seededRandom, shuffle } from './minigameCore'
import { GROUPS, computeStandings, type Participante, type Partido, type Torneo } from './torneo'

// Partidos del Mundial: 5 rondas de 3 preguntas, iguales para los dos
// rivales. Cada ronda la gana quien acierta más (eso es un gol); si
// aciertan lo mismo, nadie mete gol. En eliminatorias, si terminan
// empatados, desempata el total de aciertos y después el tiempo.

export const QUESTIONS_PER_ROUND = 3

export const ROUND_NAMES = ['Trivia de fútbol', 'Selección del clan', 'Goleadores mundialistas', 'Escudos', 'Trayectorias']

export interface RoundQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  image?: string | null
  clubs?: Array<{ name: string; image: string | null }>
}

export interface MatchPuzzle {
  rounds: Array<{ name: string; questions: RoundQuestion[] }>
}

interface RoundResult {
  score: number
  ms: number
}

interface PlayRow {
  answers_json: string
  rounds_json: string
  round_started_at: number | null
  finished: number
}

// ---------------------------------------------------------------------------
// Contenido de las rondas
// ---------------------------------------------------------------------------

function pickOptions(correct: string, pool: string[], rand: () => number, count = 4) {
  const others = shuffle(
    pool.filter((p) => p !== correct),
    rand
  ).slice(0, count - 1)
  const options = shuffle([correct, ...others], rand)
  return { options, correctIndex: options.indexOf(correct) }
}

async function buildMatchPuzzle(db: Client, matchId: number): Promise<MatchPuzzle> {
  const rand = seededRandom(hashString(`torneo-partido:${matchId}`))
  const rounds: MatchPuzzle['rounds'] = []

  // 1. Trivia de fútbol (banco de preguntas).
  const trivia = (
    await db.execute(`SELECT question, options_json, correct_index FROM trivia_questions WHERE category = 'futbol' ORDER BY id`)
  ).rows as unknown as Array<{ question: string; options_json: string; correct_index: number }>
  rounds.push({
    name: ROUND_NAMES[0],
    questions: shuffle(trivia, rand)
      .slice(0, QUESTIONS_PER_ROUND)
      .map((q) => {
        const opts = JSON.parse(q.options_json) as string[]
        const correct = opts[Number(q.correct_index)] ?? opts[0]
        const options = shuffle(opts, rand)
        return { prompt: q.question, options, correctIndex: options.indexOf(correct) }
      }),
  })

  // 2. Selección del clan: ¿de qué país es cada integrante?
  const roster = (
    await db.execute(`SELECT name, country_code FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id`)
  ).rows as unknown as Array<{ name: string; country_code: string }>
  const withCountry = roster.filter((r) => COUNTRY_NAMES[(r.country_code ?? '').toLowerCase()])
  const countryPool = Object.values(COUNTRY_NAMES)
  rounds.push({
    name: ROUND_NAMES[1],
    questions: shuffle(withCountry, rand)
      .slice(0, QUESTIONS_PER_ROUND)
      .map((m) => {
        const correct = COUNTRY_NAMES[m.country_code.toLowerCase()]
        return { prompt: `¿De qué país es ${m.name}?`, ...pickOptions(correct, countryPool, rand) }
      }),
  })

  // 3. Goleadores: ¿quién hizo más goles en Mundiales?
  const scorers: RoundQuestion[] = []
  const used = new Set<string>()
  for (let i = 0; i < 300 && scorers.length < QUESTIONS_PER_ROUND; i++) {
    const a = WORLD_CUP_SCORERS[Math.floor(rand() * WORLD_CUP_SCORERS.length)]
    const b = WORLD_CUP_SCORERS[Math.floor(rand() * WORLD_CUP_SCORERS.length)]
    if (a.name === b.name || a.goals === b.goals || used.has(a.name) || used.has(b.name)) continue
    used.add(a.name)
    used.add(b.name)
    scorers.push({ prompt: '¿Quién hizo más goles en Mundiales?', options: [a.name, b.name], correctIndex: a.goals > b.goals ? 0 : 1 })
  }
  rounds.push({ name: ROUND_NAMES[2], questions: scorers })

  // 4. Escudos: ¿de qué club es?
  const crestNames = CRESTS.map((c) => c.name)
  rounds.push({
    name: ROUND_NAMES[3],
    questions: shuffle(CRESTS, rand)
      .slice(0, QUESTIONS_PER_ROUND)
      .map((c) => ({ prompt: '¿De qué club es este escudo?', image: c.url, ...pickOptions(c.name, crestNames, rand) })),
  })

  // 5. Trayectorias: ¿qué jugador hizo esta carrera?
  const careerNames = CAREERS.map((c) => c.name)
  rounds.push({
    name: ROUND_NAMES[4],
    questions: shuffle(CAREERS, rand)
      .slice(0, QUESTIONS_PER_ROUND)
      .map((c) => ({
        prompt: '¿Qué jugador hizo esta carrera?',
        clubs: c.clubs.map((name) => ({ name, image: crestUrlFor(name) })),
        ...pickOptions(c.name, careerNames, rand),
      })),
  })

  return { rounds }
}

export async function getMatchPuzzle(db: Client, matchId: number): Promise<MatchPuzzle> {
  const read = async () =>
    (await db.execute({ sql: 'SELECT puzzle_json FROM torneo_rondas WHERE match_id = ?', args: [matchId] })).rows[0] as unknown as
      | { puzzle_json: string }
      | undefined
  const existing = await read()
  if (existing) return JSON.parse(existing.puzzle_json) as MatchPuzzle
  const puzzle = await buildMatchPuzzle(db, matchId)
  await db.execute({
    sql: 'INSERT OR IGNORE INTO torneo_rondas (match_id, puzzle_json) VALUES (?, ?)',
    args: [matchId, JSON.stringify(puzzle)],
  })
  const stored = await read()
  return stored ? (JSON.parse(stored.puzzle_json) as MatchPuzzle) : puzzle
}

// ---------------------------------------------------------------------------
// Jugadas
// ---------------------------------------------------------------------------

async function getPlayRow(db: Client, matchId: number, slot: number) {
  return (await db.execute({ sql: 'SELECT * FROM torneo_jugadas WHERE match_id = ? AND slot = ?', args: [matchId, slot] }))
    .rows[0] as unknown as PlayRow | undefined
}

export function isMatchOpen(m: Partido, today = dayKey()) {
  return m.status === 'pendiente' && m.home_slot !== null && m.away_slot !== null && m.opens_day <= today && today <= m.closes_day
}

// Marca el inicio de la ronda actual (para medir el tiempo de cada ronda).
export async function startOrResume(db: Client, m: Partido, slot: number) {
  if (!isMatchOpen(m)) throw new GameError('Este partido no está abierto para jugar')
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO torneo_jugadas (match_id, slot, round_started_at) VALUES (?, ?, ?)',
      args: [Number(m.id), slot, Date.now()],
    })
  } else if (!play.finished && play.round_started_at === null) {
    await db.execute({
      sql: 'UPDATE torneo_jugadas SET round_started_at = ? WHERE match_id = ? AND slot = ?',
      args: [Date.now(), Number(m.id), slot],
    })
  }
}

export async function answerQuestion(db: Client, m: Partido, slot: number, answer: number) {
  if (!isMatchOpen(m)) throw new GameError('Este partido ya no está abierto')
  const puzzle = await getMatchPuzzle(db, Number(m.id))
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play || play.round_started_at === null) throw new GameError('Primero empezá el partido')
  if (play.finished) throw new GameError('Ya jugaste este partido')

  const answers = JSON.parse(play.answers_json) as number[]
  const rounds = JSON.parse(play.rounds_json) as RoundResult[]
  const roundIndex = Math.floor(answers.length / QUESTIONS_PER_ROUND)
  const question = puzzle.rounds[roundIndex]?.questions[answers.length % QUESTIONS_PER_ROUND]
  if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
    throw new GameError('Respuesta inválida')
  }
  answers.push(answer)

  let roundStartedAt: number | null = play.round_started_at
  const roundDone = answers.length % QUESTIONS_PER_ROUND === 0
  if (roundDone) {
    const start = roundIndex * QUESTIONS_PER_ROUND
    const score = answers
      .slice(start, start + QUESTIONS_PER_ROUND)
      .filter((a, i) => a === puzzle.rounds[roundIndex].questions[i].correctIndex).length
    rounds.push({ score, ms: Date.now() - Number(play.round_started_at) })
    // La próxima ronda arranca cuando la abra (no cuenta la pausa).
    roundStartedAt = null
  }
  const finished = rounds.length >= puzzle.rounds.length
  await db.execute({
    sql: `UPDATE torneo_jugadas SET answers_json = ?, rounds_json = ?, round_started_at = ?, finished = ?, updated_at = CURRENT_TIMESTAMP
          WHERE match_id = ? AND slot = ?`,
    args: [JSON.stringify(answers), JSON.stringify(rounds), roundStartedAt, finished ? 1 : 0, Number(m.id), slot],
  })
  return { correctIndex: question.correctIndex, correct: answer === question.correctIndex, roundDone, finished }
}

export async function getPlayProgress(db: Client, matchId: number, slot: number) {
  const play = await getPlayRow(db, matchId, slot)
  return {
    started: !!play,
    answers: play ? (JSON.parse(play.answers_json) as number[]) : [],
    rounds: play ? (JSON.parse(play.rounds_json) as RoundResult[]) : [],
    roundActive: !!play && play.round_started_at !== null && !play.finished,
    finished: !!play?.finished,
  }
}

// ---------------------------------------------------------------------------
// Resolución de partidos y avance del cuadro
// ---------------------------------------------------------------------------

// Los bots aciertan cada pregunta con probabilidad ~50% y tardan entre 25 y
// 70 segundos por ronda. Es determinístico: el bot "jugó" siempre igual.
function botRounds(matchId: number, slot: number): RoundResult[] {
  const rand = seededRandom(hashString(`bot:${matchId}:${slot}`))
  const skill = 0.4 + rand() * 0.25
  return Array.from({ length: ROUND_NAMES.length }, () => ({
    score: Array.from({ length: QUESTIONS_PER_ROUND }, () => (rand() < skill ? 1 : 0)).reduce((a: number, b) => a + b, 0),
    ms: Math.round(25_000 + rand() * 45_000),
  }))
}

interface SideResult {
  absent: boolean
  rounds: RoundResult[]
}

async function sideResult(db: Client, m: Partido, slot: number, bySlot: Map<number, Participante>): Promise<SideResult> {
  const p = bySlot.get(slot)!
  if (p.member_id === null) return { absent: false, rounds: botRounds(Number(m.id), slot) }
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play) return { absent: true, rounds: [] }
  const rounds = JSON.parse(play.rounds_json) as RoundResult[]
  // Rondas que no llegó a jugar: 0 aciertos.
  while (rounds.length < ROUND_NAMES.length) rounds.push({ score: 0, ms: 999_999 })
  return { absent: false, rounds }
}

async function resolveMatch(db: Client, m: Partido, bySlot: Map<number, Participante>) {
  const home = m.home_slot!
  const away = m.away_slot!
  const h = await sideResult(db, m, home, bySlot)
  const a = await sideResult(db, m, away, bySlot)
  const knockout = m.stage !== 'G'

  let hg = 0
  let ag = 0
  let hp: number | null = null
  let ap: number | null = null
  let winner: number | null = null

  if (h.absent && a.absent) {
    // Nadie jugó: empate sin goles; en eliminatoria pasa el mejor sembrado.
    if (knockout) winner = Number(bySlot.get(home)!.seed_score) >= Number(bySlot.get(away)!.seed_score) ? home : away
  } else if (h.absent || a.absent) {
    // El que no se presentó pierde 0-3.
    hg = h.absent ? 0 : 3
    ag = a.absent ? 0 : 3
    winner = h.absent ? away : home
  } else {
    for (let i = 0; i < ROUND_NAMES.length; i++) {
      if (h.rounds[i].score > a.rounds[i].score) hg++
      else if (a.rounds[i].score > h.rounds[i].score) ag++
    }
    if (hg !== ag) winner = hg > ag ? home : away
    else if (knockout) {
      // Desempate: total de aciertos, después tiempo total.
      hp = h.rounds.reduce((s, r) => s + r.score, 0)
      ap = a.rounds.reduce((s, r) => s + r.score, 0)
      if (hp !== ap) winner = hp > ap ? home : away
      else {
        const ht = h.rounds.reduce((s, r) => s + r.ms, 0)
        const at = a.rounds.reduce((s, r) => s + r.ms, 0)
        winner = ht <= at ? home : away
      }
    }
  }

  await db.execute({
    sql: `UPDATE torneo_partidos SET status = 'jugado', home_goals = ?, away_goals = ?, home_pens = ?, away_pens = ?, winner_slot = ?
          WHERE id = ? AND status = 'pendiente'`,
    args: [hg, ag, hp, ap, winner, Number(m.id)],
  })
}

// Detalle por ronda de un partido ya jugado (para la animación del resultado).
export async function matchBreakdown(db: Client, m: Partido, bySlot: Map<number, Participante>) {
  const h = await sideResult(db, m, m.home_slot!, bySlot)
  const a = await sideResult(db, m, m.away_slot!, bySlot)
  return {
    homeAbsent: h.absent,
    awayAbsent: a.absent,
    rounds: ROUND_NAMES.map((name, i) => ({
      name,
      home: h.rounds[i]?.score ?? null,
      away: a.rounds[i]?.score ?? null,
      homeMs: h.rounds[i]?.ms ?? null,
      awayMs: a.rounds[i]?.ms ?? null,
    })),
  }
}

async function loadAll(db: Client, torneoId: number) {
  const participantes = (
    await db.execute({ sql: 'SELECT * FROM torneo_participantes WHERE torneo_id = ?', args: [torneoId] })
  ).rows as unknown as Participante[]
  const partidos = (
    await db.execute({ sql: 'SELECT * FROM torneo_partidos WHERE torneo_id = ? ORDER BY id', args: [torneoId] })
  ).rows as unknown as Partido[]
  return { participantes, partidos }
}

const loserOf = (m: Partido) => (m.winner_slot === m.home_slot ? m.away_slot : m.home_slot)

// Avanza el torneo: resuelve los partidos que ya se pueden resolver y llena
// el cuadro de eliminatorias a medida que se definen los cruces. Se llama
// cada vez que alguien abre el torneo o un partido (no hace falta cron).
export async function advanceTorneo(db: Client, torneo: Torneo) {
  if (torneo.status !== 'en_juego') return
  const today = dayKey()

  for (let pass = 0; pass < 20; pass++) {
    const { participantes, partidos } = await loadAll(db, Number(torneo.id))
    const bySlot = new Map(participantes.map((p) => [Number(p.slot), p]))
    let changed = false

    // 1) Resolver partidos.
    for (const m of partidos) {
      if (m.status !== 'pendiente' || m.home_slot === null || m.away_slot === null || m.opens_day > today) continue
      const homeBot = bySlot.get(Number(m.home_slot))!.member_id === null
      const awayBot = bySlot.get(Number(m.away_slot))!.member_id === null
      const homeDone = homeBot || !!(await getPlayRow(db, Number(m.id), Number(m.home_slot)))?.finished
      const awayDone = awayBot || !!(await getPlayRow(db, Number(m.id), Number(m.away_slot)))?.finished
      if ((homeDone && awayDone) || today > m.closes_day) {
        await resolveMatch(db, { ...m, home_slot: Number(m.home_slot), away_slot: Number(m.away_slot) }, bySlot)
        changed = true
      }
    }
    if (changed) continue

    // 2) Llenar el cuadro.
    const byStage = (stage: string) =>
      partidos.filter((m) => m.stage === stage).sort((a, b) => Number(a.bracket_pos) - Number(b.bracket_pos))
    const setSlots = async (m: Partido, home: number | null, away: number | null) => {
      if (home === null || away === null || m.home_slot !== null) return
      await db.execute({ sql: 'UPDATE torneo_partidos SET home_slot = ?, away_slot = ? WHERE id = ?', args: [home, away, Number(m.id)] })
      changed = true
    }

    const groupDone = partidos.filter((m) => m.stage === 'G').every((m) => m.status === 'jugado')
    if (groupDone) {
      const standings = computeStandings(participantes, partidos)
      const slotFor = (label: string | null) => {
        if (!label) return null
        const pos = Number(label[0]) - 1
        const group = label.slice(1)
        return GROUPS.includes(group as (typeof GROUPS)[number]) ? standings[group][pos]?.slot ?? null : null
      }
      for (const m of byStage('R16')) await setSlots(m, slotFor(m.home_label), slotFor(m.away_label))
    }
    const winners = (stage: string) => byStage(stage).map((m) => (m.status === 'jugado' ? m.winner_slot : null))
    const r16 = winners('R16')
    for (const m of byStage('QF')) {
      const p = Number(m.bracket_pos)
      await setSlots(m, r16[p * 2] ?? null, r16[p * 2 + 1] ?? null)
    }
    const qf = winners('QF')
    for (const m of byStage('SF')) {
      const p = Number(m.bracket_pos)
      await setSlots(m, qf[p * 2] ?? null, qf[p * 2 + 1] ?? null)
    }
    const sf = byStage('SF')
    if (sf.length === 2 && sf.every((m) => m.status === 'jugado')) {
      for (const m of byStage('F')) await setSlots(m, sf[0].winner_slot, sf[1].winner_slot)
      for (const m of byStage('3P')) await setSlots(m, loserOf(sf[0]), loserOf(sf[1]))
    }

    const final = byStage('F')[0]
    const third = byStage('3P')[0]
    if (final?.status === 'jugado' && third?.status === 'jugado') {
      await db.execute({ sql: `UPDATE torneos SET status = 'finalizado' WHERE id = ?`, args: [Number(torneo.id)] })
      return
    }
    if (!changed) return
  }
}
