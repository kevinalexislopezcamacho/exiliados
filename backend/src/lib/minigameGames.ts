import type { Client } from '@libsql/client'
import { computeGeneralRanking } from './generalRanking'
import type { ParsedMatch } from './battleReportParser'
import {
  CAREERS,
  CRESTS,
  EXTRA_CLUB_NAMES,
  CLUB_CREST_URLS,
  GRID_CLUBS,
  GRID_PLAYERS,
  GRID_TAG_LABELS,
  NATION_FLAG_CODES,
  WORLD_CUP_SCORERS,
  crestUrlFor,
  type GridPlayer,
  type GridTag,
} from './footballData'
import {
  GameError,
  QUIZ_LENGTH,
  dayKey,
  getOrCreatePuzzle,
  getPlay,
  hashString,
  nextResetAt,
  normalizeName,
  savePlay,
  seededRandom,
  shiftDay,
  shuffle,
  type GameInfo,
  type QuizPuzzle,
  type QuizQuestion,
} from './minigameCore'

// Juegos agregados en la segunda tanda. Los de preguntas (alineación y
// goles) reutilizan el motor de quiz de minigames.ts; el resto tiene su
// propio estado y jugada acá.

// Margen para la latencia: la respuesta puede llegar un poco después de
// que el reloj del navegador marque 0.
const TIMED_GRACE_MS = 5_000
const GRID_MAX_ATTEMPTS = 12
const GRID_WIN_CELLS = 7
const ORDER_SIZE = 5

export const EXTRA_GAMES: GameInfo[] = [
  {
    id: 'ordena-top5',
    name: 'Ordená el top 5',
    description: '5 integrantes: ordenalos de mayor a menor por puntos, valor o efectividad. 3 intentos.',
    category: 'clan',
    kind: 'order',
    maxAttempts: 3,
  },
  {
    id: 'rayo-o-exi',
    name: '¿Rayo o Exi?',
    description: 'Contrarreloj: ¿de qué clan es cada uno? Fácil, medio o difícil. Se gana con el 90%.',
    category: 'clan',
    kind: 'timed',
    maxAttempts: 1,
  },
  {
    id: 'alineacion-ganadora',
    name: 'La alineación ganadora',
    description: '5 partidos reales del clan: con la formación y la presión, ¿se ganó, empató o perdió?',
    category: 'clan',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
    scoreMax: QUIZ_LENGTH,
  },
  {
    id: 'grilla-futbol',
    name: 'Grilla 3×3',
    description: 'Completá la grilla con jugadores que cumplan fila y columna. Se gana con 7 de 9.',
    category: 'futbol',
    kind: 'grid',
    maxAttempts: GRID_MAX_ATTEMPTS,
    scoreMax: 9,
  },
  {
    id: 'trayectoria',
    name: 'Trayectoria',
    description: 'Mirá los clubes por los que pasó y adiviná el jugador. 6 intentos.',
    category: 'futbol',
    kind: 'guess',
    maxAttempts: 6,
  },
  {
    id: 'escudo-borroso',
    name: 'Escudo borroso',
    description: 'Adiviná el club por su escudo pixelado: cada error lo muestra más claro. 6 intentos.',
    category: 'futbol',
    kind: 'guess',
    maxAttempts: 6,
  },
  {
    id: 'mas-menos-goles',
    name: 'Más o menos goles',
    description: '5 duelos de goleadores históricos: ¿quién hizo más goles en Mundiales?',
    category: 'futbol',
    kind: 'quiz',
    maxAttempts: QUIZ_LENGTH,
    scoreMax: QUIZ_LENGTH,
  },
]

// ---------------------------------------------------------------------------
// Preguntas: La alineación ganadora y Más o menos goles
// ---------------------------------------------------------------------------

const RESULT_LABELS: Record<string, string> = { V: 'Victoria', E: 'Empate', D: 'Derrota' }
const RESULT_OPTIONS = ['Victoria', 'Empate', 'Derrota']

async function buildAlineacionPuzzle(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> {
  const rows = (
    await db.execute(`SELECT matches_json FROM battle_reports WHERE clan IN ('rayo', 'exiliados') ORDER BY id ASC`)
  ).rows as unknown as Array<{ matches_json: string }>

  const matches = rows
    .flatMap((r) => JSON.parse(r.matches_json) as ParsedMatch[])
    .filter((m) => {
      const presion = Number(m.detalle?.['PRESIÓN'])
      return (
        RESULT_LABELS[m.resultadoLetra] &&
        Number.isFinite(presion) &&
        String(m.detalle?.['TÁCTICAS__NUESTRA'] ?? '').trim() &&
        String(m.detalle?.['TÁCTICAS__RIVAL'] ?? '').trim()
      )
    })
  if (matches.length < QUIZ_LENGTH) return null

  // Como mucho 3 del mismo resultado, para que "Victoria" no sea siempre la
  // respuesta segura.
  const rand = seededRandom(hashString(`${game.id}:${day}`))
  const picked: ParsedMatch[] = []
  const perResult: Record<string, number> = {}
  for (const m of shuffle(matches, rand)) {
    if ((perResult[m.resultadoLetra] ?? 0) >= 3) continue
    perResult[m.resultadoLetra] = (perResult[m.resultadoLetra] ?? 0) + 1
    picked.push(m)
    if (picked.length === QUIZ_LENGTH) break
  }

  return {
    questions: picked.map((m) => {
      const d = m.detalle
      const estilo = d['ESTILO__NUESTRO'] ? ` (${d['ESTILO__NUESTRO']})` : ''
      const plantilla =
        d['PLANTILLA__YO'] !== undefined && d['PLANTILLA__RIVAL'] !== undefined
          ? ` Plantilla ${d['PLANTILLA__YO']} vs ${d['PLANTILLA__RIVAL']}.`
          : ''
      return {
        prompt:
          `De ${String(m.condicion || '').toLowerCase() || 'local'}, ${d['TÁCTICAS__NUESTRA']}${estilo} contra ${d['TÁCTICAS__RIVAL']}, ` +
          `presión ${d['PRESIÓN']}.${plantilla} ¿Cómo terminó?`,
        options: RESULT_OPTIONS,
        correctIndex: RESULT_OPTIONS.indexOf(RESULT_LABELS[m.resultadoLetra]),
        explanation: `${m.manager} vs ${m.rival}: ${m.resultado} (jornada ${m.jornada}).`,
      }
    }),
  }
}

function buildGolesPuzzle(game: GameInfo, day: string): QuizPuzzle {
  const rand = seededRandom(hashString(`${game.id}:${day}`))
  const questions: QuizQuestion[] = []
  const used = new Set<string>()
  for (let attempt = 0; attempt < 500 && questions.length < QUIZ_LENGTH; attempt++) {
    const a = WORLD_CUP_SCORERS[Math.floor(rand() * WORLD_CUP_SCORERS.length)]
    const b = WORLD_CUP_SCORERS[Math.floor(rand() * WORLD_CUP_SCORERS.length)]
    if (a.name === b.name || a.goals === b.goals || used.has(a.name) || used.has(b.name)) continue
    used.add(a.name)
    used.add(b.name)
    questions.push({
      prompt: '¿Quién hizo más goles en Mundiales?',
      options: [a.name, b.name],
      correctIndex: a.goals > b.goals ? 0 : 1,
      explanation: `${a.name}: ${a.goals} goles · ${b.name}: ${b.goals} goles.`,
    })
  }
  return { questions }
}

// Devuelve undefined si el juego no es uno de estos (lo arma minigames.ts).
export function buildExtraQuiz(db: Client, game: GameInfo, day: string): Promise<QuizPuzzle | null> | undefined {
  if (game.id === 'alineacion-ganadora') return buildAlineacionPuzzle(db, game, day)
  if (game.id === 'mas-menos-goles') return Promise.resolve(buildGolesPuzzle(game, day))
  return undefined
}

// ---------------------------------------------------------------------------
// Ordená el top 5
// ---------------------------------------------------------------------------

interface OrderPuzzle {
  statLabel: string
  // En el orden en que se muestran (mezclados); el orden correcto se
  // calcula ordenando por value.
  items: Array<{ name: string; value: number; display: string }>
}

const ORDER_STATS = [
  { key: 'pts', label: 'puntos (PTS)', format: (v: number) => `${v} pts` },
  { key: 'valorActual', label: 'valor de equipo', format: (v: number) => `${Math.round(v)}M` },
  { key: 'efectividad', label: 'efectividad en liga', format: (v: number) => `${Math.round(v * 100)}%` },
] as const

async function getOrderPuzzle(db: Client, game: GameInfo, day: string) {
  return getOrCreatePuzzle<OrderPuzzle>(db, game.id, day, async () => {
    const ranking = await computeGeneralRanking(db)
    const rand = seededRandom(hashString(`${game.id}:${day}`))
    for (const stat of shuffle([...ORDER_STATS], rand)) {
      const seen = new Set<number>()
      const pool = shuffle(
        ranking.filter((e) => typeof e[stat.key] === 'number'),
        rand
      ).filter((e) => {
        const v = e[stat.key] as number
        // Valores distintos (redondeados como se muestran) para que el
        // orden correcto no sea ambiguo.
        const shown = stat.key === 'pts' ? v : Math.round(v * (stat.key === 'efectividad' ? 100 : 1))
        if (seen.has(shown)) return false
        seen.add(shown)
        return true
      })
      if (pool.length < ORDER_SIZE) continue
      return {
        statLabel: stat.label,
        items: pool.slice(0, ORDER_SIZE).map((e) => {
          const value = e[stat.key] as number
          return { name: e.name, value, display: stat.format(value) }
        }),
      }
    }
    return null
  })
}

function correctOrder(puzzle: OrderPuzzle): string[] {
  return [...puzzle.items].sort((a, b) => b.value - a.value).map((i) => i.name)
}

async function orderState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getOrderPuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }
  const play = await getPlay(db, memberId, game.id, day)
  const attempts = play ? (JSON.parse(play.guesses_json) as string[][]) : []
  const answer = correctOrder(puzzle)
  const finished = !!play?.finished
  return {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    statLabel: puzzle.statLabel,
    items: puzzle.items.map((i) => i.name),
    maxAttempts: game.maxAttempts,
    attempts: attempts.map((order) => ({ order, correct: order.map((name, i) => name === answer[i]) })),
    finished,
    won: !!play?.won,
    answer: finished
      ? answer.map((name) => ({ name, display: puzzle.items.find((i) => i.name === name)!.display }))
      : null,
  }
}

async function orderMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getOrderPuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')
  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')

  const order = Array.isArray(body?.order) ? body.order.map((n: unknown) => String(n)) : []
  const names = puzzle.items.map((i) => i.name)
  if (order.length !== names.length || new Set(order).size !== names.length || order.some((n: string) => !names.includes(n))) {
    throw new GameError('Ordená los 5 integrantes antes de enviar')
  }

  const attempts = play ? (JSON.parse(play.guesses_json) as string[][]) : []
  attempts.push(order)
  const won = order.every((name: string, i: number) => name === correctOrder(puzzle)[i])
  const finished = won || attempts.length >= game.maxAttempts
  await savePlay(db, memberId, game.id, day, attempts, finished, won, won ? attempts.length : null)
  return orderState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// ¿Rayo o Exi? (contrarreloj)
// ---------------------------------------------------------------------------

interface TimedPuzzle {
  members: Array<{ name: string; clan: string }>
}

export type TimedDifficulty = 'facil' | 'medio' | 'dificil'

// Se elige al empezar; cualquiera cuenta como la única partida del día.
export const TIMED_LEVELS: Record<TimedDifficulty, { label: string; total: number; seconds: number }> = {
  facil: { label: 'Fácil', total: 20, seconds: 30 },
  medio: { label: 'Medio', total: 25, seconds: 25 },
  dificil: { label: 'Difícil', total: 30, seconds: 20 },
}

interface TimedMoves {
  startedAt: number
  answers: Array<string | null> | null
  // Las partidas viejas no lo tienen: eran "fácil".
  difficulty?: TimedDifficulty
  // Cuántos integrantes tuvo de verdad (por si el roster era más chico).
  total?: number
}

export function timedLevelOf(movesJson: string) {
  try {
    const moves = JSON.parse(movesJson) as TimedMoves
    const key: TimedDifficulty = moves.difficulty && TIMED_LEVELS[moves.difficulty] ? moves.difficulty : 'facil'
    return { key, ...TIMED_LEVELS[key], total: moves.total ?? TIMED_LEVELS[key].total }
  } catch {
    return { key: 'facil' as TimedDifficulty, ...TIMED_LEVELS.facil }
  }
}

async function getTimedPuzzle(db: Client, game: GameInfo, day: string) {
  const puzzle = await getOrCreatePuzzle<TimedPuzzle>(db, game.id, day, async () => {
    const rows = (
      await db.execute(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id ASC`)
    ).rows as unknown as Array<{ name: string; clan: string }>
    if (rows.length < 10) return null
    const rand = seededRandom(hashString(`${game.id}:${day}`))
    // Se guardan hasta 30 (el difícil); fácil y medio usan los primeros.
    return {
      members: shuffle(rows, rand)
        .slice(0, TIMED_LEVELS.dificil.total)
        .map((r) => ({ name: r.name, clan: r.clan })),
    }
  })
  // Retos guardados antes de que hubiera dificultades tienen solo 20: se
  // completan hasta 30 sin tocar los que ya estaban (para quien ya jugó).
  if (puzzle && puzzle.members.length < TIMED_LEVELS.dificil.total) {
    const rows = (
      await db.execute(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados') ORDER BY id ASC`)
    ).rows as unknown as Array<{ name: string; clan: string }>
    const used = new Set(puzzle.members.map((m) => m.name))
    const extra = shuffle(
      rows.filter((r) => !used.has(r.name)),
      seededRandom(hashString(`${game.id}:${day}:extra`))
    ).slice(0, TIMED_LEVELS.dificil.total - puzzle.members.length)
    if (extra.length > 0) {
      puzzle.members.push(...extra.map((r) => ({ name: r.name, clan: r.clan })))
      await db.execute({
        sql: 'UPDATE minigame_puzzles SET puzzle_json = ? WHERE game = ? AND day = ?',
        args: [JSON.stringify(puzzle), game.id, day],
      })
    }
  }
  return puzzle
}

function timedWinThreshold(total: number) {
  return Math.ceil(total * 0.9)
}

function levelMembers(puzzle: TimedPuzzle, difficulty: TimedDifficulty) {
  return puzzle.members.slice(0, TIMED_LEVELS[difficulty].total)
}

async function timedState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getTimedPuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }
  const base = {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    levels: (Object.keys(TIMED_LEVELS) as TimedDifficulty[]).map((key) => {
      const total = Math.min(TIMED_LEVELS[key].total, puzzle.members.length)
      return {
        key,
        label: TIMED_LEVELS[key].label,
        total,
        seconds: TIMED_LEVELS[key].seconds,
        winThreshold: timedWinThreshold(total),
      }
    }),
  }

  const play = await getPlay(db, memberId, game.id, day)
  if (!play) return { ...base, started: false, finished: false, won: false }

  const moves = JSON.parse(play.guesses_json) as TimedMoves
  const difficulty = timedLevelOf(play.guesses_json).key
  const members = levelMembers(puzzle, difficulty)
  const limitMs = TIMED_LEVELS[difficulty].seconds * 1000
  const level = {
    difficulty,
    difficultyLabel: TIMED_LEVELS[difficulty].label,
    total: members.length,
    timeLimitSec: TIMED_LEVELS[difficulty].seconds,
    winThreshold: timedWinThreshold(members.length),
  }

  // Si empezó y nunca mandó las respuestas (cerró la página), la partida
  // se da por terminada con lo que haya: nada.
  if (!play.finished && Date.now() > moves.startedAt + limitMs + TIMED_GRACE_MS * 3) {
    await savePlay(db, memberId, game.id, day, { ...moves, answers: [] }, true, false, 0)
    return timedState(db, game, memberId)
  }

  if (!play.finished) {
    return {
      ...base,
      ...level,
      started: true,
      finished: false,
      won: false,
      names: members.map((m) => m.name),
      remainingMs: Math.max(0, moves.startedAt + limitMs - Date.now()),
    }
  }

  const answers = moves.answers ?? []
  return {
    ...base,
    ...level,
    started: true,
    finished: true,
    won: !!play.won,
    score: play.score ?? 0,
    results: members.map((m, i) => ({
      name: m.name,
      clan: m.clan,
      chosen: answers[i] ?? null,
      ok: answers[i] === m.clan,
    })),
  }
}

async function timedMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getTimedPuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')
  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')

  if (body?.action === 'start') {
    const difficulty: TimedDifficulty = TIMED_LEVELS[body?.difficulty as TimedDifficulty] ? body.difficulty : 'facil'
    if (!play) {
      await savePlay(db, memberId, game.id, day, { startedAt: Date.now(), answers: null, difficulty }, false, false, null)
    }
    return timedState(db, game, memberId)
  }

  if (body?.action !== 'finish' || !play) throw new GameError('Primero tenés que empezar la partida')
  const moves = JSON.parse(play.guesses_json) as TimedMoves
  const difficulty = timedLevelOf(play.guesses_json).key
  const members = levelMembers(puzzle, difficulty)
  const late = Date.now() > moves.startedAt + TIMED_LEVELS[difficulty].seconds * 1000 + TIMED_GRACE_MS
  const raw = Array.isArray(body?.answers) ? body.answers : []
  const answers = members.map((_, i) => {
    const a = raw[i]
    return a === 'rayo' || a === 'exiliados' ? a : null
  })
  // Fuera de tiempo no cuenta ninguna respuesta.
  const score = late ? 0 : answers.filter((a, i) => a === members[i].clan).length
  const won = score >= timedWinThreshold(members.length)
  await savePlay(db, memberId, game.id, day, { ...moves, answers: late ? [] : answers, total: members.length }, true, won, score)
  return timedState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// Grilla 3×3
// ---------------------------------------------------------------------------

interface Criterion {
  id: string
  label: string
  type: 'club' | 'nation' | 'tag'
  value: string
}

interface GridPuzzle {
  rows: Criterion[]
  cols: Criterion[]
}

type GridMove = { cell: number; player: string; ok: boolean } | { giveUp: true }

function matchesCriterion(player: GridPlayer, c: Criterion): boolean {
  if (c.type === 'club') return player.clubs.includes(c.value)
  if (c.type === 'nation') return player.nation === c.value
  return player.tags.includes(c.value as GridTag)
}

function cellPlayers(puzzle: GridPuzzle, cell: number): GridPlayer[] {
  const row = puzzle.rows[Math.floor(cell / 3)]
  const col = puzzle.cols[cell % 3]
  return GRID_PLAYERS.filter((p) => matchesCriterion(p, row) && matchesCriterion(p, col))
}

function gridCriteriaPool(): Criterion[] {
  const count = (fn: (p: GridPlayer) => boolean) => GRID_PLAYERS.filter(fn).length
  const clubs = GRID_CLUBS.filter((club) => CLUB_CREST_URLS[club] && count((p) => p.clubs.includes(club)) >= 6)
    .map((club): Criterion => ({ id: `club:${club}`, label: `Jugó en ${club}`, type: 'club', value: club }))
  const nations = Array.from(new Set(GRID_PLAYERS.map((p) => p.nation)))
    .filter((nation) => count((p) => p.nation === nation) >= 6)
    .map((nation): Criterion => ({ id: `nation:${nation}`, label: nation, type: 'nation', value: nation }))
  const tags = (Object.keys(GRID_TAG_LABELS) as GridTag[]).map(
    (tag): Criterion => ({ id: `tag:${tag}`, label: GRID_TAG_LABELS[tag], type: 'tag', value: tag })
  )
  return [...clubs, ...nations, ...tags]
}

// Encabezado de fila/columna: escudo si es un club, bandera si es una
// selección, y solo texto si es un logro.
function criterionView(c: Criterion) {
  const image =
    c.type === 'club'
      ? CLUB_CREST_URLS[c.value] ?? null
      : c.type === 'nation' && NATION_FLAG_CODES[c.value]
        ? `https://flagcdn.com/w160/${NATION_FLAG_CODES[c.value]}.png`
        : null
  return { label: c.type === 'club' ? c.value : c.label, type: c.type, image }
}

async function getGridPuzzle(db: Client, game: GameInfo, day: string) {
  return getOrCreatePuzzle<GridPuzzle>(db, game.id, day, async () => {
    const pool = gridCriteriaPool()
    const rand = seededRandom(hashString(`${game.id}:${day}`))
    // Que no sea solo de clubes, y que cada casilla tenga al menos 3
    // respuestas posibles (si algún día no sale, se acepta con 2).
    for (const [minPerCell, tries] of [[3, 20000], [2, 5000]]) {
      for (let attempt = 0; attempt < tries; attempt++) {
        const picked = shuffle(pool, rand).slice(0, 6)
        const puzzle = { rows: picked.slice(0, 3), cols: picked.slice(3, 6) }
        if (picked.every((c) => c.type === 'club')) continue
        if (Array.from({ length: 9 }, (_, cell) => cellPlayers(puzzle, cell).length).every((n) => n >= minPerCell)) return puzzle
      }
    }
    return null
  })
}

async function gridState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getGridPuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }
  const play = await getPlay(db, memberId, game.id, day)
  const moves = play ? (JSON.parse(play.guesses_json) as GridMove[]) : []
  const guesses = moves.filter((m): m is { cell: number; player: string; ok: boolean } => 'cell' in m)
  const cells: Array<string | null> = Array(9).fill(null)
  for (const g of guesses) if (g.ok) cells[g.cell] = g.player
  const finished = !!play?.finished

  return {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    rows: puzzle.rows.map(criterionView),
    cols: puzzle.cols.map(criterionView),
    cells,
    attemptsUsed: guesses.length,
    maxAttempts: game.maxAttempts,
    winCells: GRID_WIN_CELLS,
    wrong: guesses.filter((g) => !g.ok).map((g) => ({ cell: g.cell, player: g.player })),
    players: GRID_PLAYERS.map((p) => p.name).sort((a, b) => a.localeCompare(b)),
    finished,
    won: !!play?.won,
    score: cells.filter(Boolean).length,
    // Al terminar, algunas respuestas posibles de cada casilla.
    examples: finished
      ? Array.from({ length: 9 }, (_, cell) =>
          cellPlayers(puzzle, cell)
            .map((p) => p.name)
            .filter((name) => name !== cells[cell])
            .slice(0, 3)
        )
      : null,
  }
}

async function gridMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getGridPuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')
  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')
  const moves = play ? (JSON.parse(play.guesses_json) as GridMove[]) : []
  const guesses = moves.filter((m): m is { cell: number; player: string; ok: boolean } => 'cell' in m)
  const filled = new Set(guesses.filter((g) => g.ok).map((g) => g.cell))

  const finish = async (list: GridMove[]) => {
    const score = new Set(list.filter((m): m is { cell: number; player: string; ok: boolean } => 'cell' in m && m.ok).map((m) => m.cell)).size
    await savePlay(db, memberId, game.id, day, list, true, score >= GRID_WIN_CELLS, score)
  }

  if (body?.giveUp) {
    await finish([...moves, { giveUp: true }])
    return gridState(db, game, memberId)
  }

  const cell = Number(body?.cell)
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) throw new GameError('Elegí una casilla')
  if (filled.has(cell)) throw new GameError('Esa casilla ya está completa')
  const player = GRID_PLAYERS.find((p) => normalizeName(p.name) === normalizeName(String(body?.player ?? '')))
  if (!player) throw new GameError('Elegí un jugador de la lista')
  if (guesses.some((g) => g.ok && g.player === player.name)) throw new GameError('Ya usaste a ese jugador en otra casilla')

  const row = puzzle.rows[Math.floor(cell / 3)]
  const col = puzzle.cols[cell % 3]
  const ok = matchesCriterion(player, row) && matchesCriterion(player, col)
  const next: GridMove[] = [...moves, { cell, player: player.name, ok }]
  const used = guesses.length + 1
  const filledNow = filled.size + (ok ? 1 : 0)
  if (filledNow === 9 || used >= game.maxAttempts) await finish(next)
  else await savePlay(db, memberId, game.id, day, next, false, false, null)
  return gridState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// Trayectoria y Escudo borroso (adivinar un nombre de una lista)
// ---------------------------------------------------------------------------

interface GuessPuzzle {
  answer: string
}

// Niveles de pixelado del escudo (cantidad de bloques de ancho), del más
// borroso al más claro: uno por cada error.
const CREST_LEVELS = [5, 8, 12, 18, 28, 44]

function guessOptions(game: GameInfo): string[] {
  const names =
    game.id === 'trayectoria'
      ? [...CAREERS.map((c) => c.name), ...GRID_PLAYERS.map((p) => p.name)]
      : [...CRESTS.map((c) => c.name), ...EXTRA_CLUB_NAMES]
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
}

async function getGuessPuzzle(db: Client, game: GameInfo, day: string) {
  return getOrCreatePuzzle<GuessPuzzle>(db, game.id, day, async () => {
    const pool = game.id === 'trayectoria' ? CAREERS.map((c) => c.name) : CRESTS.map((c) => c.name)
    const yesterday = (
      await db.execute({
        sql: 'SELECT puzzle_json FROM minigame_puzzles WHERE game = ? AND day = ?',
        args: [game.id, shiftDay(day, -1)],
      })
    ).rows[0] as unknown as { puzzle_json: string } | undefined
    const yesterdayAnswer = yesterday ? (JSON.parse(yesterday.puzzle_json) as GuessPuzzle).answer : null
    let index = hashString(`${game.id}:${day}`) % pool.length
    if (pool[index] === yesterdayAnswer) index = (index + 1) % pool.length
    return { answer: pool[index] }
  })
}

export async function getCrestUrlForToday(db: Client, game: GameInfo): Promise<string | null> {
  const puzzle = await getGuessPuzzle(db, game, dayKey())
  return CRESTS.find((c) => c.name === puzzle?.answer)?.url ?? null
}

async function guessState(db: Client, game: GameInfo, memberId: number) {
  const day = dayKey()
  const puzzle = await getGuessPuzzle(db, game, day)
  if (!puzzle) return { day, empty: true as const, game }
  const play = await getPlay(db, memberId, game.id, day)
  const guesses = play ? (JSON.parse(play.guesses_json) as string[]) : []
  const finished = !!play?.finished
  const wrong = guesses.filter((g) => g !== puzzle.answer).length

  let clue: unknown
  const hints: Array<{ label: string; value: string }> = []
  if (game.id === 'trayectoria') {
    const career = CAREERS.find((c) => c.name === puzzle.answer)!
    clue = { type: 'career', clubs: career.clubs.map((name) => ({ name, image: crestUrlFor(name) })) }
    if (wrong >= 2 || finished) hints.push({ label: 'Nacionalidad', value: career.nation })
    if (wrong >= 4 || finished) hints.push({ label: 'Posición', value: career.position })
  } else {
    const crest = CRESTS.find((c) => c.name === puzzle.answer)!
    clue = { type: 'crest', pixels: finished ? null : CREST_LEVELS[Math.min(wrong, CREST_LEVELS.length - 1)] }
    if (wrong >= 3 || finished) hints.push({ label: 'País', value: crest.country })
  }

  return {
    day,
    empty: false as const,
    game,
    nextResetAt: nextResetAt(day),
    maxAttempts: game.maxAttempts,
    options: guessOptions(game),
    clue,
    hints,
    guesses: guesses.map((name) => ({ name, ok: name === puzzle.answer })),
    finished,
    won: !!play?.won,
    answer: finished ? puzzle.answer : null,
  }
}

async function guessMove(db: Client, game: GameInfo, memberId: number, body: any) {
  const day = dayKey()
  const puzzle = await getGuessPuzzle(db, game, day)
  if (!puzzle) throw new GameError('Este juego todavía no tiene contenido')
  const play = await getPlay(db, memberId, game.id, day)
  if (play?.finished) throw new GameError('Ya terminaste este reto, volvé mañana')

  const guess = guessOptions(game).find((o) => normalizeName(o) === normalizeName(String(body?.guess ?? '')))
  if (!guess) throw new GameError('Elegí una opción de la lista')
  const guesses = play ? (JSON.parse(play.guesses_json) as string[]) : []
  if (guesses.includes(guess)) throw new GameError('Ya probaste esa opción')

  guesses.push(guess)
  const won = guess === puzzle.answer
  const finished = won || guesses.length >= game.maxAttempts
  await savePlay(db, memberId, game.id, day, guesses, finished, won, won ? guesses.length : null)
  return guessState(db, game, memberId)
}

// ---------------------------------------------------------------------------
// Despacho por tipo de juego
// ---------------------------------------------------------------------------

export function isExtraKind(game: GameInfo) {
  return game.kind === 'order' || game.kind === 'timed' || game.kind === 'grid' || game.kind === 'guess'
}

export function extraState(db: Client, game: GameInfo, memberId: number) {
  if (game.kind === 'order') return orderState(db, game, memberId)
  if (game.kind === 'timed') return timedState(db, game, memberId)
  if (game.kind === 'grid') return gridState(db, game, memberId)
  return guessState(db, game, memberId)
}

export function extraMove(db: Client, game: GameInfo, memberId: number, body: any) {
  if (game.kind === 'order') return orderMove(db, game, memberId, body)
  if (game.kind === 'timed') return timedMove(db, game, memberId, body)
  if (game.kind === 'grid') return gridMove(db, game, memberId, body)
  return guessMove(db, game, memberId, body)
}

// Cómo se agrupa la distribución de resultados en las estadísticas.
export function distributionSpec(game: GameInfo): {
  title: string
  labels: string[]
  index: (score: number, won: boolean, movesJson: string) => number | null
} {
  if (game.kind === 'quiz') {
    return {
      title: 'Respuestas correctas por partida',
      labels: Array.from({ length: QUIZ_LENGTH + 1 }, (_, i) => String(i)),
      index: (score) => score,
    }
  }
  if (game.kind === 'timed') {
    return {
      title: 'Partidas por dificultad',
      labels: ['Fácil ✓', 'Medio ✓', 'Difícil ✓', 'Perdidas'],
      index: (_score, won, movesJson) => (won ? ['facil', 'medio', 'dificil'].indexOf(timedLevelOf(movesJson).key) : 3),
    }
  }
  if (game.kind === 'grid') {
    return {
      title: 'Casillas completadas (de 9)',
      labels: ['≤5', '6', '7', '8', '9'],
      index: (score) => Math.max(0, score - 5),
    }
  }
  return {
    title: 'Intentos para acertar',
    labels: Array.from({ length: game.maxAttempts }, (_, i) => String(i + 1)),
    index: (score, won) => (won ? score - 1 : null),
  }
}
