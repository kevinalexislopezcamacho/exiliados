import { Router } from 'express'
import type { Client } from '@libsql/client'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain, requireSuperAdmin } from '../middleware/auth'
import { dayKey, GameError } from '../lib/minigameCore'
import {
  STAGE_LABELS,
  computeStandings,
  createTorneo,
  deleteTorneo,
  getCurrentTorneo,
  listInscritos,
  markDrawSeen,
  performDraw,
  setInscripcion,
  setPrize,
  TOTAL_PLAYERS,
  type Participante,
  type Partido,
  type Torneo,
} from '../lib/torneo'
import {
  QUESTIONS_PER_ROUND,
  advanceTorneo,
  answerQuestion,
  crestForActiveRound,
  currentRoundView,
  playMove,
  settleExpiredRound,
  getMatchPuzzle,
  getPlayProgress,
  isMatchOpen,
  matchBreakdown,
  startOrResume,
} from '../lib/torneoPartidos'

const router = Router()

function sendError(res: any, error: unknown, fallback: string) {
  if (error instanceof GameError) return res.status(400).json({ success: false, error: error.message })
  console.error(fallback, error)
  return res.status(500).json({ success: false, error: fallback })
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))

function partidoView(m: Partido) {
  return {
    id: Number(m.id),
    stage: m.stage,
    stageLabel: STAGE_LABELS[m.stage],
    group: m.group_letter,
    matchday: num(m.matchday),
    bracketPos: num(m.bracket_pos),
    homeSlot: num(m.home_slot),
    awaySlot: num(m.away_slot),
    homeLabel: m.home_label,
    awayLabel: m.away_label,
    opensDay: m.opens_day,
    closesDay: m.closes_day,
    status: m.status,
    homeGoals: num(m.home_goals),
    awayGoals: num(m.away_goals),
    homePens: num(m.home_pens),
    awayPens: num(m.away_pens),
    winnerSlot: num(m.winner_slot),
  }
}

function participanteView(p: Participante) {
  return {
    slot: Number(p.slot),
    memberId: num(p.member_id),
    isBot: p.member_id === null,
    name: p.name,
    countryCode: p.country_code,
    clan: p.clan,
    pot: Number(p.pot),
    group: p.group_letter,
    groupPos: Number(p.group_pos),
  }
}

async function loadTorneoData(db: Client, torneo: Torneo) {
  const participantes = (
    await db.execute({ sql: 'SELECT * FROM torneo_participantes WHERE torneo_id = ? ORDER BY slot ASC', args: [torneo.id] })
  ).rows as unknown as Participante[]
  const partidos = (
    await db.execute({ sql: 'SELECT * FROM torneo_partidos WHERE torneo_id = ? ORDER BY opens_day ASC, id ASC', args: [torneo.id] })
  ).rows as unknown as Partido[]
  return { participantes, partidos }
}

// GET /api/torneo - Estado completo del torneo actual para la página.
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    let torneo = await getCurrentTorneo(db)
    if (!torneo) return res.json({ success: true, data: { torneo: null, isOrganizer: req.user?.username === 'chicolinas' } })
    await advanceTorneo(db, torneo)
    torneo = (await getCurrentTorneo(db))!
    const memberId = req.user!.id

    const inscritos = await listInscritos(db, torneo.id)
    const { participantes, partidos } = await loadTorneoData(db, torneo)
    const drawSeen = !!(
      await db.execute({
        sql: 'SELECT 1 FROM torneo_sorteo_visto WHERE torneo_id = ? AND member_id = ?',
        args: [torneo.id, memberId],
      })
    ).rows[0]

    const cardRows = (await db.execute(`SELECT member_id, card_url FROM clan_members WHERE member_id IS NOT NULL AND card_url != ''`))
      .rows as unknown as Array<{ member_id: number; card_url: string }>
    const cardByMember = new Map(cardRows.map((r) => [Number(r.member_id), r.card_url]))

    const mySlotRaw = participantes.find((p) => Number(p.member_id) === memberId)?.slot
    const mySlot = mySlotRaw === undefined ? null : Number(mySlotRaw)
    const today = dayKey()
    const myMatches = mySlot === null ? [] : partidos.filter((m) => Number(m.home_slot) === mySlot || Number(m.away_slot) === mySlot)
    const nextMatch = myMatches.find((m) => m.status === 'pendiente')
    let nextMatchView = null
    if (nextMatch) {
      const progress = await getPlayProgress(db, Number(nextMatch.id), mySlot!)
      nextMatchView = { ...partidoView(nextMatch), open: isMatchOpen(nextMatch, today), myFinished: progress.finished, myStarted: progress.started }
    }
    const final = partidos.find((m) => m.stage === 'F')
    const third = partidos.find((m) => m.stage === '3P')
    const podium =
      torneo.status === 'finalizado' && final && third
        ? {
            champion: num(final.winner_slot),
            runnerUp: num(Number(final.winner_slot) === Number(final.home_slot) ? final.away_slot : final.home_slot),
            third: num(third.winner_slot),
          }
        : null

    res.json({
      success: true,
      data: {
        torneo: {
          id: Number(torneo.id),
          name: torneo.name,
          status: torneo.status,
          startDay: torneo.start_day,
          prize: torneo.prize ?? '',
          totalPlayers: TOTAL_PLAYERS,
        },
        today,
        isOrganizer: req.user?.username === 'chicolinas',
        canJoin: req.user?.clan === 'rayo' || req.user?.clan === 'exiliados' || req.user?.role === 'captain',
        inscritos,
        meInscrito: inscritos.some((i) => i.memberId === memberId),
        participantes: participantes.map((p) => ({ ...participanteView(p), cardUrl: cardByMember.get(Number(p.member_id)) ?? '' })),
        drawOrder: torneo.draw_json ? (JSON.parse(torneo.draw_json) as number[]) : [],
        drawSeen,
        mySlot,
        nextMatch: nextMatchView,
        podium,
        grupos: participantes.length > 0 ? computeStandings(participantes, partidos) : {},
        partidos: partidos.map(partidoView),
      },
    })
  } catch (error) {
    sendError(res, error, 'Error cargando el torneo')
  }
})

// POST /api/torneo - Crear un torneo nuevo (capitanes).
router.post('/', requireCaptain, async (req, res) => {
  try {
    await createTorneo(
      getDatabase(),
      String(req.body?.name ?? ''),
      req.user?.full_name ?? req.user?.username ?? '',
      String(req.body?.prize ?? '')
    )
    res.status(201).json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error creando el torneo')
  }
})

// PUT /api/torneo/:id/premio { prize } - Cambiar el premio (solo chicolinas).
router.put('/:id/premio', requireSuperAdmin, async (req, res) => {
  try {
    await setPrize(getDatabase(), Number(req.params.id), String(req.body?.prize ?? ''))
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error guardando el premio')
  }
})

// DELETE /api/torneo/:id - Cancelar el torneo con todo lo suyo (solo chicolinas).
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    await deleteTorneo(getDatabase(), Number(req.params.id))
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error borrando el torneo')
  }
})

// POST /api/torneo/inscripcion { inscribir: boolean } - Anotarse o bajarse.
// Al llenarse los 32 lugares NO se inicia nada solo: solo chicolinas
// inicia el torneo (POST /sorteo).
router.post('/inscripcion', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const torneo = await getCurrentTorneo(db)
    if (!torneo) throw new GameError('No hay torneo abierto')
    const allowed = req.user?.clan === 'rayo' || req.user?.clan === 'exiliados' || req.user?.role === 'captain'
    if (!allowed) throw new GameError('Solo los integrantes de Rayo y Exiliados pueden inscribirse')
    const wantsIn = req.body?.inscribir !== false
    if (wantsIn) {
      const inscritos = await listInscritos(db, torneo.id)
      const already = inscritos.some((i) => i.memberId === req.user!.id)
      if (!already && inscritos.length >= TOTAL_PLAYERS) throw new GameError('Ya están los 32 lugares completos')
    }
    await setInscripcion(db, torneo, req.user!.id, wantsIn)
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error con la inscripción')
  }
})

// POST /api/torneo/sorteo - Iniciar el torneo antes de llenarse: completa con
// bots y hace el sorteo (solo chicolinas).
router.post('/sorteo', requireSuperAdmin, async (req, res) => {
  try {
    const db = getDatabase()
    const torneo = await getCurrentTorneo(db)
    if (!torneo) throw new GameError('No hay torneo')
    await performDraw(db, torneo)
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error haciendo el sorteo')
  }
})

// POST /api/torneo/sorteo-visto - Ya vio la animación del sorteo.
router.post('/sorteo-visto', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const torneo = await getCurrentTorneo(db)
    if (torneo) await markDrawSeen(db, Number(torneo.id), req.user!.id)
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error guardando el sorteo')
  }
})

// --- Partidos ---

async function loadMatch(db: Client, matchId: number) {
  const torneo = await getCurrentTorneo(db)
  if (!torneo) throw new GameError('No hay torneo')
  await advanceTorneo(db, torneo)
  const m = (
    await db.execute({ sql: 'SELECT * FROM torneo_partidos WHERE id = ? AND torneo_id = ?', args: [matchId, torneo.id] })
  ).rows[0] as unknown as Partido | undefined
  if (!m) throw new GameError('Ese partido no existe')
  const { participantes, partidos } = await loadTorneoData(db, torneo)
  return { torneo, m, participantes, partidos }
}

async function matchState(db: Client, matchId: number, memberId: number) {
  const { torneo, m, participantes, partidos } = await loadMatch(db, matchId)
  const bySlot = new Map(participantes.map((p) => [Number(p.slot), p]))
  const mySlotRaw = participantes.find((p) => Number(p.member_id) === memberId)?.slot
  const mySlot = mySlotRaw === undefined ? null : Number(mySlotRaw)
  const side = mySlot !== null && Number(m.home_slot) === mySlot ? 'home' : mySlot !== null && Number(m.away_slot) === mySlot ? 'away' : null
  const standings = participantes.length > 0 ? computeStandings(participantes, partidos) : {}

  // Info del cara a cara: carta del integrante (si tiene), grupo y campaña.
  const sideInfo = async (slot: number | null) => {
    if (slot === null) return null
    const p = bySlot.get(slot)!
    let cardUrl = ''
    if (p.member_id !== null) {
      const row = (await db.execute({ sql: 'SELECT card_url FROM clan_members WHERE member_id = ? LIMIT 1', args: [p.member_id] }))
        .rows[0] as unknown as { card_url: string } | undefined
      cardUrl = row?.card_url ?? ''
    }
    const groupRow = standings[p.group_letter]?.find((r) => r.slot === slot)
    const groupPos = standings[p.group_letter]?.findIndex((r) => r.slot === slot)
    const played = partidos.filter((x) => x.status === 'jugado' && (Number(x.home_slot) === slot || Number(x.away_slot) === slot))
    const form = played.slice(-5).map((x) => (Number(x.winner_slot) === slot ? 'G' : x.winner_slot === null ? 'E' : 'P'))
    return { ...participanteView(p), cardUrl, groupStats: groupRow ?? null, groupPosition: groupPos !== undefined && groupPos >= 0 ? groupPos + 1 : null, form }
  }

  const open = isMatchOpen(m)
  const base = {
    torneoName: torneo.name,
    partido: partidoView(m),
    home: await sideInfo(num(m.home_slot)),
    away: await sideInfo(num(m.away_slot)),
    mySide: side,
    open,
    questionsPerRound: QUESTIONS_PER_ROUND,
  }

  // Mi partida: preguntas ya respondidas (con la correcta) y la actual (sin).
  let play = null
  if (side && m.home_slot !== null && m.away_slot !== null) {
    await settleExpiredRound(db, m, mySlot!)
    const view = await currentRoundView(db, Number(m.id), mySlot!)
    const { puzzle, progress } = view
    const opponentSlot = side === 'home' ? Number(m.away_slot) : Number(m.home_slot)
    const opponentBot = bySlot.get(opponentSlot)!.member_id === null
    const opponentProgress = opponentBot ? null : await getPlayProgress(db, Number(m.id), opponentSlot)

    let current = view.current
    if (puzzle.v !== 2) {
      // Formato anterior (solo preguntas): se arma la pregunta actual como antes.
      const idx = progress.answers.length
      const roundIndex = Math.floor(idx / QUESTIONS_PER_ROUND)
      current =
        !progress.finished && progress.roundActive && puzzle.rounds[roundIndex]
          ? (() => {
              const q = puzzle.rounds[roundIndex].questions[idx % QUESTIONS_PER_ROUND]
              return { kind: 'quiz', roundIndex, questionIndex: idx % QUESTIONS_PER_ROUND, prompt: q.prompt, options: q.options, image: q.image ?? null, clubs: q.clubs ?? null }
            })()
          : null
    }
    play = {
      started: progress.started,
      finished: progress.finished,
      roundActive: progress.roundActive,
      roundNames: puzzle.rounds.map((r) => r.name),
      roundKinds: puzzle.rounds.map((r) => (r.game ? r.game.kind : 'quiz')),
      rounds: progress.rounds.map((r) => r.score),
      current,
      opponentFinished: opponentBot ? true : !!opponentProgress?.finished,
    }
  }

  const result = m.status === 'jugado' && m.home_slot !== null && m.away_slot !== null ? await matchBreakdown(db, m, bySlot) : null
  return { ...base, play, result }
}

// GET /api/torneo/partido/:id - Cara a cara, mi partida y el resultado.
router.get('/partido/:id', requireAuth, async (req, res) => {
  try {
    res.json({ success: true, data: await matchState(getDatabase(), Number(req.params.id), req.user!.id) })
  } catch (error) {
    sendError(res, error, 'Error cargando el partido')
  }
})

// POST /api/torneo/partido/:id/empezar - Empieza el partido o la ronda siguiente.
router.post('/partido/:id/empezar', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const { m, participantes } = await loadMatch(db, Number(req.params.id))
    const mySlot = participantes.find((p) => Number(p.member_id) === req.user!.id)?.slot
    if (mySlot === undefined || (Number(m.home_slot) !== Number(mySlot) && Number(m.away_slot) !== Number(mySlot))) {
      throw new GameError('No jugás este partido')
    }
    await startOrResume(db, m, Number(mySlot))
    res.json({ success: true, data: await matchState(db, Number(req.params.id), req.user!.id) })
  } catch (error) {
    sendError(res, error, 'Error empezando el partido')
  }
})

// POST /api/torneo/partido/:id/responder { answer } - Responde la pregunta actual.
router.post('/partido/:id/responder', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const { m, participantes } = await loadMatch(db, Number(req.params.id))
    const mySlot = participantes.find((p) => Number(p.member_id) === req.user!.id)?.slot
    if (mySlot === undefined || (Number(m.home_slot) !== Number(mySlot) && Number(m.away_slot) !== Number(mySlot))) {
      throw new GameError('No jugás este partido')
    }
    const puzzle = await getMatchPuzzle(db, Number(m.id))
    const feedback =
      puzzle.v === 2
        ? (await playMove(db, m, Number(mySlot), { answer: req.body?.answer })).feedback
        : await answerQuestion(db, m, Number(mySlot), Number(req.body?.answer))
    res.json({ success: true, data: { feedback, state: await matchState(db, Number(req.params.id), req.user!.id) } })
  } catch (error) {
    sendError(res, error, 'Error registrando la respuesta')
  }
})

// POST /api/torneo/partido/:id/jugada - Una jugada de la ronda en curso
// (pregunta, intento de palabra o club, casilla de la grilla, respuestas del
// ¿Rayo o Exi?).
router.post('/partido/:id/jugada', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const { m, participantes } = await loadMatch(db, Number(req.params.id))
    const mySlot = participantes.find((p) => Number(p.member_id) === req.user!.id)?.slot
    if (mySlot === undefined || (Number(m.home_slot) !== Number(mySlot) && Number(m.away_slot) !== Number(mySlot))) {
      throw new GameError('No jugás este partido')
    }
    const result = await playMove(db, m, Number(mySlot), req.body ?? {})
    res.json({ success: true, data: { ...result, state: await matchState(db, Number(req.params.id), req.user!.id) } })
  } catch (error) {
    sendError(res, error, 'Error registrando la jugada')
  }
})

// GET /api/torneo/partido/:id/escudo - Escudo de la ronda "Escudo borroso" en
// curso. Va por acá para que el navegador no vea de qué club es.
router.get('/partido/:id/escudo', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const { m, participantes } = await loadMatch(db, Number(req.params.id))
    const mySlot = participantes.find((p) => Number(p.member_id) === req.user!.id)?.slot
    if (mySlot === undefined || (Number(m.home_slot) !== Number(mySlot) && Number(m.away_slot) !== Number(mySlot))) {
      return res.status(403).json({ success: false, error: 'No jugás este partido' })
    }
    const url = await crestForActiveRound(db, Number(m.id), Number(mySlot))
    if (!url) return res.status(404).json({ success: false, error: 'Sin escudo en esta ronda' })
    const upstream = await fetch(url, { headers: { 'User-Agent': 'exiliados-minijuegos/1.0 (sitio del clan)' } })
    if (!upstream.ok) return res.status(502).json({ success: false, error: 'No se pudo cargar el escudo' })
    res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'image/png')
    res.setHeader('Cache-Control', 'no-store')
    res.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    sendError(res, error, 'Error cargando el escudo')
  }
})

export default router
