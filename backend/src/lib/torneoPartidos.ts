import type { Client } from '@libsql/client'
import { COUNTRY_NAMES } from './countries'
import { CAREERS, CRESTS, GRID_PLAYERS, WORLD_CUP_SCORERS, crestUrlFor } from './footballData'
import { WORDLE_WORDS } from './minigameContent'
import {
  GAME_KINDS,
  GAME_NAMES,
  applyGameMove,
  buildGameRound,
  crestUrlOf,
  gameView,
  rayoexiExpired,
  type GameData,
  type GameState,
} from './torneoJuegos'
import { computeGeneralRanking } from './generalRanking'
import { dayKey, GameError, hashString, seededRandom, shuffle } from './minigameCore'
import { GROUPS, computeStandings, type Participante, type Partido, type Torneo } from './torneo'

// Partidos del Mundial: 5 rondas de 3 preguntas (sorteadas entre 10 tipos),
// iguales para los dos rivales. Cada ronda la gana quien acierta más (eso es un gol); si
// aciertan lo mismo, nadie mete gol. En eliminatorias, si terminan
// empatados, desempata el total de aciertos y después el tiempo.

export const QUESTIONS_PER_ROUND = 3
export const ROUNDS_PER_MATCH = 5

export interface RoundQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  image?: string | null
  clubs?: Array<{ name: string; image: string | null }>
  // Identifica la pregunta para no repetírsela al mismo jugador en el torneo.
  key?: string
}

export interface MatchPuzzle {
  // v2: 3 rondas de juego + 2 de preguntas, en orden aleatorio.
  v?: number
  rounds: Array<{ type?: string; name: string; key?: string; game?: GameData; questions: RoundQuestion[] }>
}

interface RoundResult {
  score: number
  ms: number
}

interface PlayRow {
  states_json?: string
  answers_json: string
  rounds_json: string
  round_started_at: number | null
  finished: number
  strikes?: number
}

// ---------------------------------------------------------------------------
// Contenido de las rondas
// ---------------------------------------------------------------------------

function pickOptions(correct: string, pool: string[], rand: () => number, count = 4) {
  const others = shuffle(
    Array.from(new Set(pool)).filter((p) => p !== correct),
    rand
  ).slice(0, count - 1)
  const options = shuffle([correct, ...others], rand)
  return { options, correctIndex: options.indexOf(correct) }
}

// Elige "count" candidatos priorizando los que ninguno de los dos jugadores
// tuvo antes en el torneo; si no alcanzan, completa con repetidos.
function pickFresh<T>(items: T[], keyOf: (item: T) => string, used: Set<string>, rand: () => number, count = QUESTIONS_PER_ROUND) {
  const shuffled = shuffle(items, rand)
  const fresh = shuffled.filter((i) => !used.has(keyOf(i)))
  const seen = new Set(fresh.slice(0, count).map(keyOf))
  return [...fresh, ...shuffled.filter((i) => !seen.has(keyOf(i)) && used.has(keyOf(i)))].slice(0, count)
}

interface RoundContext {
  db: Client
  rand: () => number
  used: Set<string>
}

interface RoundType {
  id: string
  name: string
  build: (ctx: RoundContext) => Promise<RoundQuestion[] | null>
}

async function triviaRound(ctx: RoundContext, category: 'futbol' | 'osm', prefix: string) {
  const rows = (
    await ctx.db.execute({
      sql: 'SELECT id, question, options_json, correct_index FROM trivia_questions WHERE category = ? ORDER BY id',
      args: [category],
    })
  ).rows as unknown as Array<{ id: number; question: string; options_json: string; correct_index: number }>
  if (rows.length < QUESTIONS_PER_ROUND) return null
  return pickFresh(rows, (r) => `${prefix}:${r.id}`, ctx.used, ctx.rand).map((q) => {
    const opts = JSON.parse(q.options_json) as string[]
    const correct = opts[Number(q.correct_index)] ?? opts[0]
    const options = shuffle(opts, ctx.rand)
    return { prompt: q.question, options, correctIndex: options.indexOf(correct), key: `${prefix}:${q.id}` }
  })
}

async function loadRoster(db: Client) {
  return (await db.execute(`SELECT name, clan, country_code FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id`))
    .rows as unknown as Array<{ name: string; clan: string; country_code: string }>
}

const ROUND_TYPES: RoundType[] = [
  {
    id: 'trivia',
    name: 'Trivia de fútbol',
    build: (ctx) => triviaRound(ctx, 'futbol', 'trivia'),
  },
  {
    id: 'osm',
    name: 'Trivia OSM',
    build: (ctx) => triviaRound(ctx, 'osm', 'osm'),
  },
  {
    id: 'pais',
    name: 'Selección del clan',
    build: async (ctx) => {
      const roster = (await loadRoster(ctx.db)).filter((r) => COUNTRY_NAMES[(r.country_code ?? '').toLowerCase()])
      if (roster.length < QUESTIONS_PER_ROUND) return null
      const pool = Object.values(COUNTRY_NAMES)
      return pickFresh(roster, (m) => `pais:${m.name}`, ctx.used, ctx.rand).map((m) => ({
        prompt: `¿De qué país es ${m.name}?`,
        key: `pais:${m.name}`,
        ...pickOptions(COUNTRY_NAMES[m.country_code.toLowerCase()], pool, ctx.rand),
      }))
    },
  },
  {
    id: 'clan',
    name: '¿Rayo o Exi?',
    build: async (ctx) => {
      const roster = await loadRoster(ctx.db)
      if (roster.length < QUESTIONS_PER_ROUND) return null
      return pickFresh(roster, (m) => `clan:${m.name}`, ctx.used, ctx.rand).map((m) => ({
        prompt: `¿En qué clan juega ${m.name}?`,
        options: ['Rayo', 'Exiliados'],
        correctIndex: m.clan === 'rayo' ? 0 : 1,
        key: `clan:${m.name}`,
      }))
    },
  },
  {
    id: 'ranking',
    name: 'Mayor o menor del clan',
    build: async (ctx) => {
      const ranking = await computeGeneralRanking(ctx.db)
      const stats = [
        { key: 'pts', label: 'más puntos (PTS)' },
        { key: 'valorActual', label: 'más valor de equipo' },
        { key: 'efectividad', label: 'mejor efectividad en liga' },
      ] as const
      const candidates: Array<{ key: string; question: RoundQuestion }> = []
      for (const stat of stats) {
        const withValue = ranking.filter((e) => typeof e[stat.key] === 'number')
        for (let i = 0; i < 40; i++) {
          const a = withValue[Math.floor(ctx.rand() * withValue.length)]
          const b = withValue[Math.floor(ctx.rand() * withValue.length)]
          if (!a || !b || a.name === b.name || a[stat.key] === b[stat.key]) continue
          const key = `ranking:${stat.key}:${[a.name, b.name].sort().join('|')}`
          if (candidates.some((c) => c.key === key)) continue
          candidates.push({
            key,
            question: {
              prompt: `¿Quién tiene ${stat.label}?`,
              options: [a.name, b.name],
              correctIndex: (a[stat.key] as number) > (b[stat.key] as number) ? 0 : 1,
              key,
            },
          })
        }
      }
      if (candidates.length < QUESTIONS_PER_ROUND) return null
      return pickFresh(candidates, (c) => c.key, ctx.used, ctx.rand).map((c) => c.question)
    },
  },
  {
    id: 'goles',
    name: 'Goleadores mundialistas',
    build: async (ctx) => {
      const pairs: Array<{ key: string; question: RoundQuestion }> = []
      for (let i = 0; i < WORLD_CUP_SCORERS.length; i++) {
        for (let j = i + 1; j < WORLD_CUP_SCORERS.length; j++) {
          const [a, b] = ctx.rand() < 0.5 ? [WORLD_CUP_SCORERS[i], WORLD_CUP_SCORERS[j]] : [WORLD_CUP_SCORERS[j], WORLD_CUP_SCORERS[i]]
          if (a.goals === b.goals) continue
          const key = `goles:${[a.name, b.name].sort().join('|')}`
          pairs.push({
            key,
            question: { prompt: '¿Quién hizo más goles en Mundiales?', options: [a.name, b.name], correctIndex: a.goals > b.goals ? 0 : 1, key },
          })
        }
      }
      // Que no se repita el mismo goleador dentro de la ronda.
      const chosen: RoundQuestion[] = []
      const names = new Set<string>()
      for (const c of pickFresh(pairs, (p) => p.key, ctx.used, ctx.rand, pairs.length)) {
        if (c.question.options.some((n) => names.has(n))) continue
        c.question.options.forEach((n) => names.add(n))
        chosen.push(c.question)
        if (chosen.length === QUESTIONS_PER_ROUND) break
      }
      return chosen
    },
  },
  {
    id: 'escudo',
    name: 'Escudos',
    build: async (ctx) => {
      const names = CRESTS.map((c) => c.name)
      return pickFresh(CRESTS, (c) => `escudo:${c.name}`, ctx.used, ctx.rand).map((c) => ({
        prompt: '¿De qué club es este escudo?',
        image: c.url,
        key: `escudo:${c.name}`,
        ...pickOptions(c.name, names, ctx.rand),
      }))
    },
  },
  {
    id: 'trayectoria',
    name: 'Trayectorias',
    build: async (ctx) => {
      const names = CAREERS.map((c) => c.name)
      return pickFresh(CAREERS, (c) => `trayectoria:${c.name}`, ctx.used, ctx.rand).map((c) => ({
        prompt: '¿Qué jugador hizo esta carrera?',
        clubs: c.clubs.map((name) => ({ name, image: crestUrlFor(name) })),
        key: `trayectoria:${c.name}`,
        ...pickOptions(c.name, names, ctx.rand),
      }))
    },
  },
  {
    id: 'anagrama',
    name: 'Anagrama',
    build: async (ctx) => {
      const words = WORDLE_WORDS.map((w) => w.word)
      return pickFresh(WORDLE_WORDS, (w) => `anagrama:${w.word}`, ctx.used, ctx.rand).map((w) => {
        // Letras mezcladas, asegurando que no quede igual a la palabra.
        let scrambled = w.word
        for (let i = 0; i < 10 && scrambled === w.word; i++) scrambled = shuffle(w.word.split(''), ctx.rand).join('')
        return {
          prompt: `Ordená las letras: ${scrambled.split('').join(' · ')} — ${w.hint}`,
          key: `anagrama:${w.word}`,
          ...pickOptions(w.word, words, ctx.rand),
        }
      })
    },
  },
  {
    id: 'cruce',
    name: 'Cruce de la grilla',
    build: async (ctx) => {
      // "¿Quién jugó en X y en Y?" / "¿Quién jugó en X y es de Y?"
      const clubCount = new Map<string, number>()
      for (const p of GRID_PLAYERS) for (const c of p.clubs) clubCount.set(c, (clubCount.get(c) ?? 0) + 1)
      const bigClubs = [...clubCount.entries()].filter(([, n]) => n >= 15).map(([c]) => c)
      const nations = [...new Set(GRID_PLAYERS.map((p) => p.nation))].filter((n) => GRID_PLAYERS.filter((p) => p.nation === n).length >= 12)
      const candidates: Array<{ key: string; question: RoundQuestion }> = []
      for (let i = 0; i < 80 && candidates.length < 30; i++) {
        const clubA = bigClubs[Math.floor(ctx.rand() * bigClubs.length)]
        const useNation = ctx.rand() < 0.5
        const other = useNation ? nations[Math.floor(ctx.rand() * nations.length)] : bigClubs[Math.floor(ctx.rand() * bigClubs.length)]
        if (!clubA || !other || clubA === other) continue
        const matchA = (p: (typeof GRID_PLAYERS)[number]) => p.clubs.includes(clubA)
        const matchB = (p: (typeof GRID_PLAYERS)[number]) => (useNation ? p.nation === other : p.clubs.includes(other))
        const both = GRID_PLAYERS.filter((p) => matchA(p) && matchB(p))
        // Distractores: cumplen una sola de las dos condiciones (más difícil).
        const half = GRID_PLAYERS.filter((p) => matchA(p) !== matchB(p))
        if (both.length === 0 || half.length < 3) continue
        const answer = both[Math.floor(ctx.rand() * both.length)]
        const key = `cruce:${answer.name}`
        if (candidates.some((c) => c.key === key)) continue
        const options = shuffle([answer.name, ...shuffle(half, ctx.rand).slice(0, 3).map((p) => p.name)], ctx.rand)
        candidates.push({
          key,
          question: {
            prompt: useNation ? `¿Quién jugó en ${clubA} y es de ${other}?` : `¿Quién jugó en ${clubA} y en ${other}?`,
            options,
            correctIndex: options.indexOf(answer.name),
            key,
          },
        })
      }
      if (candidates.length < QUESTIONS_PER_ROUND) return null
      return pickFresh(candidates, (c) => c.key, ctx.used, ctx.rand).map((c) => c.question)
    },
  },
]

// Arma las 5 rondas de un partido: sortea 5 tipos de ronda distintos entre
// los 10 posibles, y en cada una evita las preguntas que alguno de los dos
// jugadores ya tuvo en el torneo.
// Rondas de preguntas que pueden salir (las otras ya son juegos reales).
const QUESTION_ROUND_IDS = ['trivia', 'osm', 'pais', 'ranking', 'goles']
const GAME_ROUNDS = 3
const QUESTION_ROUNDS = 2

export async function buildMatchPuzzle(db: Client, matchId: number, used: Set<string>): Promise<MatchPuzzle> {
  const rand = seededRandom(hashString(`torneo-partido:${matchId}`))

  // Cuántas veces ya jugaron estos jugadores cada tipo: primero los menos vistos.
  const usage = new Map<string, number>()
  for (const key of used) usage.set(key.split(':')[0], (usage.get(key.split(':')[0]) ?? 0) + 1)
  const byUsage = <T extends { id: string }>(items: T[]) =>
    shuffle(items, rand).sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))

  const rounds: MatchPuzzle['rounds'] = []

  // 3 juegos de los 5 posibles.
  const gameKinds = byUsage(GAME_KINDS.map((id) => ({ id })))
  const gameRounds: MatchPuzzle['rounds'] = []
  for (const { id } of gameKinds) {
    if (gameRounds.length === GAME_ROUNDS) break
    const built = await buildGameRound(id, { db, rand, used })
    if (built) gameRounds.push({ type: id, name: GAME_NAMES[id], key: built.key, game: built.game, questions: [] })
  }

  // 2 rondas de preguntas de las 5 posibles.
  const questionTypes = byUsage(ROUND_TYPES.filter((t) => QUESTION_ROUND_IDS.includes(t.id)))
  const questionRounds: MatchPuzzle['rounds'] = []
  const withRepeats: MatchPuzzle['rounds'] = []
  for (const type of questionTypes) {
    if (questionRounds.length === QUESTION_ROUNDS) break
    const questions = await type.build({ db, rand, used })
    if (!questions || questions.length < QUESTIONS_PER_ROUND) continue
    const round = { type: type.id, name: type.name, questions }
    if (questions.every((q) => !q.key || !used.has(q.key))) questionRounds.push(round)
    else withRepeats.push(round)
  }
  while (questionRounds.length < QUESTION_ROUNDS && withRepeats.length > 0) questionRounds.push(withRepeats.shift()!)

  // Si faltó contenido de un lado, se completa con el otro hasta tener 5.
  rounds.push(...gameRounds, ...questionRounds)
  for (const type of questionTypes) {
    if (rounds.length >= ROUNDS_PER_MATCH) break
    if (rounds.some((r) => r.type === type.id)) continue
    const questions = await type.build({ db, rand, used })
    if (questions && questions.length >= QUESTIONS_PER_ROUND) rounds.push({ type: type.id, name: type.name, questions })
  }
  return { v: 2, rounds: shuffle(rounds, rand) }
}

// Armado anterior (solo preguntas). Ya no se usa; queda por si hay que leer
// partidos viejos.
export async function buildLegacyMatchPuzzle(db: Client, matchId: number, used: Set<string>): Promise<MatchPuzzle> {
  const rand = seededRandom(hashString(`torneo-partido:${matchId}`))

  // Cuántas veces ya jugaron estos jugadores cada tipo de ronda (según el
  // prefijo de las preguntas usadas): primero van los menos jugados.
  const prefixOf = (key: string) => key.split(':')[0]
  const usage = new Map<string, number>()
  for (const key of used) usage.set(prefixOf(key), (usage.get(prefixOf(key)) ?? 0) + 1)
  const ordered = shuffle(ROUND_TYPES, rand).sort((a, b) => (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0))

  const rounds: MatchPuzzle['rounds'] = []
  const withRepeats: MatchPuzzle['rounds'] = []
  for (const type of ordered) {
    if (rounds.length === ROUNDS_PER_MATCH) break
    const questions = await type.build({ db, rand, used })
    if (!questions || questions.length < QUESTIONS_PER_ROUND) continue
    const round = { type: type.id, name: type.name, questions }
    // Solo entra si las 3 preguntas son nuevas para los dos jugadores.
    if (questions.every((q) => !q.key || !used.has(q.key))) rounds.push(round)
    else withRepeats.push(round)
  }
  // Si no alcanzan rondas sin repetir (torneo muy largo), se completa.
  while (rounds.length < ROUNDS_PER_MATCH && withRepeats.length > 0) rounds.push(withRepeats.shift()!)
  return { rounds }
}

// Preguntas que ya tuvieron estos jugadores en otros partidos del torneo.
async function usedKeysFor(db: Client, matchId: number) {
  const m = (
    await db.execute({ sql: 'SELECT torneo_id, home_slot, away_slot FROM torneo_partidos WHERE id = ?', args: [matchId] })
  ).rows[0] as unknown as { torneo_id: number; home_slot: number | null; away_slot: number | null } | undefined
  const used = new Set<string>()
  if (!m) return used
  const slots = [m.home_slot, m.away_slot].filter((s): s is number => s !== null)
  if (slots.length === 0) return used
  const rows = (
    await db.execute({
      sql: `SELECT r.puzzle_json FROM torneo_rondas r JOIN torneo_partidos p ON p.id = r.match_id
            WHERE p.torneo_id = ? AND p.id != ? AND (p.home_slot IN (${slots.map(() => '?').join(', ')}) OR p.away_slot IN (${slots
              .map(() => '?')
              .join(', ')}))`,
      args: [m.torneo_id, matchId, ...slots, ...slots],
    })
  ).rows as unknown as Array<{ puzzle_json: string }>
  for (const r of rows) {
    const puzzle = JSON.parse(r.puzzle_json) as MatchPuzzle
    for (const round of puzzle.rounds) {
      if (round.key) used.add(round.key)
      for (const q of round.questions) if (q.key) used.add(q.key)
    }
  }
  return used
}

export async function getMatchPuzzle(db: Client, matchId: number): Promise<MatchPuzzle> {
  const read = async () =>
    (await db.execute({ sql: 'SELECT puzzle_json FROM torneo_rondas WHERE match_id = ?', args: [matchId] })).rows[0] as unknown as
      | { puzzle_json: string }
      | undefined
  const existing = await read()
  if (existing) return JSON.parse(existing.puzzle_json) as MatchPuzzle
  const puzzle = await buildMatchPuzzle(db, matchId, await usedKeysFor(db, matchId))
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
    states: play ? (JSON.parse(play.states_json || '[]') as Array<GameState & { answers?: unknown[] }>) : [],
    startedAt: play?.round_started_at ?? null,
    roundActive: !!play && play.round_started_at !== null && !play.finished,
    finished: !!play?.finished,
    strikes: Number(play?.strikes ?? 0),
  }
}

// ---- Partidos v2 (3 juegos + 2 preguntas) ----

async function saveRound(
  db: Client,
  matchId: number,
  slot: number,
  states: unknown[],
  rounds: RoundResult[],
  roundStartedAt: number | null,
  finished: boolean
) {
  await db.execute({
    sql: `UPDATE torneo_jugadas SET states_json = ?, rounds_json = ?, round_started_at = ?, finished = ?, updated_at = CURRENT_TIMESTAMP
          WHERE match_id = ? AND slot = ?`,
    args: [JSON.stringify(states), JSON.stringify(rounds), roundStartedAt, finished ? 1 : 0, matchId, slot],
  })
}

// Una jugada de la ronda en curso: respuesta a una pregunta, intento de
// palabra o club, casilla de la grilla, etc.
export async function playMove(db: Client, m: Partido, slot: number, body: any) {
  if (!isMatchOpen(m)) throw new GameError('Este partido ya no está abierto')
  const puzzle = await getMatchPuzzle(db, Number(m.id))
  if (puzzle.v !== 2) throw new GameError('Este partido usa el formato anterior')
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play || play.round_started_at === null) throw new GameError('Primero empezá la ronda')
  if (play.finished) throw new GameError('Ya jugaste este partido')

  const rounds = JSON.parse(play.rounds_json) as RoundResult[]
  const states = JSON.parse(play.states_json || '[]') as Array<any>
  const roundIndex = rounds.length
  const round = puzzle.rounds[roundIndex]
  if (!round) throw new GameError('No hay más rondas')
  const now = Date.now()
  const startedAt = Number(play.round_started_at)

  let state = states[roundIndex] ?? {}
  let done = false
  let score = 0
  let feedback: Record<string, unknown> | undefined

  if (round.game) {
    const result = applyGameMove(round.game, state, body, startedAt, now)
    state = result.state
    done = result.done
    score = result.score ?? 0
    feedback = result.feedback
  } else {
    // Ronda de preguntas: responde la siguiente pregunta de las 3.
    const answers: number[] = [...(state.answers ?? [])]
    const question = round.questions[answers.length]
    const answer = Number(body?.answer)
    if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) throw new GameError('Respuesta inválida')
    answers.push(answer)
    state = { answers }
    feedback = { correctIndex: question.correctIndex, correct: answer === question.correctIndex }
    if (answers.length >= round.questions.length) {
      done = true
      score = answers.filter((a, i) => a === round.questions[i].correctIndex).length
    }
  }

  states[roundIndex] = state
  if (done) rounds.push({ score, ms: now - startedAt })
  const finished = done && rounds.length >= puzzle.rounds.length
  await saveRound(db, Number(m.id), slot, states, rounds, done ? null : startedAt, finished)
  return { feedback, roundDone: done, roundScore: done ? score : undefined, finished }
}

// Anti trampa: salió de la ventana en plena ronda. La primera vez es un aviso;
// de ahí en adelante pierde la ronda en curso (0 puntos).
export async function registerStrike(db: Client, m: Partido, slot: number) {
  if (!isMatchOpen(m)) throw new GameError('Este partido ya no está abierto')
  const puzzle = await getMatchPuzzle(db, Number(m.id))
  if (puzzle.v !== 2) throw new GameError('Este partido usa el formato anterior')
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play || play.round_started_at === null || play.finished) throw new GameError('No hay una ronda en curso')

  const strikes = Number(play.strikes ?? 0) + 1
  await db.execute({ sql: 'UPDATE torneo_jugadas SET strikes = ? WHERE match_id = ? AND slot = ?', args: [strikes, Number(m.id), slot] })
  if (strikes === 1) return { strikes, lost: false as const }

  const rounds = JSON.parse(play.rounds_json) as RoundResult[]
  const states = JSON.parse(play.states_json || '[]') as Array<any>
  const roundIndex = rounds.length
  const round = puzzle.rounds[roundIndex]
  const startedAt = Number(play.round_started_at)
  states[roundIndex] = { ...(states[roundIndex] ?? {}), forfeited: true, submitted: true }
  rounds.push({ score: 0, ms: Date.now() - startedAt })
  const finished = rounds.length >= puzzle.rounds.length
  await saveRound(db, Number(m.id), slot, states, rounds, null, finished)
  return { strikes, lost: true as const, roundName: round?.name ?? '', finished }
}

// Si empezó el ¿Rayo o Exi? y cerró la página sin mandar las respuestas, al
// vencer el tiempo la ronda se cierra con 0.
export async function settleExpiredRound(db: Client, m: Partido, slot: number) {
  const play = await getPlayRow(db, Number(m.id), slot)
  if (!play || play.finished || play.round_started_at === null) return
  const puzzle = await getMatchPuzzle(db, Number(m.id))
  if (puzzle.v !== 2) return
  const rounds = JSON.parse(play.rounds_json) as RoundResult[]
  const round = puzzle.rounds[rounds.length]
  if (!round?.game || round.game.kind !== 'rayoexi' || !rayoexiExpired(Number(play.round_started_at))) return
  const states = JSON.parse(play.states_json || '[]') as Array<any>
  states[rounds.length] = { answers: [], submitted: true }
  rounds.push({ score: 0, ms: Date.now() - Number(play.round_started_at) })
  await saveRound(db, Number(m.id), slot, states, rounds, null, rounds.length >= puzzle.rounds.length)
}

// Lo que ve el jugador de la ronda en curso (sin respuestas).
export async function currentRoundView(db: Client, matchId: number, slot: number) {
  const puzzle = await getMatchPuzzle(db, matchId)
  const progress = await getPlayProgress(db, matchId, slot)
  if (puzzle.v !== 2) return { puzzle, progress, current: null as any }
  const roundIndex = progress.rounds.length
  const round = puzzle.rounds[roundIndex]
  if (!round || !progress.roundActive) return { puzzle, progress, current: null as any }
  const state = (progress.states[roundIndex] ?? {}) as GameState & { answers?: any[] }
  if (round.game) {
    return { puzzle, progress, current: { ...gameView(round.game, state, roundIndex, progress.startedAt), name: round.name } }
  }
  const qIndex = (state.answers ?? []).length
  const q = round.questions[qIndex]
  return {
    puzzle,
    progress,
    current: q
      ? { kind: 'quiz' as const, roundIndex, questionIndex: qIndex, prompt: q.prompt, options: q.options, image: q.image ?? null, clubs: q.clubs ?? null, name: round.name }
      : null,
  }
}

// Escudo de la ronda "Escudo borroso" en curso (el navegador lo pixela).
export async function crestForActiveRound(db: Client, matchId: number, slot: number) {
  const puzzle = await getMatchPuzzle(db, matchId)
  const progress = await getPlayProgress(db, matchId, slot)
  const round = puzzle.rounds[progress.rounds.length]
  if (!round?.game || !progress.roundActive) return null
  return crestUrlOf(round.game)
}

// Los partidos armados con el formato anterior y sin ninguna jugada se
// rearman con el nuevo (los que ya tienen jugadas se respetan).
export async function resetUnplayedLegacyPuzzles(db: Client) {
  await db.execute(
    `DELETE FROM torneo_rondas
     WHERE match_id NOT IN (SELECT match_id FROM torneo_jugadas)
       AND puzzle_json NOT LIKE '%"v":2%'`
  )
}

// ---------------------------------------------------------------------------
// Resolución de partidos y avance del cuadro
// ---------------------------------------------------------------------------

// Los bots aciertan cada pregunta con probabilidad ~50% y tardan entre 25 y
// 70 segundos por ronda. Es determinístico: el bot "jugó" siempre igual.
function botRounds(matchId: number, slot: number): RoundResult[] {
  const rand = seededRandom(hashString(`bot:${matchId}:${slot}`))
  const skill = 0.4 + rand() * 0.25
  return Array.from({ length: ROUNDS_PER_MATCH }, () => ({
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
  while (rounds.length < ROUNDS_PER_MATCH) rounds.push({ score: 0, ms: 999_999 })
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
    for (let i = 0; i < ROUNDS_PER_MATCH; i++) {
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
  const names = (await getMatchPuzzle(db, Number(m.id))).rounds.map((r) => r.name)
  return {
    homeAbsent: h.absent,
    awayAbsent: a.absent,
    rounds: names.map((name, i) => ({
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
  await resetUnplayedLegacyPuzzles(db)
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
