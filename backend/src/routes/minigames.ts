import { Router } from 'express'
import type { Client } from '@libsql/client'
import { getDatabase, getCountryFlag, slugifyUsername } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'
import { computeGeneralRanking } from '../lib/generalRanking'
import { COUNTRY_NAMES } from '../lib/countries'
import { TRIVIA_CATEGORIES, WORDLE_WORDS, type TriviaCategory } from '../lib/minigameContent'

const router = Router()

// ---------------------------------------------------------------------------
// Catálogo de juegos. Todos son diarios: un reto por día, igual para todos,
// y cada integrante lo puede jugar una sola vez hasta el día siguiente.
// ---------------------------------------------------------------------------

type GameKind = 'guess-member' | 'quiz' | 'wordle'
type GameCategory = 'clan' | 'futbol' | 'osm' | 'competencias'

interface GameInfo {
  id: string
  name: string
  description: string
  category: GameCategory
  kind: GameKind
  maxAttempts: number
  triviaCategory?: TriviaCategory
}

const QUIZ_LENGTH = 5

const GAMES: GameInfo[] = [
  {
    id: 'adivina-integrante',
    name: 'Adivina el integrante',
    description: 'Un integrante secreto de Rayo o Exiliados. 6 intentos con pistas.',
    category: 'clan',
    kind: 'guess-member',
    maxAttempts: 6,
  },
  {
    id: 'mayor-menor',
    name: '¿Mayor o menor?',
    description: '5 duelos entre managers: ¿quién tiene más puntos, valor o eficiencia?',
    category: 'clan',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
  },
  {
    id: 'de-donde-es',
    name: '¿De dónde es?',
    description: '5 integrantes del clan: adiviná de qué país es cada uno.',
    category: 'clan',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
  },
  {
    id: 'wordle-futbol',
    name: 'Wordle futbolero',
    description: 'Adiviná el apellido de un jugador (5 letras). 6 intentos.',
    category: 'futbol',
    kind: 'wordle',
    maxAttempts: 6,
  },
  {
    id: 'trivia-futbol',
    name: 'Trivia de fútbol',
    description: '5 preguntas de Mundiales, clubes, jugadores y reglas.',
    category: 'futbol',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
    triviaCategory: 'futbol',
  },
  {
    id: 'trivia-osm',
    name: 'Trivia OSM',
    description: '5 preguntas sobre Online Soccer Manager y sus eventos.',
    category: 'osm',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
    triviaCategory: 'osm',
  },
  {
    id: 'trivia-competencias',
    name: 'Trivia de competencias',
    description: '5 preguntas de BHP, CN, LBH, WCC y demás torneos de la comunidad.',
    category: 'competencias',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
    triviaCategory: 'competencias',
  },
]

const GAMES_BY_ID = new Map(GAMES.map((g) => [g.id, g]))

// ---------------------------------------------------------------------------
// Utilidades de día y aleatoriedad determinística
// ---------------------------------------------------------------------------

// El "día" del juego corta a medianoche de UTC-6 (hora de México, sin
// horario de verano), para que el reto cambie a una hora sensata para el
// clan y sea el mismo para todos sin importar su zona horaria.
const DAY_OFFSET_MS = 6 * 60 * 60 * 1000

function dayKey(now = new Date()): string {
  return new Date(now.getTime() - DAY_OFFSET_MS).toISOString().slice(0, 10)
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

function nextResetAt(day: string): string {
  const [y, m, d] = shiftDay(day, 1).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + DAY_OFFSET_MS).toISOString()
}

function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// El reto del día se guarda la primera vez que alguien lo abre, para que no
// cambie aunque el roster, los reportes o el banco de preguntas cambien
// durante el día. Si no hay contenido suficiente no se guarda nada, así se
// genera en cuanto lo haya.
async function getOrCreatePuzzle<T>(db: Client, game: string, day: string, build: () => Promise<T | null>): Promise<T | null> {
  const read = async () =>
    (await db.execute({ sql: 'SELECT puzzle_json FROM minigame_puzzles WHERE game = ? AND day = ?', args: [game, day] }))
      .rows[0] as unknown as { puzzle_json: string } | undefined

  const existing = await read()
  if (existing) return JSON.parse(existing.puzzle_json) as T

  const puzzle = await build()
  if (!puzzle) return null
  await db.execute({
    sql: 'INSERT OR IGNORE INTO minigame_puzzles (game, day, puzzle_json) VALUES (?, ?, ?)',
    args: [game, day, JSON.stringify(puzzle)],
  })
  const stored = await read()
  return stored ? (JSON.parse(stored.puzzle_json) as T) : puzzle
}

interface PlayRow {
  guesses_json: string
  finished: number
  won: number
  score: number | null
}

async function getPlay(db: Client, memberId: number, game: string, day: string): Promise<PlayRow | undefined> {
  return (
    await db.execute({
      sql: 'SELECT guesses_json, finished, won, score FROM minigame_plays WHERE member_id = ? AND game = ? AND day = ?',
      args: [memberId, game, day],
    })
  ).rows[0] as unknown as PlayRow | undefined
}

async function savePlay(
  db: Client,
  memberId: number,
  game: string,
  day: string,
  moves: unknown[],
  finished: boolean,
  won: boolean,
  score: number | null
) {
  await db.execute({
    sql: `INSERT INTO minigame_plays (member_id, game, day, guesses_json, finished, won, score, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(member_id, game, day) DO UPDATE SET
            guesses_json = excluded.guesses_json,
            finished = excluded.finished,
            won = excluded.won,
            score = excluded.score,
            updated_at = CURRENT_TIMESTAMP`,
    args: [memberId, game, day, JSON.stringify(moves), finished ? 1 : 0, won ? 1 : 0, score],
  })
}

class GameError extends Error {}

// ---------------------------------------------------------------------------
// Juego 1: Adivina el integrante
// ---------------------------------------------------------------------------

const ADIVINA = 'adivina-integrante'
const ADIVINA_MAX = 6

interface Candidate {
  id: number
  name: string
  clan: string
  countryCode: string
  title: string
  role: string
  pts: number | null
  valor: number | null
}

async function loadCandidates(db: Client): Promise<Candidate[]> {
  const rows = (
    await db.execute(`
      SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, m.role
      FROM clan_members cm
      LEFT JOIN members m ON m.id = cm.member_id
      WHERE cm.clan IN ('rayo', 'exiliados')
      ORDER BY cm.id ASC
    `)
  ).rows as unknown as Array<{
    id: number
    name: string
    clan: string
    country_code: string
    title: string
    role: string | null
  }>

  const ranking = await computeGeneralRanking(db)
  const statsBySlug = new Map(ranking.map((e) => [slugifyUsername(e.name), e]))

  return rows.map((r) => {
    const stats = statsBySlug.get(slugifyUsername(r.name))
    return {
      id: Number(r.id),
      name: r.name,
      clan: r.clan,
      countryCode: (r.country_code ?? '').toLowerCase(),
      title: r.title ?? '',
      role: r.role === 'captain' ? 'captain' : 'member',
      pts: stats?.pts ?? null,
      valor: stats?.valorActual !== null && stats?.valorActual !== undefined ? Math.round(stats.valorActual) : null,
    }
  })
}

// La respuesta se fija la primera vez que alguien abre el juego ese día y se
// evita repetir la misma persona que ayer.
async function getAnswer(db: Client, day: string, candidates: Candidate[]): Promise<Candidate> {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const stored = (
    await db.execute({ sql: 'SELECT answer_id FROM minigame_daily WHERE game = ? AND day = ?', args: [ADIVINA, day] })
  ).rows[0] as unknown as { answer_id: number } | undefined
  if (stored && byId.has(Number(stored.answer_id))) return byId.get(Number(stored.answer_id))!

  const yesterday = (
    await db.execute({
      sql: 'SELECT answer_id FROM minigame_daily WHERE game = ? AND day = ?',
      args: [ADIVINA, shiftDay(day, -1)],
    })
  ).rows[0] as unknown as { answer_id: number } | undefined

  let index = hashString(`${ADIVINA}:${day}`) % candidates.length
  if (candidates.length > 1 && yesterday && candidates[index].id === Number(yesterday.answer_id)) {
    index = (index + 1) % candidates.length
  }
  const pick = candidates[index]

  await db.execute({
    sql: 'INSERT OR REPLACE INTO minigame_daily (game, day, answer_id) VALUES (?, ?, ?)',
    args: [ADIVINA, day, pick.id],
  })
  return pick
}

type Closeness = 'match' | 'close' | 'miss'

function compareNumber(guess: number | null, answer: number | null) {
  if (guess === null || answer === null) {
    return { value: guess, result: (guess === answer ? 'match' : 'miss') as Closeness, direction: null }
  }
  if (guess === answer) return { value: guess, result: 'match' as Closeness, direction: null }
  const close = Math.abs(guess - answer) <= Math.max(1, Math.abs(answer) * 0.15)
  return {
    value: guess,
    result: (close ? 'close' : 'miss') as Closeness,
    direction: answer > guess ? ('up' as const) : ('down' as const),
  }
}

function compareTitle(guess: string, answer: string): Closeness {
  const g = guess.trim().toLowerCase()
  const a = answer.trim().toLowerCase()
  if (g === a) return 'match'
  if (g && a && (g.includes(a) || a.includes(g))) return 'close'
  return 'miss'
}

function buildFeedback(guess: Candidate, answer: Candidate) {
  return {
    id: guess.id,
    name: guess.name,
    correct: guess.id === answer.id,
    clan: { value: guess.clan, result: (guess.clan === answer.clan ? 'match' : 'miss') as Closeness },
    nationality: {
      value: guess.countryCode,
      flag: guess.countryCode ? getCountryFlag(guess.countryCode) : '',
      result: (guess.countryCode && guess.countryCode === answer.countryCode ? 'match' : 'miss') as Closeness,
    },
    title: { value: guess.title, result: compareTitle(guess.title, answer.title) },
    role: { value: guess.role, result: (guess.role === answer.role ? 'match' : 'miss') as Closeness },
    pts: compareNumber(guess.pts, answer.pts),
    valor: compareNumber(guess.valor, answer.valor),
  }
}

function publicCandidate(c: Candidate) {
  return { id: c.id, name: c.name, clan: c.clan, flag: c.countryCode ? getCountryFlag(c.countryCode) : '' }
}

async function adivinaState(db: Client, memberId: number) {
  const day = dayKey()
  const candidates = await loadCandidates(db)
  if (candidates.length === 0) return { day, empty: true as const }
  const answer = await getAnswer(db, day, candidates)
  const byId = new Map(candidates.map((c) => [c.id, c]))

  const play = await getPlay(db, memberId, ADIVINA, day)
  const guessIds = play ? (JSON.parse(play.guesses_json) as number[]) : []
  const guesses = guessIds
    .map((id) => byId.get(id))
    .filter((c): c is Candidate => !!c)
    .map((c) => buildFeedback(c, answer))
  const finished = !!play?.finished

  return {
    day,
    empty: false as const,
    maxAttempts: ADIVINA_MAX,
    nextResetAt: nextResetAt(day),
    candidates: candidates.map(publicCandidate),
    guesses,
    finished,
    won: !!play?.won,
    // La respuesta solo se manda cuando ya terminó la partida de hoy.
    answer: finished ? { ...publicCandidate(answer), title: answer.title, pts: answer.pts, valor: answer.valor } : null,
  }
}

async function adivinaMove(db: Client, memberId: number, body: any) {
  const candidateId = Number(body?.candidateId)
  if (!Number.isInteger(candidateId)) throw new GameError('Elegí un integrante de la lista')

  const day = dayKey()
  const candidates = await loadCandidates(db)
  if (!candidates.some((c) => c.id === candidateId)) throw new GameError('Ese integrante no está en el roster')
  const answer = await getAnswer(db, day, candidates)

  const play = await getPlay(db, memberId, ADIVINA, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')
  const guessIds = play ? (JSON.parse(play.guesses_json) as number[]) : []
  if (guessIds.includes(candidateId)) throw new GameError('Ya probaste con ese integrante')

  guessIds.push(candidateId)
  const won = candidateId === answer.id
  const finished = won || guessIds.length >= ADIVINA_MAX
  await savePlay(db, memberId, ADIVINA, day, guessIds, finished, won, won ? guessIds.length : null)
  return adivinaState(db, memberId)
}

// ---------------------------------------------------------------------------
// Juegos de preguntas: trivias, ¿Mayor o menor?, ¿De dónde es?
// Todos comparten el mismo formato: 5 preguntas de opción múltiple, se
// responde de a una y se muestra enseguida si estuvo bien. Se gana con 3+.
// ---------------------------------------------------------------------------

interface QuizQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface QuizPuzzle {
  questions: QuizQuestion[]
}

function quizWinThreshold(total: number) {
  return Math.ceil(total * 0.8)
}

async function buildTriviaPuzzle(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> {
  const rows = (
    await db.execute({
      sql: 'SELECT id, question, options_json, correct_index, explanation FROM trivia_questions WHERE category = ? ORDER BY id ASC',
      args: [game.triviaCategory!],
    })
  ).rows as unknown as Array<{ id: number; question: string; options_json: string; correct_index: number; explanation: string }>
  if (rows.length === 0) return null

  const rand = seededRandom(hashString(`${game.id}:${day}`))
  const picked = shuffle(rows, rand).slice(0, QUIZ_LENGTH)
  return {
    questions: picked.map((row) => {
      const options = JSON.parse(row.options_json) as string[]
      const correct = options[Number(row.correct_index)] ?? options[0]
      const shuffled = shuffle(options, rand)
      return {
        prompt: row.question,
        options: shuffled,
        correctIndex: shuffled.indexOf(correct),
        explanation: row.explanation ?? '',
      }
    }),
  }
}

const COMPARABLE_STATS = [
  { key: 'pts', label: 'más puntos (PTS)', format: (v: number) => `${v} pts` },
  { key: 'valorActual', label: 'más valor de equipo', format: (v: number) => `${Math.round(v)}M` },
  { key: 'eficiencia', label: 'mejor eficiencia de armado', format: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'efectividad', label: 'mejor efectividad en liga', format: (v: number) => `${Math.round(v * 100)}%` },
] as const

async function buildMayorMenorPuzzle(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> {
  const ranking = await computeGeneralRanking(db)
  const rand = seededRandom(hashString(`${game.id}:${day}`))
  const questions: QuizQuestion[] = []
  const usedPairs = new Set<string>()

  for (let attempt = 0; attempt < 200 && questions.length < QUIZ_LENGTH; attempt++) {
    const stat = COMPARABLE_STATS[Math.floor(rand() * COMPARABLE_STATS.length)]
    const withValue = ranking.filter((e) => typeof e[stat.key] === 'number')
    if (withValue.length < 2) continue
    const a = withValue[Math.floor(rand() * withValue.length)]
    const b = withValue[Math.floor(rand() * withValue.length)]
    const va = a[stat.key] as number
    const vb = b[stat.key] as number
    const pairKey = [a.name, b.name].sort().join('|') + stat.key
    if (a.name === b.name || va === vb || usedPairs.has(pairKey)) continue
    usedPairs.add(pairKey)
    questions.push({
      prompt: `¿Quién tiene ${stat.label}?`,
      options: [a.name, b.name],
      correctIndex: va > vb ? 0 : 1,
      explanation: `${a.name}: ${stat.format(va)} · ${b.name}: ${stat.format(vb)}`,
    })
  }
  return questions.length > 0 ? { questions } : null
}

async function buildDeDondeEsPuzzle(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> {
  const rows = (
    await db.execute(`SELECT name, country_code FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id ASC`)
  ).rows as unknown as Array<{ name: string; country_code: string }>
  const members = rows
    .map((r) => ({ name: r.name, code: (r.country_code ?? '').toLowerCase() }))
    .filter((m) => COUNTRY_NAMES[m.code])
  if (members.length === 0) return null

  const rand = seededRandom(hashString(`${game.id}:${day}`))
  const rosterCountries = Array.from(new Set(members.map((m) => m.code)))
  const label = (code: string) => `${getCountryFlag(code)} ${COUNTRY_NAMES[code]}`

  return {
    questions: shuffle(members, rand)
      .slice(0, QUIZ_LENGTH)
      .map((m) => {
        // Distractores: primero otros países que hay en el roster (más
        // difícil), y si faltan, cualquiera de la lista general.
        const pool = shuffle(rosterCountries.filter((c) => c !== m.code), rand)
        const extra = shuffle(Object.keys(COUNTRY_NAMES).filter((c) => c !== m.code && !pool.includes(c)), rand)
        const distractors = [...pool, ...extra].slice(0, 3)
        const options = shuffle([m.code, ...distractors], rand)
        return {
          prompt: `¿De qué país es ${m.name}?`,
          options: options.map(label),
          correctIndex: options.indexOf(m.code),
          explanation: `${m.name} es de ${COUNTRY_NAMES[m.code]}.`,
        }
      }),
  }
}

async function getQuizPuzzle(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> {
  return getOrCreatePuzzle<QuizPuzzle>(db, game.id, day, () => {
    if (game.id === 'mayor-menor') return buildMayorMenorPuzzle(db, game, day)
    if (game.id === 'de-donde-es') return buildDeDondeEsPuzzle(db, game, day)
    return buildTriviaPuzzle(db, game, day)
  })
}

async function quizState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getQuizPuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }

  const play = await getPlay(db, memberId, game.id, day)
  const answers = play ? (JSON.parse(play.guesses_json) as number[]) : []
  const finished = !!play?.finished
  const total = puzzle.questions.length
  const score = answers.filter((a, i) => a === puzzle.questions[i]?.correctIndex).length
  const current = answers.length < total ? puzzle.questions[answers.length] : null

  return {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    total,
    winThreshold: quizWinThreshold(total),
    answered: answers.map((chosen, i) => ({
      prompt: puzzle.questions[i].prompt,
      options: puzzle.questions[i].options,
      chosen,
      correctIndex: puzzle.questions[i].correctIndex,
      explanation: puzzle.questions[i].explanation,
    })),
    // La pregunta en curso va sin la respuesta correcta.
    current: !finished && current ? { index: answers.length, prompt: current.prompt, options: current.options } : null,
    score,
    finished,
    won: !!play?.won,
  }
}

async function quizMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getQuizPuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')

  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')
  const answers = play ? (JSON.parse(play.guesses_json) as number[]) : []
  const question = puzzle.questions[answers.length]
  const answer = Number(body?.answer)
  if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
    throw new GameError('Respuesta inválida')
  }

  answers.push(answer)
  const total = puzzle.questions.length
  const score = answers.filter((a, i) => a === puzzle.questions[i].correctIndex).length
  const finished = answers.length >= total
  const won = finished && score >= quizWinThreshold(total)
  await savePlay(db, memberId, game.id, day, answers, finished, won, score)
  return quizState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// Wordle futbolero
// ---------------------------------------------------------------------------

interface WordlePuzzle {
  word: string
  hint: string
}

type LetterResult = 'match' | 'present' | 'miss'

function normalizeWord(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

// Algoritmo clásico de Wordle, contando letras repetidas correctamente.
function scoreWord(guess: string, word: string): LetterResult[] {
  const result: LetterResult[] = Array(word.length).fill('miss')
  const remaining = new Map<string, number>()
  for (let i = 0; i < word.length; i++) {
    if (guess[i] === word[i]) result[i] = 'match'
    else remaining.set(word[i], (remaining.get(word[i]) ?? 0) + 1)
  }
  for (let i = 0; i < word.length; i++) {
    if (result[i] === 'match') continue
    const left = remaining.get(guess[i]) ?? 0
    if (left > 0) {
      result[i] = 'present'
      remaining.set(guess[i], left - 1)
    }
  }
  return result
}

async function getWordlePuzzle(db: Client, game: GameInfo, day: string): Promise<WordlePuzzle | null> {
  return getOrCreatePuzzle<WordlePuzzle>(db, game.id, day, async () => {
    const yesterday = (
      await db.execute({
        sql: 'SELECT puzzle_json FROM minigame_puzzles WHERE game = ? AND day = ?',
        args: [game.id, shiftDay(day, -1)],
      })
    ).rows[0] as unknown as { puzzle_json: string } | undefined
    const yesterdayWord = yesterday ? (JSON.parse(yesterday.puzzle_json) as WordlePuzzle).word : null
    let index = hashString(`${game.id}:${day}`) % WORDLE_WORDS.length
    if (WORDLE_WORDS[index].word === yesterdayWord) index = (index + 1) % WORDLE_WORDS.length
    return { ...WORDLE_WORDS[index] }
  })
}

async function wordleState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getWordlePuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }

  const play = await getPlay(db, memberId, game.id, day)
  const guesses = play ? (JSON.parse(play.guesses_json) as string[]) : []
  const finished = !!play?.finished
  return {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    length: puzzle.word.length,
    maxAttempts: game.maxAttempts,
    hint: puzzle.hint,
    guesses: guesses.map((g) => ({ word: g, result: scoreWord(g, puzzle.word) })),
    finished,
    won: !!play?.won,
    answer: finished ? puzzle.word : null,
  }
}

async function wordleMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getWordlePuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')

  const guess = normalizeWord(String(body?.guess ?? ''))
  if (guess.length !== puzzle.word.length) throw new GameError(`La palabra tiene que tener ${puzzle.word.length} letras`)

  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')
  const guesses = play ? (JSON.parse(play.guesses_json) as string[]) : []
  if (guesses.includes(guess)) throw new GameError('Ya probaste esa palabra')

  guesses.push(guess)
  const won = guess === puzzle.word
  const finished = won || guesses.length >= game.maxAttempts
  await savePlay(db, memberId, game.id, day, guesses, finished, won, won ? guesses.length : null)
  return wordleState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// Estadísticas y rachas
// ---------------------------------------------------------------------------

function computeStreaks(plays: Array<{ day: string; won: boolean }>, today: string) {
  const byDay = new Map(plays.map((p) => [p.day, p.won]))
  const sorted = [...plays].sort((a, b) => a.day.localeCompare(b.day))

  let maxStreak = 0
  let run = 0
  let prevDay: string | null = null
  for (const p of sorted) {
    if (!p.won) run = 0
    else if (run > 0 && prevDay !== null && shiftDay(prevDay, 1) === p.day) run += 1
    else run = 1
    maxStreak = Math.max(maxStreak, run)
    prevDay = p.day
  }

  // La racha actual sigue viva si hoy todavía no jugó: se cuenta desde ayer.
  let cursor = byDay.has(today) ? today : shiftDay(today, -1)
  let currentStreak = 0
  while (byDay.get(cursor) === true) {
    currentStreak += 1
    cursor = shiftDay(cursor, -1)
  }

  return { currentStreak, maxStreak }
}

async function gameStats(db: Client, game: GameInfo, memberId: number) {
  const today = dayKey()
  const rawPlays = (
    await db.execute({
      sql: 'SELECT member_id, day, won, score, guesses_json FROM minigame_plays WHERE game = ? AND finished = 1',
      args: [game.id],
    })
  ).rows as unknown as Array<{ member_id: number; day: string; won: number; score: number | null; guesses_json: string }>
  // Las primeras partidas de "Adivina el integrante" se guardaron antes de
  // que existiera la columna score: los intentos salen de la lista guardada.
  const plays = rawPlays.map((p) => ({
    ...p,
    score:
      p.score === null && p.won && game.kind !== 'quiz' ? (JSON.parse(p.guesses_json) as unknown[]).length : p.score,
  }))

  const byMember = new Map<number, typeof plays>()
  for (const p of plays) {
    const id = Number(p.member_id)
    byMember.set(id, [...(byMember.get(id) ?? []), p])
  }

  const mine = byMember.get(memberId) ?? []
  // Juegos de adivinar: en cuántos intentos se acertó. Juegos de preguntas:
  // cuántas se respondieron bien (0 a 5).
  const isQuiz = game.kind === 'quiz'
  const distribution = Array.from({ length: isQuiz ? QUIZ_LENGTH + 1 : game.maxAttempts }, () => 0)
  for (const p of mine) {
    if (p.score === null || p.score === undefined) continue
    const index = isQuiz ? Number(p.score) : Number(p.score) - 1
    if (p.won || isQuiz) {
      if (index >= 0 && index < distribution.length) distribution[index] += 1
    }
  }
  const wins = mine.filter((p) => p.won).length
  const myStreaks = computeStreaks(
    mine.map((p) => ({ day: p.day, won: !!p.won })),
    today
  )

  const names = (await db.execute('SELECT id, full_name, username FROM members')).rows as unknown as Array<{
    id: number
    full_name: string | null
    username: string
  }>
  const nameById = new Map(names.map((n) => [Number(n.id), n.full_name || n.username]))

  const leaderboard = Array.from(byMember.entries())
    .map(([id, memberPlays]) => {
      const streaks = computeStreaks(
        memberPlays.map((p) => ({ day: p.day, won: !!p.won })),
        today
      )
      return {
        name: nameById.get(id) ?? '—',
        played: memberPlays.length,
        wins: memberPlays.filter((p) => p.won).length,
        currentStreak: streaks.currentStreak,
        maxStreak: streaks.maxStreak,
      }
    })
    .sort((a, b) => b.currentStreak - a.currentStreak || b.wins - a.wins || b.maxStreak - a.maxStreak)
    .slice(0, 10)

  return {
    kind: game.kind,
    played: mine.length,
    wins,
    losses: mine.length - wins,
    winRate: mine.length > 0 ? wins / mine.length : 0,
    currentStreak: myStreaks.currentStreak,
    maxStreak: myStreaks.maxStreak,
    distribution,
    leaderboard,
  }
}

// ---------------------------------------------------------------------------
// Rutas
// ---------------------------------------------------------------------------

function sendError(res: any, error: unknown, fallback: string) {
  if (error instanceof GameError) return res.status(400).json({ success: false, error: error.message })
  console.error(fallback, error)
  return res.status(500).json({ success: false, error: fallback })
}

// --- Banco de preguntas (solo capitanes). Va antes de "/:game". ---

function parseQuestionBody(body: any) {
  const category = String(body?.category ?? '')
  const question = String(body?.question ?? '').trim()
  const options = Array.isArray(body?.options) ? body.options.map((o: unknown) => String(o ?? '').trim()) : []
  const correctIndex = Number(body?.correctIndex)
  const explanation = String(body?.explanation ?? '').trim()

  if (!TRIVIA_CATEGORIES.includes(category as TriviaCategory)) throw new GameError('Categoría inválida')
  if (!question) throw new GameError('Escribí la pregunta')
  if (options.length < 2 || options.length > 4 || options.some((o: string) => !o)) {
    throw new GameError('Poné entre 2 y 4 opciones, ninguna vacía')
  }
  if (new Set(options.map((o: string) => o.toLowerCase())).size !== options.length) {
    throw new GameError('Las opciones no pueden repetirse')
  }
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
    throw new GameError('Marcá cuál es la opción correcta')
  }
  return { category, question, options, correctIndex, explanation }
}

function toQuestionItem(row: any) {
  return {
    id: Number(row.id),
    category: row.category,
    question: row.question,
    options: JSON.parse(row.options_json) as string[],
    correctIndex: Number(row.correct_index),
    explanation: row.explanation ?? '',
    createdBy: row.created_by ?? null,
  }
}

router.get('/questions', requireCaptain, async (req, res) => {
  try {
    const category = String(req.query.category ?? '')
    const db = getDatabase()
    const rows = TRIVIA_CATEGORIES.includes(category as TriviaCategory)
      ? (await db.execute({ sql: 'SELECT * FROM trivia_questions WHERE category = ? ORDER BY id DESC', args: [category] })).rows
      : (await db.execute('SELECT * FROM trivia_questions ORDER BY id DESC')).rows
    res.json({ success: true, data: rows.map(toQuestionItem) })
  } catch (error) {
    sendError(res, error, 'Error obteniendo las preguntas')
  }
})

router.post('/questions', requireCaptain, async (req, res) => {
  try {
    const q = parseQuestionBody(req.body)
    const db = getDatabase()
    const result = await db.execute({
      sql: `INSERT INTO trivia_questions (category, question, options_json, correct_index, explanation, created_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [q.category, q.question, JSON.stringify(q.options), q.correctIndex, q.explanation, req.user?.full_name ?? req.user?.username ?? null],
    })
    const row = (await db.execute({ sql: 'SELECT * FROM trivia_questions WHERE id = ?', args: [Number(result.lastInsertRowid)] })).rows[0]
    res.status(201).json({ success: true, data: toQuestionItem(row) })
  } catch (error) {
    sendError(res, error, 'Error guardando la pregunta')
  }
})

router.put('/questions/:id', requireCaptain, async (req, res) => {
  try {
    const q = parseQuestionBody(req.body)
    const db = getDatabase()
    const result = await db.execute({
      sql: `UPDATE trivia_questions SET category = ?, question = ?, options_json = ?, correct_index = ?, explanation = ? WHERE id = ?`,
      args: [q.category, q.question, JSON.stringify(q.options), q.correctIndex, q.explanation, req.params.id],
    })
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, error: 'Pregunta no encontrada' })
    const row = (await db.execute({ sql: 'SELECT * FROM trivia_questions WHERE id = ?', args: [req.params.id] })).rows[0]
    res.json({ success: true, data: toQuestionItem(row) })
  } catch (error) {
    sendError(res, error, 'Error actualizando la pregunta')
  }
})

router.delete('/questions/:id', requireCaptain, async (req, res) => {
  try {
    const db = getDatabase()
    const result = await db.execute({ sql: 'DELETE FROM trivia_questions WHERE id = ?', args: [req.params.id] })
    if (result.rowsAffected === 0) return res.status(404).json({ success: false, error: 'Pregunta no encontrada' })
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error borrando la pregunta')
  }
})

// --- Resumen para el panel de minijuegos ---

router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const memberId = req.user!.id
    const day = dayKey()

    const myPlays = (
      await db.execute({
        sql: 'SELECT game, day, finished, won, score, guesses_json FROM minigame_plays WHERE member_id = ?',
        args: [memberId],
      })
    ).rows as unknown as Array<{ game: string; day: string; finished: number; won: number; score: number | null; guesses_json: string }>

    const counts = (
      await db.execute('SELECT category, COUNT(*) as count FROM trivia_questions GROUP BY category')
    ).rows as unknown as Array<{ category: string; count: number }>
    const questionCount = new Map(counts.map((c) => [c.category, Number(c.count)]))

    const games = GAMES.map((game) => {
      const plays = myPlays.filter((p) => p.game === game.id)
      const today = plays.find((p) => p.day === day)
      const streaks = computeStreaks(
        plays.filter((p) => p.finished).map((p) => ({ day: p.day, won: !!p.won })),
        day
      )
      return {
        ...game,
        available: game.triviaCategory ? (questionCount.get(game.triviaCategory) ?? 0) > 0 : true,
        today: today
          ? {
              started: true,
              finished: !!today.finished,
              won: !!today.won,
              // Partidas viejas de "adivina" se guardaron sin score: se usa la cantidad de intentos.
              score: today.score ?? (today.won ? (JSON.parse(today.guesses_json) as unknown[]).length : null),
            }
          : { started: false, finished: false, won: false, score: null },
        currentStreak: streaks.currentStreak,
        maxStreak: streaks.maxStreak,
      }
    })

    // Racha diaria general: días seguidos en los que terminó al menos un juego.
    const daysPlayed = new Set(myPlays.filter((p) => p.finished).map((p) => p.day))
    let cursor = daysPlayed.has(day) ? day : shiftDay(day, -1)
    let dailyStreak = 0
    while (daysPlayed.has(cursor)) {
      dailyStreak += 1
      cursor = shiftDay(cursor, -1)
    }

    res.json({
      success: true,
      data: {
        day,
        nextResetAt: nextResetAt(day),
        games,
        finishedToday: games.filter((g) => g.today.finished).length,
        dailyStreak,
      },
    })
  } catch (error) {
    sendError(res, error, 'Error cargando los minijuegos')
  }
})

// --- Estado, jugada y estadísticas de cada juego ---

function findGame(id: string): GameInfo {
  const game = GAMES_BY_ID.get(id)
  if (!game) throw new GameError('Ese juego no existe')
  return game
}

router.get('/:game', requireAuth, async (req, res) => {
  try {
    const game = findGame(req.params.game)
    const db = getDatabase()
    const memberId = req.user!.id
    const data =
      game.kind === 'guess-member'
        ? await adivinaState(db, memberId)
        : game.kind === 'wordle'
          ? await wordleState(db, game, memberId)
          : await quizState(db, game, memberId)
    res.json({ success: true, data })
  } catch (error) {
    sendError(res, error, 'Error cargando el juego')
  }
})

async function handleMove(req: any, res: any) {
  try {
    const game = findGame(req.params.game)
    const db = getDatabase()
    const memberId = req.user!.id
    const data =
      game.kind === 'guess-member'
        ? await adivinaMove(db, memberId, req.body)
        : game.kind === 'wordle'
          ? await wordleMove(db, game, memberId, req.body)
          : await quizMove(db, game, memberId, req.body)
    res.json({ success: true, data })
  } catch (error) {
    sendError(res, error, 'Error registrando la jugada')
  }
}

router.post('/:game/move', requireAuth, handleMove)
// Ruta vieja del primer juego, se mantiene para no romper la página.
router.post('/:game/guess', requireAuth, handleMove)

router.get('/:game/stats', requireAuth, async (req, res) => {
  try {
    const game = findGame(req.params.game)
    const db = getDatabase()
    res.json({ success: true, data: await gameStats(db, game, req.user!.id) })
  } catch (error) {
    sendError(res, error, 'Error cargando las estadísticas')
  }
})

export default router
