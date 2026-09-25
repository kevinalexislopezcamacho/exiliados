import { Router } from 'express'
import { getDatabase } from '../db'

const router = Router()

// GET /api/stats - Obtener estadísticas del clan
router.get('/', (_req, res) => {
  try {
    const db = getDatabase()
    const stats = db.prepare('SELECT value, label, icon, delay FROM stats ORDER BY sort_order ASC').all()
    db.close()

    res.json({ success: true, data: stats, count: stats.length })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching stats' })
  }
})

export default router
