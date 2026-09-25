import { Router } from 'express'
import { getDatabase } from '../db'
import { requireAuth, requireSuperAdmin } from '../middleware/auth'

const router = Router()

const VALID_CLANS = new Set(['rayo', 'exiliados'])

// GET /api/report-access/me - ¿El usuario logueado tiene acceso a los reportes? (chicolinas siempre)
router.get('/me', requireAuth, (req, res) => {
  try {
    if (req.user?.username === 'chicolinas') {
      return res.json({ success: true, data: { enabled: true } })
    }

    const db = getDatabase()
    const row = db.prepare('SELECT enabled FROM member_report_access WHERE member_id = ?').get(req.user?.id) as
      | { enabled: number }
      | undefined
    db.close()

    res.json({ success: true, data: { enabled: !!row?.enabled } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el estado de acceso' })
  }
})

// GET /api/report-access/:clan - Lista de integrantes del clan con su estado de acceso (solo chicolinas)
router.get('/:clan', requireSuperAdmin, (req, res) => {
  try {
    const { clan } = req.params
    if (!VALID_CLANS.has(clan)) {
      return res.status(400).json({ success: false, error: 'Clan inválido' })
    }

    const db = getDatabase()
    const rows = db
      .prepare(
        `
      SELECT m.id, m.username, m.full_name, m.role, COALESCE(mra.enabled, 0) as enabled
      FROM members m
      LEFT JOIN member_report_access mra ON mra.member_id = m.id
      WHERE m.clan = ? AND m.username != 'chicolinas'
      ORDER BY m.role DESC, m.full_name COLLATE NOCASE ASC
    `
      )
      .all(clan) as Array<{ id: number; username: string; full_name: string | null; role: string; enabled: number }>
    db.close()

    res.json({
      success: true,
      data: rows.map((r) => ({
        id: r.id,
        username: r.username,
        fullName: r.full_name,
        role: r.role,
        enabled: !!r.enabled,
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo los integrantes' })
  }
})

// PUT /api/report-access/member/:memberId - Prender/apagar el acceso de un integrante (solo chicolinas)
router.put('/member/:memberId', requireSuperAdmin, (req, res) => {
  try {
    const memberId = Number(req.params.memberId)
    const { enabled } = req.body ?? {}

    if (!Number.isInteger(memberId)) {
      return res.status(400).json({ success: false, error: 'Integrante inválido' })
    }
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled debe ser true o false' })
    }

    const db = getDatabase()
    const member = db.prepare('SELECT username FROM members WHERE id = ?').get(memberId) as
      | { username: string }
      | undefined
    if (!member) {
      db.close()
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (member.username === 'chicolinas') {
      db.close()
      return res.status(400).json({ success: false, error: 'Chicolinas ya tiene acceso siempre' })
    }

    db.prepare(
      `INSERT INTO member_report_access (member_id, enabled) VALUES (?, ?)
       ON CONFLICT(member_id) DO UPDATE SET enabled = excluded.enabled`
    ).run(memberId, enabled ? 1 : 0)
    db.close()

    res.json({ success: true, data: { id: memberId, enabled } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error actualizando el acceso' })
  }
})

export default router
