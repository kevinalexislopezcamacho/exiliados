import { Router } from 'express'
import multer from 'multer'
import { getDatabase } from '../db'
import { requireCaptain, requireReportAccess } from '../middleware/auth'
import { parseSquadWorkbook } from '../lib/squadReportParser'
import { summarizeSquadReport } from '../lib/squadStats'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const okExt = /\.xlsx$/i.test(file.originalname)
    const okMime =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream'
    if (okExt && okMime) return cb(null, true)
    cb(new Error('Solo se aceptan archivos .xlsx'))
  },
})

interface SquadReportRow {
  id: number
  clan: string
  title: string
  opponent: string
  file_name: string
  sheet_name: string
  uploaded_by: string | null
  summary_json: string
  teams_json: string
  created_at: string
}

function toListItem(row: SquadReportRow) {
  return {
    id: row.id,
    clan: row.clan,
    title: row.title,
    opponent: row.opponent,
    fileName: row.file_name,
    sheetName: row.sheet_name,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    summary: JSON.parse(row.summary_json),
  }
}

// GET /api/squad-reports - Lista de reportes de armado (chicolinas ve todos;
// todos los demás, incluidos otros capitanes, solo los de su propio clan, y
// solo si tienen acceso habilitado)
router.get('/', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const rows = (
      req.user?.username === 'chicolinas'
        ? await db.execute('SELECT * FROM squad_reports ORDER BY created_at DESC')
        : await db.execute({
            sql: 'SELECT * FROM squad_reports WHERE clan = ? ORDER BY created_at DESC',
            args: [req.user?.clan ?? ''],
          })
    ).rows as unknown as SquadReportRow[]
    res.json({ success: true, data: rows.map(toListItem) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los reportes de armado' })
  }
})

// GET /api/squad-reports/:id - Detalle completo (chicolinas siempre; todos
// los demás, incluidos otros capitanes, solo si tienen acceso Y el reporte
// es de su propio clan)
router.get('/:id', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const row = (await db.execute({ sql: 'SELECT * FROM squad_reports WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as SquadReportRow | undefined

    if (!row) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }
    if (req.user?.username !== 'chicolinas' && row.clan !== req.user?.clan) {
      return res.status(403).json({ success: false, error: 'Este reporte no es de tu clan' })
    }

    res.json({ success: true, data: { ...toListItem(row), teams: JSON.parse(row.teams_json) } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el reporte de armado' })
  }
})

// POST /api/squad-reports - Subir y analizar un archivo de armado (.xlsx, hoja "Equipos") (solo capitanes)
router.post('/', requireCaptain, (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message || 'Error subiendo el archivo' })
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No se recibió ningún archivo' })
    }

    const { clan, title } = req.body ?? {}
    if (!clan || typeof clan !== 'string') {
      return res.status(400).json({ success: false, error: 'Debes indicar a qué clan pertenece este armado' })
    }

    try {
      const parsed = await parseSquadWorkbook(req.file.buffer)
      const summary = summarizeSquadReport(parsed.teams)

      const db = getDatabase()
      const result = await db.execute({
        sql: `
        INSERT INTO squad_reports (clan, title, opponent, file_name, sheet_name, uploaded_by, summary_json, teams_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
        args: [
          clan,
          (title && String(title).trim()) || parsed.sheetName,
          '',
          req.file.originalname,
          parsed.sheetName,
          req.user?.full_name ?? req.user?.username ?? null,
          JSON.stringify(summary),
          JSON.stringify(parsed.teams),
        ],
      })

      const row = (
        await db.execute({ sql: 'SELECT * FROM squad_reports WHERE id = ?', args: [Number(result.lastInsertRowid)] })
      ).rows[0] as unknown as SquadReportRow

      res.status(201).json({ success: true, data: { ...toListItem(row), teams: parsed.teams } })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'No se pudo analizar el archivo' })
    }
  })
})

// DELETE /api/squad-reports/:id - Elimina un reporte de armado (solo capitanes)
router.delete('/:id', requireCaptain, async (req, res) => {
  try {
    const db = getDatabase()
    const result = await db.execute({ sql: 'DELETE FROM squad_reports WHERE id = ?', args: [req.params.id] })

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando el reporte' })
  }
})

export default router
