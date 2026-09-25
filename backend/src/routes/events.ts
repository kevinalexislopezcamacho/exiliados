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
router.get('/', requireAuth, async (_req, res) => {
  try {
    const db = getDatabase()
    const rows = (await db.execute('SELECT * FROM game_events ORDER BY month_label DESC, sort_order ASC'))
      .rows as unknown as GameEventRow[]
    res.json({ success: true, data: rows.map(toItem) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los eventos' })
  }
})

// POST /api/events - Crear un evento (solo capitanes)
router.post('/', requireCaptain, async (req, res) => {
  try {
    const { monthLabel, dateLabel, title, description, color } = req.body ?? {}
    if (!monthLabel || !dateLabel || !title) {
      return res.status(400).json({ success: false, error: 'Mes, fecha y título son requeridos' })
    }

    const db = getDatabase()
    const maxOrder = (
      await db.execute({
        sql: 'SELECT COALESCE(MAX(sort_order), -1) as maxOrder FROM game_events WHERE month_label = ?',
        args: [monthLabel],
      })
    ).rows[0] as unknown as { maxOrder: number }

    const result = await db.execute({
      sql: `INSERT INTO game_events (month_label, date_label, title, description, color, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
      args: [monthLabel, dateLabel, title, description || '', color || 'primary', maxOrder.maxOrder + 1],
    })

    const row = (await db.execute({ sql: 'SELECT * FROM game_events WHERE id = ?', args: [Number(result.lastInsertRowid)] }))
      .rows[0] as unknown as GameEventRow

    res.status(201).json({ success: true, data: toItem(row) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error creando el evento' })
  }
})

// PUT /api/events/:id - Editar un evento (solo capitanes)
router.put('/:id', requireCaptain, async (req, res) => {
  try {
    const { monthLabel, dateLabel, title, description, color } = req.body ?? {}
    const db = getDatabase()
    await db.execute({
      sql: `UPDATE game_events SET month_label = ?, date_label = ?, title = ?, description = ?, color = ? WHERE id = ?`,
      args: [monthLabel, dateLabel, title, description || '', color || 'primary', req.params.id],
    })

    const row = (await db.execute({ sql: 'SELECT * FROM game_events WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as GameEventRow | undefined

    if (!row) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' })
    }
    res.json({ success: true, data: toItem(row) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error actualizando el evento' })
  }
})

// DELETE /api/events/:id - Eliminar un evento (solo capitanes)
router.delete('/:id', requireCaptain, async (req, res) => {
  try {
    const db = getDatabase()
    const result = await db.execute({ sql: 'DELETE FROM game_events WHERE id = ?', args: [req.params.id] })

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, error: 'Evento no encontrado' })
    }
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando el evento' })
  }
})

export default router
