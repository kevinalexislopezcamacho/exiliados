import { Router } from 'express'
import multer from 'multer'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain, requireReportAccess } from '../middleware/auth'
import { parseBattleWorkbook } from '../lib/battleReportParser'
import { summarizeBattle } from '../lib/battleStats'
import { computeReportRankings } from '../lib/reportRankings'
import { computeMemberStats } from '../lib/memberStats'
import { computeTacticalAnalysis } from '../lib/tacticalAnalysis'
import { broadcast } from '../sse'

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

interface BattleReportRow {
  id: number
  clan: string
  title: string
  opponent: string
  file_name: string
  sheet_name: string
  uploaded_by: string | null
  summary_json: string
  matches_json: string
  slots_json: string
  created_at: string
}

function toListItem(row: BattleReportRow) {
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

// GET /api/battle-reports/me - Estadísticas reales del usuario logueado,
// sacadas de los reportes de su clan (cualquier miembro autenticado).
// Va antes de "/:id" para que Express no la confunda con un id.
router.get('/me', requireAuth, (req, res) => {
  try {
    if (!req.user?.full_name || !req.user?.clan) {
      return res.json({
        success: true,
        data: { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0, dif: 0, pts: 0, efectividad: 0, recentMatches: [] },
      })
    }
    const db = getDatabase()
    const stats = computeMemberStats(db, req.user.full_name, req.user.clan)
    db.close()
    res.json({ success: true, data: stats })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo tus estadísticas' })
  }
})

// GET /api/battle-reports/tactics?clan=X - Efectividad por banda de presión y
// alineación, cruzando todos los reportes de ese clan (chicolinas puede ver
// cualquier clan; todos los demás, incluidos otros capitanes, solo el suyo y
// solo si el acceso está habilitado).
// Va antes de "/:id" para que Express no la confunda con un id.
router.get('/tactics', requireReportAccess, (req, res) => {
  try {
    const clan = req.user?.username === 'chicolinas' ? String(req.query.clan ?? '') : req.user?.clan ?? ''
    if (!clan) {
      return res.status(400).json({ success: false, error: 'Debes indicar el clan (?clan=rayo|exiliados)' })
    }
    const db = getDatabase()
    const data = computeTacticalAnalysis(db, clan)
    db.close()
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error calculando el análisis táctico' })
  }
})

// GET /api/battle-reports - Lista de reportes de batalla (chicolinas ve
// todos; todos los demás, incluidos otros capitanes, solo los de su propio
// clan, y solo si tienen acceso habilitado)
router.get('/', requireReportAccess, (req, res) => {
  try {
    const db = getDatabase()
    const rows = (
      req.user?.username === 'chicolinas'
        ? db.prepare('SELECT * FROM battle_reports ORDER BY created_at DESC').all()
        : db.prepare('SELECT * FROM battle_reports WHERE clan = ? ORDER BY created_at DESC').all(req.user?.clan ?? '')
    ) as BattleReportRow[]
    db.close()
    res.json({ success: true, data: rows.map(toListItem) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los reportes de batalla' })
  }
})

// GET /api/battle-reports/:id - Detalle completo (chicolinas siempre; todos
// los demás, incluidos otros capitanes, solo si tienen acceso Y el reporte
// es de su propio clan)
router.get('/:id', requireReportAccess, (req, res) => {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM battle_reports WHERE id = ?').get(req.params.id) as
      | BattleReportRow
      | undefined
    db.close()

    if (!row) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }
    if (req.user?.username !== 'chicolinas' && row.clan !== req.user?.clan) {
      return res.status(403).json({ success: false, error: 'Este reporte no es de tu clan' })
    }

    res.json({
      success: true,
      data: {
        ...toListItem(row),
        matches: JSON.parse(row.matches_json),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el reporte de batalla' })
  }
})

// POST /api/battle-reports - Subir y analizar un nuevo archivo .xlsx (solo capitanes)
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
      return res.status(400).json({ success: false, error: 'Debes indicar a qué clan pertenece esta batalla' })
    }

    try {
      const parsed = await parseBattleWorkbook(req.file.buffer)
      if (parsed.matches.length === 0) {
        return res.status(400).json({ success: false, error: 'No se encontraron partidos jugados en el archivo' })
      }
      const summary = summarizeBattle(parsed.matches)

      const db = getDatabase()
      const result = db
        .prepare(
          `
        INSERT INTO battle_reports (clan, title, opponent, file_name, sheet_name, uploaded_by, summary_json, matches_json, slots_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          clan,
          (title && String(title).trim()) || parsed.sheetName,
          parsed.rivalLabel,
          req.file.originalname,
          parsed.sheetName,
          req.user?.full_name ?? req.user?.username ?? null,
          JSON.stringify(summary),
          JSON.stringify(parsed.matches),
          JSON.stringify({ managerSlots: parsed.managerSlots, rivalSlots: parsed.rivalSlots })
        )

      const row = db.prepare('SELECT * FROM battle_reports WHERE id = ?').get(result.lastInsertRowid) as BattleReportRow
      const rankings = computeReportRankings(db)
      db.close()

      broadcast('rankings', rankings)
      res.status(201).json({ success: true, data: { ...toListItem(row), matches: parsed.matches } })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'No se pudo analizar el archivo' })
    }
  })
})

// DELETE /api/battle-reports/:id - Elimina un reporte (solo capitanes)
router.delete('/:id', requireCaptain, (req, res) => {
  try {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM battle_reports WHERE id = ?').run(req.params.id)

    if (result.changes === 0) {
      db.close()
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }

    const rankings = computeReportRankings(db)
    db.close()

    broadcast('rankings', rankings)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando el reporte' })
  }
})

export default router
