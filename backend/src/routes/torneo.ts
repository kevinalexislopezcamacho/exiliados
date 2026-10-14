import { Router } from 'express'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'
import { GameError } from '../lib/minigameCore'
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
  TOTAL_PLAYERS,
  type Participante,
  type Partido,
} from '../lib/torneo'

const router = Router()

function sendError(res: any, error: unknown, fallback: string) {
  if (error instanceof GameError) return res.status(400).json({ success: false, error: error.message })
  console.error(fallback, error)
  return res.status(500).json({ success: false, error: fallback })
}

// GET /api/torneo - Estado completo del torneo actual para la página.
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const torneo = await getCurrentTorneo(db)
    if (!torneo) return res.json({ success: true, data: { torneo: null } })
    const memberId = req.user!.id

    const inscritos = await listInscritos(db, torneo.id)
    const participantes = (
      await db.execute({ sql: 'SELECT * FROM torneo_participantes WHERE torneo_id = ? ORDER BY slot ASC', args: [torneo.id] })
    ).rows as unknown as Participante[]
    const partidos = (
      await db.execute({ sql: 'SELECT * FROM torneo_partidos WHERE torneo_id = ? ORDER BY opens_day ASC, id ASC', args: [torneo.id] })
    ).rows as unknown as Partido[]
    const drawSeen = !!(
      await db.execute({
        sql: 'SELECT 1 FROM torneo_sorteo_visto WHERE torneo_id = ? AND member_id = ?',
        args: [torneo.id, memberId],
      })
    ).rows[0]

    const mySlot = participantes.find((p) => Number(p.member_id) === memberId)?.slot ?? null
    res.json({
      success: true,
      data: {
        torneo: {
          id: Number(torneo.id),
          name: torneo.name,
          status: torneo.status,
          startDay: torneo.start_day,
          totalPlayers: TOTAL_PLAYERS,
        },
        canJoin: req.user?.clan === 'rayo' || req.user?.clan === 'exiliados' || req.user?.role === 'captain',
        inscritos,
        meInscrito: inscritos.some((i) => i.memberId === memberId),
        participantes: participantes.map((p) => ({
          slot: Number(p.slot),
          memberId: p.member_id === null ? null : Number(p.member_id),
          isBot: p.member_id === null,
          name: p.name,
          countryCode: p.country_code,
          clan: p.clan,
          pot: Number(p.pot),
          group: p.group_letter,
          groupPos: Number(p.group_pos),
        })),
        drawOrder: torneo.draw_json ? (JSON.parse(torneo.draw_json) as number[]) : [],
        drawSeen,
        mySlot: mySlot === null ? null : Number(mySlot),
        grupos: participantes.length > 0 ? computeStandings(participantes, partidos) : {},
        partidos: partidos.map((m) => ({
          id: Number(m.id),
          stage: m.stage,
          stageLabel: STAGE_LABELS[m.stage],
          group: m.group_letter,
          matchday: m.matchday === null ? null : Number(m.matchday),
          bracketPos: m.bracket_pos === null ? null : Number(m.bracket_pos),
          homeSlot: m.home_slot === null ? null : Number(m.home_slot),
          awaySlot: m.away_slot === null ? null : Number(m.away_slot),
          homeLabel: m.home_label,
          awayLabel: m.away_label,
          opensDay: m.opens_day,
          closesDay: m.closes_day,
          status: m.status,
          homeGoals: m.home_goals === null ? null : Number(m.home_goals),
          awayGoals: m.away_goals === null ? null : Number(m.away_goals),
          homePens: m.home_pens === null ? null : Number(m.home_pens),
          awayPens: m.away_pens === null ? null : Number(m.away_pens),
          winnerSlot: m.winner_slot === null ? null : Number(m.winner_slot),
        })),
      },
    })
  } catch (error) {
    sendError(res, error, 'Error cargando el torneo')
  }
})

// POST /api/torneo - Crear un torneo nuevo (capitanes).
router.post('/', requireCaptain, async (req, res) => {
  try {
    await createTorneo(getDatabase(), String(req.body?.name ?? ''), req.user?.full_name ?? req.user?.username ?? '')
    res.status(201).json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error creando el torneo')
  }
})

// DELETE /api/torneo/:id - Borrar (cancelar) un torneo con todo lo suyo (capitanes).
router.delete('/:id', requireCaptain, async (req, res) => {
  try {
    await deleteTorneo(getDatabase(), Number(req.params.id))
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error borrando el torneo')
  }
})

// POST /api/torneo/inscripcion { inscribir: boolean } - Anotarse o bajarse.
router.post('/inscripcion', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const torneo = await getCurrentTorneo(db)
    if (!torneo) throw new GameError('No hay torneo abierto')
    const allowed = req.user?.clan === 'rayo' || req.user?.clan === 'exiliados' || req.user?.role === 'captain'
    if (!allowed) throw new GameError('Solo los integrantes de Rayo y Exiliados pueden inscribirse')
    await setInscripcion(db, torneo, req.user!.id, req.body?.inscribir !== false)
    res.json({ success: true })
  } catch (error) {
    sendError(res, error, 'Error con la inscripción')
  }
})

// POST /api/torneo/sorteo - Cerrar inscripción y sortear los grupos (capitanes).
router.post('/sorteo', requireCaptain, async (req, res) => {
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

export default router
