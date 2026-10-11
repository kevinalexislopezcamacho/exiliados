import { Router } from 'express'
import type { Client } from '@libsql/client'
import { getDatabase, getCountryFlag, slugifyUsername } from '../db'
import { requireAuth } from '../middleware/auth'
import { computeGeneralRanking } from '../lib/generalRanking'

const router = Router()

const GAME = 'adivina-integrante'
const MAX_ATTEMPTS = 6

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

// La respuesta se fija la primera vez que alguien abre el juego ese día, así
// no cambia aunque se agreguen o borren integrantes más tarde. Se evita
// repetir la misma persona que ayer.
async function getAnswer(db: Client, day: string, candidates: Candidate[]): Promise<Candidate> {
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const stored = (
    await db.execute({ sql: 'SELECT answer_id FROM minigame_daily WHERE game = ? AND day = ?', args: [GAME, day] })
  ).rows[0] as unknown as { answer_id: number } | undefined
  if (stored && byId.has(Number(stored.answer_id))) return byId.get(Number(stored.answer_id))!

  const yesterday = (
    await db.execute({
      sql: 'SELECT answer_id FROM minigame_daily WHERE game = ? AND day = ?',
      args: [GAME, shiftDay(day, -1)],
    })
  ).rows[0] as unknown as { answer_id: number } | undefined

  let index = hashString(`${GAME}:${day}`) % candidates.length
  if (candidates.length > 1 && yesterday && candidates[index].id === Number(yesterday.answer_id)) {
    index = (index + 1) % candidates.length
  }
  const pick = candidates[index]

  await db.execute({
    sql: 'INSERT OR REPLACE INTO minigame_daily (game, day, answer_id) VALUES (?, ?, ?)',
    args: [GAME, day, pick.id],
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

async function buildState(db: Client, memberId: number) {
  const day = dayKey()
  const candidates = await loadCandidates(db)
  if (candidates.length === 0) {
    return { day, empty: true as const }
  }
  const answer = await getAnswer(db, day, candidates)
  const byId = new Map(candidates.map((c) => [c.id, c]))

  const play = (
    await db.execute({
      sql: 'SELECT guesses_json, finished, won FROM minigame_plays WHERE member_id = ? AND game = ? AND day = ?',
      args: [memberId, GAME, day],
    })
  ).rows[0] as unknown as { guesses_json: string; finished: number; won: number } | undefined

  const guessIds = play ? (JSON.parse(play.guesses_json) as number[]) : []
  const guesses = guessIds.map((id) => byId.get(id)).filter((c): c is Candidate => !!c).map((c) => buildFeedback(c, answer))
  const finished = !!play?.finished

  return {
    day,
    empty: false as const,
    maxAttempts: MAX_ATTEMPTS,
    nextResetAt: nextResetAt(day),
    candidates: candidates.map(publicCandidate),
    guesses,
    finished,
    won: !!play?.won,
    // La respuesta solo se manda cuando ya terminó la partida de hoy.
    answer: finished ? { ...publicCandidate(answer), title: answer.title, pts: answer.pts, valor: answer.valor } : null,
  }
}

interface FinishedPlay {
  member_id: number
  day: string
  won: number
  guesses_json: string
}

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

// GET /api/minigames/adivina-integrante - Estado del reto de hoy para el usuario
router.get('/adivina-integrante', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    res.json({ success: true, data: await buildState(db, req.user!.id) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error cargando el juego' })
  }
})

// POST /api/minigames/adivina-integrante/guess - Registra un intento
router.post('/adivina-integrante/guess', requireAuth, async (req, res) => {
  try {
    const candidateId = Number(req.body?.candidateId)
    if (!Number.isInteger(candidateId)) {
      return res.status(400).json({ success: false, error: 'Elegí un integrante de la lista' })
    }

    const db = getDatabase()
    const memberId = req.user!.id
    const day = dayKey()
    const candidates = await loadCandidates(db)
    if (!candidates.some((c) => c.id === candidateId)) {
      return res.status(400).json({ success: false, error: 'Ese integrante no está en el roster' })
    }
    const answer = await getAnswer(db, day, candidates)

    const play = (
      await db.execute({
        sql: 'SELECT guesses_json, finished FROM minigame_plays WHERE member_id = ? AND game = ? AND day = ?',
        args: [memberId, GAME, day],
      })
    ).rows[0] as unknown as { guesses_json: string; finished: number } | undefined

    if (play?.finished) {
      return res.status(400).json({ success: false, error: 'Ya terminaste el reto de hoy, volvé mañana' })
    }
    const guessIds = play ? (JSON.parse(play.guesses_json) as number[]) : []
    if (guessIds.includes(candidateId)) {
      return res.status(400).json({ success: false, error: 'Ya probaste con ese integrante' })
    }

    guessIds.push(candidateId)
    const won = candidateId === answer.id
    const finished = won || guessIds.length >= MAX_ATTEMPTS

    await db.execute({
      sql: `INSERT INTO minigame_plays (member_id, game, day, guesses_json, finished, won, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(member_id, game, day) DO UPDATE SET
              guesses_json = excluded.guesses_json,
              finished = excluded.finished,
              won = excluded.won,
              updated_at = CURRENT_TIMESTAMP`,
      args: [memberId, GAME, day, JSON.stringify(guessIds), finished ? 1 : 0, won ? 1 : 0],
    })

    res.json({ success: true, data: await buildState(db, memberId) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error registrando el intento' })
  }
})

// GET /api/minigames/adivina-integrante/stats - Estadísticas del usuario +
// ranking del clan (rachas y victorias). Solo cuentan partidas terminadas.
router.get('/adivina-integrante/stats', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const today = dayKey()
    const plays = (
      await db.execute({
        sql: 'SELECT member_id, day, won, guesses_json FROM minigame_plays WHERE game = ? AND finished = 1',
        args: [GAME],
      })
    ).rows as unknown as FinishedPlay[]

    const byMember = new Map<number, FinishedPlay[]>()
    for (const p of plays) {
      const id = Number(p.member_id)
      byMember.set(id, [...(byMember.get(id) ?? []), p])
    }

    const mine = byMember.get(req.user!.id) ?? []
    const distribution = Array.from({ length: MAX_ATTEMPTS }, () => 0)
    for (const p of mine) {
      if (p.won) {
        const attempts = (JSON.parse(p.guesses_json) as number[]).length
        if (attempts >= 1 && attempts <= MAX_ATTEMPTS) distribution[attempts - 1] += 1
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
      .map(([memberId, memberPlays]) => {
        const streaks = computeStreaks(
          memberPlays.map((p) => ({ day: p.day, won: !!p.won })),
          today
        )
        return {
          name: nameById.get(memberId) ?? '—',
          played: memberPlays.length,
          wins: memberPlays.filter((p) => p.won).length,
          currentStreak: streaks.currentStreak,
          maxStreak: streaks.maxStreak,
        }
      })
      .sort((a, b) => b.currentStreak - a.currentStreak || b.wins - a.wins || b.maxStreak - a.maxStreak)
      .slice(0, 10)

    res.json({
      success: true,
      data: {
        played: mine.length,
        wins,
        losses: mine.length - wins,
        winRate: mine.length > 0 ? wins / mine.length : 0,
        currentStreak: myStreaks.currentStreak,
        maxStreak: myStreaks.maxStreak,
        distribution,
        leaderboard,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error cargando las estadísticas' })
  }
})

export default router
