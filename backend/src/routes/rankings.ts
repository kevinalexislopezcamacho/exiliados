import { Router } from 'express'
import { getDatabase } from '../db'
import { requireCaptain } from '../middleware/auth'
import { addClient, removeClient } from '../sse'
import { computeReportRankings } from '../lib/reportRankings'
import { computeSquadRankings } from '../lib/squadRankings'
import { computeGeneralRanking } from '../lib/generalRanking'

const router = Router()

// GET /api/rankings - Ranking de puntos por clan, calculado desde los reportes de batalla (solo capitanes)
router.get('/', requireCaptain, (_req, res) => {
  try {
    const db = getDatabase()
    const data = computeReportRankings(db)
    db.close()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching rankings' })
  }
})

// GET /api/rankings/squads - Ranking de armado (valor/eficiencia) por clan (solo capitanes)
router.get('/squads', requireCaptain, (_req, res) => {
  try {
    const db = getDatabase()
    const data = computeSquadRankings(db)
    db.close()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching squad rankings' })
  }
})

// GET /api/rankings/general - Quinto ranking: combina Rayo + Exiliados (solo capitanes)
router.get('/general', requireCaptain, (_req, res) => {
  try {
    const db = getDatabase()
    const data = computeGeneralRanking(db)
    db.close()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching general ranking' })
  }
})

// GET /api/rankings/stream - Actualizaciones en tiempo real (SSE, solo capitanes)
// Se emite un nuevo evento cada vez que se sube o elimina un reporte de batalla.
router.get('/stream', requireCaptain, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('\n')

  addClient(res)

  const db = getDatabase()
  const data = computeReportRankings(db)
  db.close()
  res.write(`event: rankings\ndata: ${JSON.stringify(data)}\n\n`)

  req.on('close', () => removeClient(res))
})

export default router
