import { Router } from 'express'
import multer from 'multer'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'
import { aiAvailable, extractEventsFromImage, EventsImageError } from '../lib/eventsFromImage'

const router = Router()

// La imagen del calendario viaja como multipart y se guarda en la base como data URL
// (Vercel no tiene disco). El navegador la reduce antes de subirla.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) return cb(null, true)
    cb(new Error('Solo se aceptan imágenes JPG, PNG o WebP'))
  },
})

function dataUrlParts(dataUrl: string) {
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  return m ? { mediaType: m[1], base64: m[2] } : null
}

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

// GET /api/events/banner - Estado de la imagen del calendario (cualquier usuario logueado)
router.get('/banner', requireAuth, async (_req, res) => {
  try {
    const db = getDatabase()
    // La imagen solo se guarda para la lectura automática: no se muestra en la página.
    const row = (await db.execute('SELECT month_label, updated_at FROM game_events_banner WHERE id = 1')).rows[0] as unknown as
      | { month_label: string; updated_at: string }
      | undefined
    res.json({
      success: true,
      data: row ? { monthLabel: row.month_label, updatedAt: row.updated_at } : null,
      aiAvailable: aiAvailable(),
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo la imagen del calendario' })
  }
})

// POST /api/events/image - Sube la imagen del mes y reemplaza la anterior (solo capitanes)
router.post('/image', requireCaptain, (req, res) => {
  upload.single('image')(req, res, async (err: unknown) => {
    try {
      if (err) return res.status(400).json({ success: false, error: err instanceof Error ? err.message : 'Imagen inválida' })
      if (!req.file) return res.status(400).json({ success: false, error: 'Falta la imagen' })
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`
      const db = getDatabase()
      await db.execute({
        sql: `INSERT INTO game_events_banner (id, month_label, image_data) VALUES (1, '', ?)
              ON CONFLICT(id) DO UPDATE SET image_data = excluded.image_data, month_label = '', updated_at = CURRENT_TIMESTAMP`,
        args: [dataUrl],
      })
      res.json({ success: true, aiAvailable: aiAvailable() })
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message || 'Error guardando la imagen' })
    }
  })
})

// POST /api/events/import-image - Lee la imagen guardada con IA y REEMPLAZA todos los
// eventos por los de la imagen (solo capitanes).
router.post('/import-image', requireCaptain, async (_req, res) => {
  try {
    const db = getDatabase()
    const row = (await db.execute('SELECT image_data FROM game_events_banner WHERE id = 1')).rows[0] as unknown as { image_data: string } | undefined
    const parts = row ? dataUrlParts(row.image_data) : null
    if (!parts) return res.status(400).json({ success: false, error: 'Primero sube la imagen del calendario' })

    const calendar = await extractEventsFromImage(parts.base64, parts.mediaType)
    await db.batch(
      [
        { sql: 'DELETE FROM game_events', args: [] },
        ...calendar.events.map((e, i) => ({
          sql: 'INSERT INTO game_events (month_label, date_label, title, description, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
          args: [calendar.monthLabel, e.dateLabel, e.title, e.description, e.color, i],
        })),
        { sql: 'UPDATE game_events_banner SET month_label = ? WHERE id = 1', args: [calendar.monthLabel] },
      ],
      'write'
    )
    res.json({ success: true, data: { monthLabel: calendar.monthLabel, count: calendar.events.length } })
  } catch (error: any) {
    const status = error instanceof EventsImageError ? error.status : 500
    res.status(status).json({ success: false, error: error.message || 'Error importando la imagen' })
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
