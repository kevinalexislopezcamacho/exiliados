import { Router } from 'express'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'
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
// Exiliados. Sin ?period= (o period=all) es el histórico completo;
// period=month filtra la parte de jornadas a una ventana MÓVIL de 3 meses (hoy
// menos 3 meses), no al mes de calendario — cada reporte va saliendo solo de
// la ventana al cumplir 3 meses desde su fecha de inicio, en vez de
// "reiniciar" todo de golpe el día 1.
//
// Los capitanes ven todo. Los integrantes solo ven el de los últimos 3 meses y
// únicamente a los de su propio clan (el puntaje es el mismo que ven los
// capitanes: se calcula con ambos clanes y recién después se filtra).
router.get('/general', requireAuth, async (req, res) => {
  try {
    const db = getDatabase()
    const isCaptain = req.user?.role === 'captain'
    let options: { onlyFromDate: Date } | undefined
    if (req.query.period === 'month' || !isCaptain) {
      // Medianoche de hoy menos 3 meses: así cualquier fecha de ese día
      // cuenta completo, en vez de quedar afuera por la hora exacta actual.
      const cutoff = new Date()
      cutoff.setHours(0, 0, 0, 0)
      cutoff.setMonth(cutoff.getMonth() - 3)
      options = { onlyFromDate: cutoff }
    }
    const data = await computeGeneralRanking(db, options)
    if (isCaptain) return res.json({ success: true, data })

    // El clan sale del roster (por si se cambió de clan); si no está
    // vinculado, el de la cuenta.
    const rosterClan = (
      await db.execute({ sql: 'SELECT clan FROM clan_members WHERE member_id = ? LIMIT 1', args: [req.user!.id] })
    ).rows[0] as unknown as { clan: string } | undefined
    const clan = rosterClan?.clan ?? req.user?.clan
    res.json({ success: true, data: data.filter((e) => e.clan === clan) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching general ranking' })
  }
})

export default router
