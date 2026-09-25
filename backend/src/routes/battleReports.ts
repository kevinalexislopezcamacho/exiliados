import { Router } from 'express'
import multer from 'multer'
import { getDatabase } from '../db'
import { requireAuth, requireCaptain, requireReportAccess } from '../middleware/auth'
import { parseBattleWorkbook } from '../lib/battleReportParser'
import { summarizeBattle } from '../lib/battleStats'
import { computeMemberStats } from '../lib/memberStats'
import { computeTacticalAnalysis } from '../lib/tacticalAnalysis'
import { mergeSubmissionsIntoMatches, type MatchSubmissionRow } from '../lib/matchSubmissions'

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
  status: string
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
    status: row.status,
    summary: JSON.parse(row.summary_json),
  }
}

function toSubmissionItem(row: MatchSubmissionRow) {
  return {
    id: row.id,
    memberId: row.member_id,
    manager: row.manager,
    jornada: row.jornada,
    condicion: row.condicion,
    rival: row.rival,
    golLocal: row.gol_local,
    golVisita: row.gol_visita,
    tirosLocal: row.tiros_local,
    tirosVisita: row.tiros_visita,
    posesionLocal: row.posesion_local,
    posesionVisita: row.posesion_visita,
    presion: row.presion,
    tacticaNuestra: row.tactica_nuestra,
    tacticaRival: row.tactica_rival,
    estiloNuestro: row.estilo_nuestro,
    estiloRival: row.estilo_rival,
    estiloPct: row.estilo_pct,
    velocidad: row.velocidad,
    defensas: row.defensas,
    medios: row.medios,
    delanteros: row.delanteros,
    campus: row.campus === null ? null : !!row.campus,
    conclusiones: row.conclusiones,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Mismas opciones que los desplegables del Excel.
const ESTILO_OPTIONS = new Set(['Contra', 'Pases', 'Bandas', 'Tiros', 'N/A'])
const LINEA_OPTIONS = new Set(['Atrás', 'Apoyar Def', 'Permanecer', 'Apoyo Med', 'Atacar'])

const toIntOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : null)
const toBoolOrNull = (v: unknown) => (v === '' || v === null || v === undefined ? null : v === true || v === 'true' || v === 1 || v === '1' ? 1 : 0)
const toOptionOrEmpty = (v: unknown, options: Set<string>) => {
  if (v === '' || v === null || v === undefined) return ''
  return options.has(String(v)) ? String(v) : undefined
}

// Valida y normaliza el body de crear/editar un partido a mano (mismos
// campos que trae el Excel: núcleo del resultado + los datos tácticos que
// alimentan el Análisis Táctico). Devuelve null si algo obligatorio o alguna
// opción de desplegable no es válida.
function parseSubmissionBody(body: any) {
  const { condicion } = body ?? {}
  if (condicion !== 'Local' && condicion !== 'Visita') return null

  const estiloNuestro = toOptionOrEmpty(body.estiloNuestro, ESTILO_OPTIONS)
  const estiloRival = toOptionOrEmpty(body.estiloRival, ESTILO_OPTIONS)
  const defensas = toOptionOrEmpty(body.defensas, LINEA_OPTIONS)
  const medios = toOptionOrEmpty(body.medios, LINEA_OPTIONS)
  const delanteros = toOptionOrEmpty(body.delanteros, LINEA_OPTIONS)
  if (estiloNuestro === undefined || estiloRival === undefined || defensas === undefined || medios === undefined || delanteros === undefined) {
    return null
  }

  return {
    jornada: toIntOrNull(body.jornada),
    condicion,
    rival: (body.rival && String(body.rival).trim()) || '',
    golLocal: toIntOrNull(body.golLocal),
    golVisita: toIntOrNull(body.golVisita),
    tirosLocal: toIntOrNull(body.tirosLocal),
    tirosVisita: toIntOrNull(body.tirosVisita),
    posesionLocal: toIntOrNull(body.posesionLocal),
    posesionVisita: toIntOrNull(body.posesionVisita),
    presion: toIntOrNull(body.presion),
    tacticaNuestra: (body.tacticaNuestra && String(body.tacticaNuestra).trim()) || '',
    tacticaRival: (body.tacticaRival && String(body.tacticaRival).trim()) || '',
    estiloNuestro,
    estiloRival,
    estiloPct: toIntOrNull(body.estiloPct),
    velocidad: toIntOrNull(body.velocidad),
    defensas,
    medios,
    delanteros,
    campus: toBoolOrNull(body.campus),
    conclusiones: (body.conclusiones && String(body.conclusiones).trim()) || '',
  }
}

// GET /api/battle-reports/me - Estadísticas reales del usuario logueado,
// sacadas de los reportes de su clan (cualquier miembro autenticado).
// Va antes de "/:id" para que Express no la confunda con un id.
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (!req.user?.full_name || !req.user?.clan) {
      return res.json({
        success: true,
        data: { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0, dif: 0, pts: 0, efectividad: 0, recentMatches: [] },
      })
    }
    const db = getDatabase()
    const stats = await computeMemberStats(db, req.user.full_name, req.user.clan)
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
router.get('/tactics', requireReportAccess, async (req, res) => {
  try {
    const clan = req.user?.username === 'chicolinas' ? String(req.query.clan ?? '') : req.user?.clan ?? ''
    if (!clan) {
      return res.status(400).json({ success: false, error: 'Debes indicar el clan (?clan=rayo|exiliados)' })
    }
    const db = getDatabase()
    const data = await computeTacticalAnalysis(db, clan)
    res.json({ success: true, data })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error calculando el análisis táctico' })
  }
})

// GET /api/battle-reports - Lista de reportes de batalla (chicolinas ve
// todos; todos los demás, incluidos otros capitanes, solo los de su propio
// clan, y solo si tienen acceso habilitado)
router.get('/', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const rows = (
      req.user?.username === 'chicolinas'
        ? await db.execute('SELECT * FROM battle_reports ORDER BY created_at DESC')
        : await db.execute({
            sql: 'SELECT * FROM battle_reports WHERE clan = ? ORDER BY created_at DESC',
            args: [req.user?.clan ?? ''],
          })
    ).rows as unknown as BattleReportRow[]
    res.json({ success: true, data: rows.map(toListItem) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los reportes de batalla' })
  }
})

// POST /api/battle-reports/draft - Crea una "batalla en blanco" (sin Excel
// todavía) para que los integrantes vayan reportando sus partidos a mano
// mientras se junta el Excel oficial (solo capitanes).
// Va antes de "/:id" para que Express no la confunda con un id.
router.post('/draft', requireCaptain, async (req, res) => {
  try {
    const { clan, title, opponent } = req.body ?? {}
    if (!clan || typeof clan !== 'string') {
      return res.status(400).json({ success: false, error: 'Debes indicar a qué clan pertenece esta batalla' })
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Debes ponerle un título a la batalla' })
    }

    const db = getDatabase()
    const emptySummary = summarizeBattle([])
    const result = await db.execute({
      sql: `
      INSERT INTO battle_reports (clan, title, opponent, file_name, sheet_name, uploaded_by, summary_json, matches_json, slots_json, status)
      VALUES (?, ?, ?, '', '', ?, ?, '[]', '{}', 'draft')
    `,
      args: [
        clan,
        title.trim(),
        (opponent && String(opponent).trim()) || '',
        req.user?.full_name ?? req.user?.username ?? null,
        JSON.stringify(emptySummary),
      ],
    })

    const row = (
      await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [Number(result.lastInsertRowid)] })
    ).rows[0] as unknown as BattleReportRow

    res.status(201).json({ success: true, data: { ...toListItem(row), matches: [] } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error creando la batalla' })
  }
})

// GET /api/battle-reports/:id - Detalle completo (chicolinas siempre; todos
// los demás, incluidos otros capitanes, solo si tienen acceso Y el reporte
// es de su propio clan)
router.get('/:id', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const row = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as BattleReportRow | undefined

    if (!row) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }
    if (req.user?.username !== 'chicolinas' && row.clan !== req.user?.clan) {
      return res.status(403).json({ success: false, error: 'Este reporte no es de tu clan' })
    }

    let submissions: ReturnType<typeof toSubmissionItem>[] | undefined
    if (row.status === 'draft') {
      const subRows = (
        await db.execute({
          sql: 'SELECT * FROM battle_match_submissions WHERE report_id = ? ORDER BY created_at ASC',
          args: [row.id],
        })
      ).rows as unknown as MatchSubmissionRow[]
      submissions = subRows.map(toSubmissionItem)
    }

    res.json({
      success: true,
      data: {
        ...toListItem(row),
        matches: JSON.parse(row.matches_json),
        ...(submissions ? { submissions } : {}),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el reporte de batalla' })
  }
})

// POST /api/battle-reports/:id/submissions - Reporta un partido propio a
// mano en una batalla que sigue 'draft' (cualquiera con acceso a reportes).
router.post('/:id/submissions', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const report = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as BattleReportRow | undefined

    if (!report) {
      return res.status(404).json({ success: false, error: 'Batalla no encontrada' })
    }
    if (req.user?.username !== 'chicolinas' && report.clan !== req.user?.clan) {
      return res.status(403).json({ success: false, error: 'Esta batalla no es de tu clan' })
    }
    if (report.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Esta batalla ya se cerró con el Excel oficial' })
    }
    if (!req.user?.full_name) {
      return res.status(400).json({ success: false, error: 'Tu cuenta no tiene un nombre completo configurado' })
    }

    const parsed = parseSubmissionBody(req.body)
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'La condición debe ser Local o Visita, y el estilo/líneas (si los pones) deben ser una opción válida',
      })
    }

    const result = await db.execute({
      sql: `
      INSERT INTO battle_match_submissions
        (report_id, member_id, manager, jornada, condicion, rival, gol_local, gol_visita, tiros_local, tiros_visita,
         posesion_local, posesion_visita, presion, tactica_nuestra, tactica_rival, estilo_nuestro, estilo_rival,
         estilo_pct, velocidad, defensas, medios, delanteros, campus, conclusiones, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      args: [
        report.id,
        req.user.id,
        req.user.full_name,
        parsed.jornada,
        parsed.condicion,
        parsed.rival,
        parsed.golLocal,
        parsed.golVisita,
        parsed.tirosLocal,
        parsed.tirosVisita,
        parsed.posesionLocal,
        parsed.posesionVisita,
        parsed.presion,
        parsed.tacticaNuestra,
        parsed.tacticaRival,
        parsed.estiloNuestro,
        parsed.estiloRival,
        parsed.estiloPct,
        parsed.velocidad,
        parsed.defensas,
        parsed.medios,
        parsed.delanteros,
        parsed.campus,
        parsed.conclusiones,
      ],
    })

    const row = (
      await db.execute({
        sql: 'SELECT * FROM battle_match_submissions WHERE id = ?',
        args: [Number(result.lastInsertRowid)],
      })
    ).rows[0] as unknown as MatchSubmissionRow

    res.status(201).json({ success: true, data: toSubmissionItem(row) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error guardando tu partido' })
  }
})

// PUT /api/battle-reports/:id/submissions/:subId - Edita un partido propio
// (o de cualquiera del clan, si es capitán/chicolinas), mientras siga 'draft'.
router.put('/:id/submissions/:subId', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const report = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as BattleReportRow | undefined
    const submission = (
      await db.execute({
        sql: 'SELECT * FROM battle_match_submissions WHERE id = ? AND report_id = ?',
        args: [req.params.subId, req.params.id],
      })
    ).rows[0] as unknown as MatchSubmissionRow | undefined

    if (!report || !submission) {
      return res.status(404).json({ success: false, error: 'No se encontró ese partido' })
    }
    const isOwner = submission.member_id === req.user?.id
    const canManageOthers = req.user?.username === 'chicolinas' || (req.user?.role === 'captain' && report.clan === req.user.clan)
    if (!isOwner && !canManageOthers) {
      return res.status(403).json({ success: false, error: 'Ese partido no es tuyo' })
    }
    if (report.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Esta batalla ya se cerró con el Excel oficial' })
    }

    const parsed = parseSubmissionBody(req.body)
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: 'La condición debe ser Local o Visita, y el estilo/líneas (si los pones) deben ser una opción válida',
      })
    }

    await db.execute({
      sql: `
      UPDATE battle_match_submissions SET
        jornada = ?, condicion = ?, rival = ?, gol_local = ?, gol_visita = ?,
        tiros_local = ?, tiros_visita = ?, posesion_local = ?, posesion_visita = ?,
        presion = ?, tactica_nuestra = ?, tactica_rival = ?, estilo_nuestro = ?, estilo_rival = ?,
        estilo_pct = ?, velocidad = ?, defensas = ?, medios = ?, delanteros = ?, campus = ?,
        conclusiones = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
      args: [
        parsed.jornada,
        parsed.condicion,
        parsed.rival,
        parsed.golLocal,
        parsed.golVisita,
        parsed.tirosLocal,
        parsed.tirosVisita,
        parsed.posesionLocal,
        parsed.posesionVisita,
        parsed.presion,
        parsed.tacticaNuestra,
        parsed.tacticaRival,
        parsed.estiloNuestro,
        parsed.estiloRival,
        parsed.estiloPct,
        parsed.velocidad,
        parsed.defensas,
        parsed.medios,
        parsed.delanteros,
        parsed.campus,
        parsed.conclusiones,
        submission.id,
      ],
    })

    const row = (
      await db.execute({ sql: 'SELECT * FROM battle_match_submissions WHERE id = ?', args: [submission.id] })
    ).rows[0] as unknown as MatchSubmissionRow
    res.json({ success: true, data: toSubmissionItem(row) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error actualizando tu partido' })
  }
})

// DELETE /api/battle-reports/:id/submissions/:subId - Borra un partido propio
// (o de cualquiera del clan, si es capitán/chicolinas), mientras siga 'draft'.
router.delete('/:id/submissions/:subId', requireReportAccess, async (req, res) => {
  try {
    const db = getDatabase()
    const report = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [req.params.id] }))
      .rows[0] as unknown as BattleReportRow | undefined
    const submission = (
      await db.execute({
        sql: 'SELECT * FROM battle_match_submissions WHERE id = ? AND report_id = ?',
        args: [req.params.subId, req.params.id],
      })
    ).rows[0] as unknown as MatchSubmissionRow | undefined

    if (!report || !submission) {
      return res.status(404).json({ success: false, error: 'No se encontró ese partido' })
    }
    const isOwner = submission.member_id === req.user?.id
    const canManageOthers = req.user?.username === 'chicolinas' || (req.user?.role === 'captain' && report.clan === req.user.clan)
    if (!isOwner && !canManageOthers) {
      return res.status(403).json({ success: false, error: 'Ese partido no es tuyo' })
    }
    if (report.status !== 'draft') {
      return res.status(400).json({ success: false, error: 'Esta batalla ya se cerró con el Excel oficial' })
    }

    await db.execute({ sql: 'DELETE FROM battle_match_submissions WHERE id = ?', args: [submission.id] })
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error borrando tu partido' })
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

    const { clan, title, reportId } = req.body ?? {}
    if (!clan || typeof clan !== 'string') {
      return res.status(400).json({ success: false, error: 'Debes indicar a qué clan pertenece esta batalla' })
    }

    try {
      const parsed = await parseBattleWorkbook(req.file.buffer)
      if (parsed.matches.length === 0) {
        return res.status(400).json({ success: false, error: 'No se encontraron partidos jugados en el archivo' })
      }

      const db = getDatabase()

      // Si viene reportId, es el Excel oficial de una batalla que ya estaba
      // 'draft' (con partidos reportados a mano): se actualiza esa misma
      // fila en vez de crear una nueva, fusionando los partidos manuales que
      // el Excel no traiga.
      if (reportId) {
        const draft = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [reportId] }))
          .rows[0] as unknown as BattleReportRow | undefined
        if (!draft) {
          return res.status(404).json({ success: false, error: 'La batalla en progreso ya no existe' })
        }
        if (draft.clan !== clan) {
          return res.status(400).json({ success: false, error: 'Esa batalla en progreso es de otro clan' })
        }
        if (draft.status !== 'draft') {
          return res.status(400).json({ success: false, error: 'Esa batalla ya tiene un Excel oficial cargado' })
        }

        const subRows = (
          await db.execute({ sql: 'SELECT * FROM battle_match_submissions WHERE report_id = ?', args: [draft.id] })
        ).rows as unknown as MatchSubmissionRow[]
        const finalMatches = mergeSubmissionsIntoMatches(parsed.matches, subRows)
        const summary = summarizeBattle(finalMatches)

        await db.execute({
          sql: `
          UPDATE battle_reports SET
            title = ?, opponent = ?, file_name = ?, sheet_name = ?, uploaded_by = ?,
            summary_json = ?, matches_json = ?, slots_json = ?, status = 'final'
          WHERE id = ?
        `,
          args: [
            (title && String(title).trim()) || draft.title,
            parsed.rivalLabel || draft.opponent,
            req.file.originalname,
            parsed.sheetName,
            req.user?.full_name ?? req.user?.username ?? null,
            JSON.stringify(summary),
            JSON.stringify(finalMatches),
            JSON.stringify({ managerSlots: parsed.managerSlots, rivalSlots: parsed.rivalSlots }),
            draft.id,
          ],
        })

        const row = (await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [draft.id] }))
          .rows[0] as unknown as BattleReportRow

        return res.status(200).json({ success: true, data: { ...toListItem(row), matches: finalMatches } })
      }

      const summary = summarizeBattle(parsed.matches)
      const result = await db.execute({
        sql: `
        INSERT INTO battle_reports (clan, title, opponent, file_name, sheet_name, uploaded_by, summary_json, matches_json, slots_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        args: [
          clan,
          (title && String(title).trim()) || parsed.sheetName,
          parsed.rivalLabel,
          req.file.originalname,
          parsed.sheetName,
          req.user?.full_name ?? req.user?.username ?? null,
          JSON.stringify(summary),
          JSON.stringify(parsed.matches),
          JSON.stringify({ managerSlots: parsed.managerSlots, rivalSlots: parsed.rivalSlots }),
        ],
      })

      const row = (
        await db.execute({ sql: 'SELECT * FROM battle_reports WHERE id = ?', args: [Number(result.lastInsertRowid)] })
      ).rows[0] as unknown as BattleReportRow

      res.status(201).json({ success: true, data: { ...toListItem(row), matches: parsed.matches } })
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'No se pudo analizar el archivo' })
    }
  })
})

// DELETE /api/battle-reports/:id - Elimina un reporte (solo capitanes)
router.delete('/:id', requireCaptain, async (req, res) => {
  try {
    const db = getDatabase()
    const result = await db.execute({ sql: 'DELETE FROM battle_reports WHERE id = ?', args: [req.params.id] })

    if (result.rowsAffected === 0) {
      return res.status(404).json({ success: false, error: 'Reporte no encontrado' })
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error eliminando el reporte' })
  }
})

export default router
