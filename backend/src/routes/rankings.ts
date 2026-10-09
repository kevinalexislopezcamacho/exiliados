import { Router } from 'express'
import { getDatabase } from '../db'
import { requireCaptain } from '../middleware/auth'
import { computeReportRankings } from '../lib/reportRankings'
import { computeSquadRankings } from '../lib/squadRankings'
import { computeGeneralRanking } from '../lib/generalRanking'

const router = Router()

// GET /api/rankings - Ranking de puntos por clan, calculado desde los reportes de batalla (solo capitanes)
router.get('/', requireCaptain, async (_req, res) => {
  try {
    const db = getDatabase()
    const data = await computeReportRankings(db)
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching rankings' })
  }
})

// GET /api/rankings/squads - Ranking de armado (valor/eficiencia) por clan (solo capitanes)
router.get('/squads', requireCaptain, async (_req, res) => {
  try {
    const db = getDatabase()
    const data = await computeSquadRankings(db)
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching squad rankings' })
  }
})

// GET /api/rankings/general?period=month - Quinto ranking: combina Rayo +
// Exiliados (solo capitanes). Sin ?period= (o period=all) es el histórico
// completo; period=month filtra la parte de jornadas al mes en curso, según
// la fecha de inicio de cada batalla.
router.get('/general', requireCaptain, async (req, res) => {
  try {
    const db = getDatabase()
    const now = new Date()
    const options =
      req.query.period === 'month'
        ? { onlyMonth: { year: now.getFullYear(), month: now.getMonth() + 1 } }
        : undefined
    const data = await computeGeneralRanking(db, options)
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching general ranking' })
  }
})

export default router
