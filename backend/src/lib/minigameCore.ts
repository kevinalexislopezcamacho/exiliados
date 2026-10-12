import type { Client } from '@libsql/client'
import type { TriviaCategory } from './minigameContent'

// Utilidades compartidas por todos los minijuegos: catálogo, día del juego,
// aleatoriedad determinística y guardado de partidas.

export type GameKind = 'guess-member' | 'quiz' | 'wordle' | 'order' | 'timed' | 'grid' | 'guess'
export type GameCategory = 'clan' | 'futbol' | 'osm' | 'competencias'

export interface GameInfo {
  id: string
  name: string
  description: string
  category: GameCategory
  kind: GameKind
  maxAttempts: number
  // Juegos que se puntúan por aciertos (5 preguntas, 20 integrantes, 9
  // casillas): el máximo posible. Los de "adivinar" no lo tienen: su score
  // es en cuántos intentos se acertó.
  scoreMax?: number
  triviaCategory?: TriviaCategory
}

export const QUIZ_LENGTH = 5

// Las trivias y quizzes de 5 preguntas se ganan con 4 o 5 correctas.
export function quizWinThreshold(total: number) {
  return Math.ceil(total * 0.8)
}

export interface QuizQuestion {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface QuizPuzzle {
  questions: QuizQuestion[]
}

// El "día" del juego corta a medianoche de UTC-6 (hora de México, sin
// horario de verano), para que el reto cambie a una hora sensata para el
// clan y sea el mismo para todos sin importar su zona horaria.
const DAY_OFFSET_MS = 6 * 60 * 60 * 1000

export function dayKey(now = new Date()): string {
  return new Date(now.getTime() - DAY_OFFSET_MS).toISOString().slice(0, 10)
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

export function nextResetAt(day: string): string {
  const [y, m, d] = shiftDay(day, 1).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + DAY_OFFSET_MS).toISOString()
}

export function hashString(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Compara nombres sin importar mayúsculas, acentos ni espacios.
export function normalizeName(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// El reto del día se guarda la primera vez que alguien lo abre, para que no
// cambie aunque el roster, los reportes o el banco de preguntas cambien
// durante el día. Si no hay contenido suficiente no se guarda nada, así se
// genera en cuanto lo haya.
export async function getOrCreatePuzzle<T>(
  db: Client,
  game: string,
  day: string,
  build: () => Promise<T | null>
): Promise<T | null> {
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

export interface PlayRow {
  guesses_json: string
  finished: number
  won: number
  score: number | null
}

export async function getPlay(db: Client, memberId: number, game: string, day: string): Promise<PlayRow | undefined> {
  return (
    await db.execute({
      sql: 'SELECT guesses_json, finished, won, score FROM minigame_plays WHERE member_id = ? AND game = ? AND day = ?',
      args: [memberId, game, day],
    })
  ).rows[0] as unknown as PlayRow | undefined
}

// moves es lo que cada juego necesite guardar de la partida (lista de
// intentos, respuestas, hora de inicio...), siempre serializable a JSON.
export async function savePlay(
  db: Client,
  memberId: number,
  game: string,
  day: string,
  moves: unknown,
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

export class GameError extends Error {}
