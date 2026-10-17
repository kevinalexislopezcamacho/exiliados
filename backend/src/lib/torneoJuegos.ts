import type { Client } from '@libsql/client'
import {
  CAREERS,
  CLUB_CREST_URLS,
  CRESTS,
  EXTRA_CLUB_NAMES,
  GRID_CLUBS,
  GRID_PLAYERS,
  GRID_TAG_LABELS,
  NATION_FLAG_CODES,
  crestUrlFor,
  type GridPlayer,
  type GridTag,
} from './footballData'
import { WORDLE_WORDS } from './minigameContent'
import { GameError, hashString, normalizeName, shuffle } from './minigameCore'

// Rondas de juego de los partidos del Mundial: versiones cortas de los
// minijuegos (Wordle, Escudo borroso, Trayectoria, ¿Rayo o Exi? y Grilla).
// Todas terminan con una puntuación de 0 a 3 para poder compararlas con las
// rondas de preguntas.

export type GameRoundKind = 'wordle' | 'escudo' | 'trayectoria' | 'rayoexi' | 'grilla'
export const GAME_KINDS: GameRoundKind[] = ['wordle', 'escudo', 'trayectoria', 'rayoexi', 'grilla']

export const GAME_NAMES: Record<GameRoundKind, string> = {
  wordle: 'Wordle futbolero',
  escudo: 'Escudo borroso',
  trayectoria: 'Trayectoria',
  rayoexi: '¿Rayo o Exi?',
  grilla: 'Grilla 2×2',
}

export const GAME_ATTEMPTS = 6
export const RAYOEXI_SECONDS = 20

// Tiempo máximo de cada ronda (segundos), según el juego y su dificultad.
// Las rondas de preguntas cuentan las 3 preguntas juntas.
export const ROUND_SECONDS: Record<string, number> = {
  wordle: 120,
  escudo: 60,
  trayectoria: 75,
  rayoexi: RAYOEXI_SECONDS,
  grilla: 150,
  trivia: 60,
  osm: 75,
  pais: 45,
  ranking: 75,
  goles: 60,
}
export const roundLimitSec = (type: string | undefined) => (type ? ROUND_SECONDS[type] : undefined) ?? 90
// Margen para la demora de la red al mandar una jugada justo al límite.
export const TIMER_GRACE_MS = 3_000
export const RAYOEXI_NAMES = 10
const RAYOEXI_GRACE_MS = 5_000
const CREST_LEVELS = [5, 8, 12, 18, 28, 44]

export interface Criterion {
  type: 'club' | 'nation' | 'tag'
  value: string
  label: string
  image: string | null
}

// Datos de cada juego, guardados en el partido (solo en el servidor: la
// respuesta nunca se manda al navegador antes de terminar la ronda).
export type GameData =
  | { kind: 'wordle'; word: string; hint: string }
  | { kind: 'escudo'; answer: string; country: string; url: string }
  | { kind: 'trayectoria'; answer: string; nation: string; position: string; clubs: Array<{ name: string; image: string | null }> }
  | { kind: 'rayoexi'; members: Array<{ name: string; clan: string }> }
  | { kind: 'grilla'; rows: Criterion[]; cols: Criterion[] }

export interface GameBuildContext {
  db: Client
  rand: () => number
  used: Set<string>
}

// Puntaje por intentos: 1-2 → 3, 3-4 → 2, 5-6 → 1, sin acertar → 0.
export function attemptScore(attempts: number) {
  return attempts <= 2 ? 3 : attempts <= 4 ? 2 : 1
}

const stripKey = (s: string) => normalizeName(s)

function pickFresh<T>(items: T[], keyOf: (i: T) => string, used: Set<string>, rand: () => number): T | null {
  const shuffled = shuffle(items, rand)
  return shuffled.find((i) => !used.has(keyOf(i))) ?? shuffled[0] ?? null
}

// ---------------------------------------------------------------------------
// Armado
// ---------------------------------------------------------------------------

function matchesCriterion(player: GridPlayer, c: Criterion): boolean {
  if (c.type === 'club') return player.clubs.includes(c.value)
  if (c.type === 'nation') return player.nation === c.value
  return player.tags.includes(c.value as GridTag)
}

function criteriaPool(): Criterion[] {
  const count = (fn: (p: GridPlayer) => boolean) => GRID_PLAYERS.filter(fn).length
  const clubs = GRID_CLUBS.filter((c) => CLUB_CREST_URLS[c] && count((p) => p.clubs.includes(c)) >= 6).map(
    (value): Criterion => ({ type: 'club', value, label: value, image: CLUB_CREST_URLS[value] })
  )
  const nations = [...new Set(GRID_PLAYERS.map((p) => p.nation))]
    .filter((n) => count((p) => p.nation === n) >= 6 && NATION_FLAG_CODES[n])
    .map((value): Criterion => ({ type: 'nation', value, label: value, image: `https://flagcdn.com/w160/${NATION_FLAG_CODES[value]}.png` }))
  const tags = (Object.keys(GRID_TAG_LABELS) as GridTag[]).map(
    (value): Criterion => ({ type: 'tag', value, label: GRID_TAG_LABELS[value], image: null })
  )
  return [...clubs, ...nations, ...tags]
}

export async function buildGameRound(kind: GameRoundKind, ctx: GameBuildContext): Promise<{ key?: string; game: GameData } | null> {
  const { rand, used, db } = ctx
  if (kind === 'wordle') {
    const w = pickFresh(WORDLE_WORDS, (x) => `wordle:${x.word}`, used, rand)
    return w ? { key: `wordle:${w.word}`, game: { kind, word: w.word, hint: w.hint } } : null
  }
  if (kind === 'escudo') {
    const c = pickFresh(CRESTS, (x) => `escudo:${x.name}`, used, rand)
    return c ? { key: `escudo:${c.name}`, game: { kind, answer: c.name, country: c.country, url: c.url } } : null
  }
  if (kind === 'trayectoria') {
    const c = pickFresh(CAREERS, (x) => `trayectoria:${x.name}`, used, rand)
    if (!c) return null
    return {
      key: `trayectoria:${c.name}`,
      game: { kind, answer: c.name, nation: c.nation, position: c.position, clubs: c.clubs.map((name) => ({ name, image: crestUrlFor(name) })) },
    }
  }
  if (kind === 'rayoexi') {
    const roster = (await db.execute(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id`))
      .rows as unknown as Array<{ name: string; clan: string }>
    if (roster.length < RAYOEXI_NAMES) return null
    return { game: { kind, members: shuffle(roster, rand).slice(0, RAYOEXI_NAMES).map((r) => ({ name: r.name, clan: r.clan })) } }
  }
  // Grilla 2×2: cada casilla con al menos 3 respuestas posibles.
  const pool = criteriaPool()
  for (let attempt = 0; attempt < 4000; attempt++) {
    const picked = shuffle(pool, rand).slice(0, 4)
    const rows = picked.slice(0, 2)
    const cols = picked.slice(2, 4)
    if (picked.every((c) => c.type === 'club')) continue
    const ok = [0, 1, 2, 3].every((cell) => {
      const r = rows[Math.floor(cell / 2)]
      const c = cols[cell % 2]
      return GRID_PLAYERS.filter((p) => matchesCriterion(p, r) && matchesCriterion(p, c)).length >= 3
    })
    if (!ok) continue
    const key = `grilla:${[...picked.map((p) => p.value)].sort().join('|')}`
    if (used.has(key) && attempt < 3000) continue
    return { key, game: { kind: 'grilla', rows, cols } }
  }
  return null
}

// ---------------------------------------------------------------------------
// Estado de cada ronda y jugadas
// ---------------------------------------------------------------------------

export interface GameState {
  guesses?: string[]
  cells?: Array<string | null>
  wrong?: string[]
  tries?: number
  answers?: Array<string | null>
  submitted?: boolean
}

function clubOptions() {
  return [...CRESTS.map((c) => c.name), ...EXTRA_CLUB_NAMES].sort((a, b) => a.localeCompare(b))
}
function playerOptions() {
  return [...new Set([...CAREERS.map((c) => c.name), ...GRID_PLAYERS.map((p) => p.name)])].sort((a, b) => a.localeCompare(b))
}

function normalizeWord(raw: string) {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function scoreWord(guess: string, word: string): Array<'match' | 'present' | 'miss'> {
  const result: Array<'match' | 'present' | 'miss'> = Array(word.length).fill('miss')
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

function rayoexiScore(correct: number) {
  return correct >= 9 ? 3 : correct >= 7 ? 2 : correct >= 5 ? 1 : 0
}

export function gridScore(filled: number) {
  return filled >= 4 ? 3 : filled === 3 ? 2 : filled === 2 ? 1 : 0
}

// Lo que ve el jugador mientras juega la ronda.
export function gameView(game: GameData, state: GameState, roundIndex: number, startedAt: number | null, now = Date.now()) {
  const guesses = state.guesses ?? []
  if (game.kind === 'wordle') {
    return {
      kind: 'wordle' as const,
      roundIndex,
      length: game.word.length,
      hint: game.hint,
      maxAttempts: GAME_ATTEMPTS,
      guesses: guesses.map((g) => ({ word: g, result: scoreWord(g, game.word) })),
    }
  }
  if (game.kind === 'escudo') {
    const wrong = guesses.filter((g) => stripKey(g) !== stripKey(game.answer)).length
    return {
      kind: 'escudo' as const,
      roundIndex,
      pixels: CREST_LEVELS[Math.min(wrong, CREST_LEVELS.length - 1)],
      options: clubOptions(),
      maxAttempts: GAME_ATTEMPTS,
      guesses: guesses.map((g) => ({ name: g, ok: stripKey(g) === stripKey(game.answer) })),
      hints: wrong >= 3 ? [{ label: 'País', value: game.country }] : [],
    }
  }
  if (game.kind === 'trayectoria') {
    const wrong = guesses.length
    return {
      kind: 'trayectoria' as const,
      roundIndex,
      clubs: game.clubs,
      options: playerOptions(),
      maxAttempts: GAME_ATTEMPTS,
      guesses: guesses.map((g) => ({ name: g, ok: stripKey(g) === stripKey(game.answer) })),
      hints: [
        ...(wrong >= 2 ? [{ label: 'Nacionalidad', value: game.nation }] : []),
        ...(wrong >= 4 ? [{ label: 'Posición', value: game.position }] : []),
      ],
    }
  }
  if (game.kind === 'rayoexi') {
    return {
      kind: 'rayoexi' as const,
      roundIndex,
      names: game.members.map((m) => m.name),
      limitSec: RAYOEXI_SECONDS,
      remainingMs: startedAt === null ? RAYOEXI_SECONDS * 1000 : Math.max(0, startedAt + RAYOEXI_SECONDS * 1000 - now),
    }
  }
  return {
    kind: 'grilla' as const,
    roundIndex,
    rows: game.rows.map(({ label, type, image }) => ({ label, type, image })),
    cols: game.cols.map(({ label, type, image }) => ({ label, type, image })),
    cells: state.cells ?? [null, null, null, null],
    wrong: state.wrong ?? [],
    tries: state.tries ?? 0,
    maxAttempts: GAME_ATTEMPTS,
    players: GRID_PLAYERS.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
  }
}

export interface MoveResult {
  state: GameState
  done: boolean
  score?: number
  feedback?: Record<string, unknown>
}

// Aplica una jugada. Si la ronda termina devuelve done y el puntaje 0-3.
export function applyGameMove(game: GameData, state: GameState, body: any, startedAt: number, now = Date.now()): MoveResult {
  const guesses = [...(state.guesses ?? [])]

  if (game.kind === 'wordle') {
    const guess = normalizeWord(String(body?.guess ?? ''))
    if (guess.length !== game.word.length) throw new GameError(`La palabra tiene que tener ${game.word.length} letras`)
    if (guesses.includes(guess)) throw new GameError('Ya probaste esa palabra')
    guesses.push(guess)
    const won = guess === game.word
    const done = won || guesses.length >= GAME_ATTEMPTS
    return { state: { guesses }, done, score: done ? (won ? attemptScore(guesses.length) : 0) : undefined, feedback: done ? { answer: game.word, won } : undefined }
  }

  if (game.kind === 'escudo' || game.kind === 'trayectoria') {
    const options = game.kind === 'escudo' ? clubOptions() : playerOptions()
    const guess = options.find((o) => stripKey(o) === stripKey(String(body?.guess ?? '')))
    if (!guess) throw new GameError('Elegí una opción de la lista')
    if (guesses.includes(guess)) throw new GameError('Ya probaste esa opción')
    guesses.push(guess)
    const won = stripKey(guess) === stripKey(game.answer)
    const done = won || guesses.length >= GAME_ATTEMPTS
    return { state: { guesses }, done, score: done ? (won ? attemptScore(guesses.length) : 0) : undefined, feedback: done ? { answer: game.answer, won } : undefined }
  }

  if (game.kind === 'rayoexi') {
    if (state.submitted) throw new GameError('Ya terminaste esta ronda')
    const raw = Array.isArray(body?.answers) ? body.answers : []
    const answers = game.members.map((_, i) => (raw[i] === 'rayo' || raw[i] === 'exiliados' ? raw[i] : null))
    const late = now > startedAt + RAYOEXI_SECONDS * 1000 + RAYOEXI_GRACE_MS
    const correct = late ? 0 : answers.filter((a, i) => a === game.members[i].clan).length
    return {
      state: { answers: late ? [] : answers, submitted: true },
      done: true,
      score: rayoexiScore(correct),
      feedback: { correct, total: game.members.length, late },
    }
  }

  // Grilla 2×2
  const cells = [...(state.cells ?? [null, null, null, null])]
  const wrong = [...(state.wrong ?? [])]
  let tries = state.tries ?? 0
  const finish = (): MoveResult => {
    const filled = cells.filter(Boolean).length
    return { state: { cells, wrong, tries }, done: true, score: gridScore(filled), feedback: { filled } }
  }
  if (body?.giveUp) return finish()
  const cell = Number(body?.cell)
  if (!Number.isInteger(cell) || cell < 0 || cell > 3) throw new GameError('Elegí una casilla')
  if (cells[cell]) throw new GameError('Esa casilla ya está completa')
  const player = GRID_PLAYERS.find((p) => normalizeName(p.name) === normalizeName(String(body?.player ?? '')))
  if (!player) throw new GameError('Elegí un jugador de la lista')
  if (cells.includes(player.name)) throw new GameError('Ya usaste a ese jugador en otra casilla')
  tries++
  const ok = matchesCriterion(player, game.rows[Math.floor(cell / 2)]) && matchesCriterion(player, game.cols[cell % 2])
  if (ok) cells[cell] = player.name
  else wrong.push(player.name)
  if (cells.every(Boolean) || tries >= GAME_ATTEMPTS) return finish()
  return { state: { cells, wrong, tries }, done: false, feedback: { ok } }
}

// ¿Venció el tiempo del ¿Rayo o Exi? sin que mandara las respuestas?
export function rayoexiExpired(startedAt: number, now = Date.now()) {
  return now > startedAt + RAYOEXI_SECONDS * 1000 + RAYOEXI_GRACE_MS * 2
}

export function crestUrlOf(game: GameData): string | null {
  return game.kind === 'escudo' ? game.url : null
}
