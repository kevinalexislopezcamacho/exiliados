import { Router } from 'express'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'

const router = Router()

interface GameEventRow {
  id: number
  month_label: string
  date_label: string
  title: string
  description: string
  color: string
  sort_order: number
  created_at: string
}

function toItem(row: GameEventRow) {
  return {
    id: row.id,
    monthLabel: row.month_label,
    dateLabel: row.date_label,
    title: row.title,
    description: row.description,
    color: row.color,
  }
}

// GET /api/events - Calendario de eventos del juego (cualquier usuario logueado)
router.get('/', requireAuth, (_req, res) => {
  try {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM game_events ORDER BY month_label DESC, sort_order ASC')
      .all() as GameEventRow[]
    db.close()
    res.json({ success: true, data: rows.map(toItem) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los eventos' })
  }
})

// POST /api/events - Crear un evento (solo capitanes)
router.post('/', requireCaptain, (req, res) => {
  try {
    const { monthLabel, dateLabel, title, description, color } = req.body ?? {}
    if (!monthLabel || !dateLabel || !title) {
      return res.status(400).json({ success: false, error: 'Mes, fecha y título son requeridos' })
    }

    const db = getDatabase()
    const maxOrder = db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM game_events WHERE month_label = ?')
      .get(monthLabel) as { maxOrder: number }

    const result = db
      .prepare(
        `INSERT INTO game_events (month_label, date_label, title, description, color, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(monthLabel, dateLabel, title, description || '', color || 'primary', maxOrder.maxOrder + 1)

    const row = db.prepare('SELECT * FROM game_events WHERE id = ?').get(result.lastInsertRowid) as GameEventRow
    db.close()

    res.status(201).json({ success: true, data: toItem(row) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error creando el evento' })
  }
})

// PUT /api/events/:id - Editar un evento (solo capitanes)
router.put('/:id', requireCaptain, (req, res) => {
  try {
    const { monthLabel, dateLabel, title, description, color } = req.body ?? {}
    const db = getDatabase()
    db.prepare(
      `UPDATE game_events SET month_label = ?, date_label = ?, title = ?, description = ?, color = ? WHERE id = ?`
    ).run(monthLabel, dateLabel, title, description || '', color || 'primary', req.params.id)

    const row = db.prepare('SELECT * FROM game_events WHERE id = ?').get(req.params.id) as GameEventRow | undefined
    db.close()

    if (!row) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' })
    }
    res.json({ success: true, data: toItem(row) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error actualizando el evento' })
  }
})

// DELETE /api/events/:id - Eliminar un evento (solo capitanes)
router.delete('/:id', requireCaptain, (req, res) => {
  try {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM game_events WHERE id = ?').run(req.params.id)
    db.close()

    if (result.changes === 0) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' })
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando el evento' })
  }
})

export default router
