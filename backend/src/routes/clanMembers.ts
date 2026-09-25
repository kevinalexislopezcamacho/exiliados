import { Router, Request, Response } from 'express'
import { getDatabase, hashPassword, slugifyUsername, ROSTER_DEFAULT_PASSWORD } from '../db'
import { requireCaptain, requireSuperAdmin } from '../middleware/auth'

const router = Router()

const MANAGEABLE_CLANS = new Set(['rayo', 'exiliados'])

interface ClanMemberRow {
  id: number
  name: string
  clan: string
  country_code: string
  title: string
  sort_order: number
  member_id: number | null
}

function canManageClan(user: { clan: string | null; username: string } | undefined, clan: string): boolean {
  if (!user) return false
  if (user.username === 'chicolinas') return true
  return user.clan === clan
}

function toApiShape(row: ClanMemberRow & { username?: string | null; hasPassword?: number | null; role?: string | null }) {
  return {
    id: row.id,
    name: row.name,
    clan: row.clan,
    countryCode: row.country_code,
    title: row.title,
    username: row.username ?? null,
    hasPassword: row.hasPassword ? Boolean(row.hasPassword) : false,
    role: row.role ?? null,
  }
}

// GET /api/clan-members?clan=rayo|exiliados - Roster completo con datos de
// cuenta vinculada, solo para el capitán dueño de ese clan (o chicolinas).
router.get('/', requireCaptain, (req, res) => {
  try {
    const clan = String(req.query.clan ?? '')
    if (!MANAGEABLE_CLANS.has(clan)) {
      return res.status(400).json({ success: false, error: 'Clan inválido' })
    }
    if (!canManageClan(req.user, clan)) {
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede ver este roster' })
    }

    const db = getDatabase()
    const rows = db
      .prepare(
        `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.clan = ?
        ORDER BY cm.sort_order ASC
      `
      )
      .all(clan) as Array<ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }>
    db.close()

    res.json({ success: true, data: rows.map(toApiShape) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el roster' })
  }
})

// POST /api/clan-members - Agrega un integrante al roster (y su cuenta de acceso)
router.post('/', requireCaptain, (req, res) => {
  const { name, clan, countryCode, title, username } = req.body ?? {}

  const trimmedName = String(name ?? '').trim()
  if (!trimmedName) {
    return res.status(400).json({ success: false, error: 'El nombre es obligatorio' })
  }
  if (!MANAGEABLE_CLANS.has(clan)) {
    return res.status(400).json({ success: false, error: 'Clan inválido' })
  }
  if (!canManageClan(req.user, clan)) {
    return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede agregar integrantes' })
  }

  const finalUsername = slugifyUsername(String(username ?? '').trim() || trimmedName)
  if (!finalUsername) {
    return res.status(400).json({ success: false, error: 'No se pudo generar un nombre de usuario válido' })
  }

  try {
    const db = getDatabase()

    const taken = db.prepare('SELECT id FROM members WHERE LOWER(username) = ?').get(finalUsername)
    if (taken) {
      db.close()
      return res.status(409).json({ success: false, error: `El usuario "${finalUsername}" ya está en uso` })
    }

    const run = db.transaction(() => {
      const maxOrder = db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM clan_members WHERE clan = ?')
        .get(clan) as { m: number }

      const clanMemberResult = db
        .prepare(
          `INSERT INTO clan_members (name, clan, country_code, title, sort_order) VALUES (?, ?, ?, ?, ?)`
        )
        .run(trimmedName, clan, String(countryCode ?? '').trim().toLowerCase(), String(title ?? '').trim(), maxOrder.m + 1)

      const memberResult = db
        .prepare(
          `INSERT INTO members (username, password, role, full_name, clan, has_password) VALUES (?, ?, 'member', ?, ?, 0)`
        )
        .run(finalUsername, hashPassword(ROSTER_DEFAULT_PASSWORD), trimmedName, clan)

      db.prepare('UPDATE clan_members SET member_id = ? WHERE id = ?').run(
        memberResult.lastInsertRowid,
        clanMemberResult.lastInsertRowid
      )

      return clanMemberResult.lastInsertRowid
    })

    const newId = run()
    const created = db
      .prepare(
        `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.id = ?
      `
      )
      .get(newId) as ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }
    db.close()

    res.status(201).json({ success: true, data: toApiShape(created) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error agregando integrante' })
  }
})

// PUT /api/clan-members/:id - Edita nombre, usuario, nacionalidad y selección
router.put('/:id', requireCaptain, (req, res) => {
  const { id } = req.params
  const { name, countryCode, title, username } = req.body ?? {}

  try {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM clan_members WHERE id = ?').get(id) as ClanMemberRow | undefined
    if (!existing) {
      db.close()
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!canManageClan(req.user, existing.clan)) {
      db.close()
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede editar este integrante' })
    }

    const trimmedName = name !== undefined ? String(name).trim() : existing.name
    if (!trimmedName) {
      db.close()
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' })
    }

    let desiredUsername: string | null = null
    if (username !== undefined) {
      desiredUsername = slugifyUsername(String(username).trim())
      if (!desiredUsername) {
        db.close()
        return res.status(400).json({ success: false, error: 'No se pudo generar un nombre de usuario válido' })
      }
      if (existing.member_id) {
        const collision = db
          .prepare('SELECT id FROM members WHERE LOWER(username) = ? AND id != ?')
          .get(desiredUsername, existing.member_id)
        if (collision) {
          db.close()
          return res.status(409).json({ success: false, error: `El usuario "${desiredUsername}" ya está en uso` })
        }
      } else {
        const collision = db.prepare('SELECT id FROM members WHERE LOWER(username) = ?').get(desiredUsername)
        if (collision) {
          db.close()
          return res.status(409).json({ success: false, error: `El usuario "${desiredUsername}" ya está en uso` })
        }
      }
    }

    db.transaction(() => {
      db.prepare('UPDATE clan_members SET name = ?, country_code = ?, title = ? WHERE id = ?').run(
        trimmedName,
        countryCode !== undefined ? String(countryCode).trim().toLowerCase() : existing.country_code,
        title !== undefined ? String(title).trim() : existing.title,
        id
      )

      if (existing.member_id) {
        if (desiredUsername) {
          db.prepare('UPDATE members SET username = ?, full_name = ? WHERE id = ?').run(
            desiredUsername,
            trimmedName,
            existing.member_id
          )
        } else {
          db.prepare('UPDATE members SET full_name = ? WHERE id = ?').run(trimmedName, existing.member_id)
        }
      } else if (desiredUsername) {
        // Fila legada sin cuenta vinculada: se crea una ahora.
        const memberResult = db
          .prepare(
            `INSERT INTO members (username, password, role, full_name, clan, has_password) VALUES (?, ?, 'member', ?, ?, 0)`
          )
          .run(desiredUsername, hashPassword(ROSTER_DEFAULT_PASSWORD), trimmedName, existing.clan)
        db.prepare('UPDATE clan_members SET member_id = ? WHERE id = ?').run(memberResult.lastInsertRowid, id)
      }
    })()

    const updated = db
      .prepare(
        `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.id = ?
      `
      )
      .get(id) as ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }
    db.close()

    res.json({ success: true, data: toApiShape(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error actualizando integrante' })
  }
})

// POST /api/clan-members/:id/set-role - Sube o baja de rango (member <-> captain)
// a un integrante que ya tiene cuenta de acceso. Solo chicolinas puede hacerlo:
// dar el rol de capitán es más delicado que solo mover a alguien entre clanes.
router.post('/:id/set-role', requireSuperAdmin, (req, res) => {
  const { id } = req.params
  const { role } = req.body ?? {}

  if (role !== 'captain' && role !== 'member') {
    return res.status(400).json({ success: false, error: 'El rol debe ser "captain" o "member"' })
  }

  try {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM clan_members WHERE id = ?').get(id) as ClanMemberRow | undefined
    if (!existing) {
      db.close()
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!existing.member_id) {
      db.close()
      return res.status(400).json({ success: false, error: 'Este integrante todavía no tiene cuenta de acceso' })
    }

    db.prepare('UPDATE members SET role = ? WHERE id = ?').run(role, existing.member_id)

    const updated = db
      .prepare(
        `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.id = ?
      `
      )
      .get(id) as ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }
    db.close()

    res.json({ success: true, data: toApiShape(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error cambiando el rango' })
  }
})

// DELETE /api/clan-members/:id - Borra al integrante del roster y su cuenta de acceso
router.delete('/:id', requireCaptain, (req, res) => {
  const { id } = req.params

  try {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM clan_members WHERE id = ?').get(id) as ClanMemberRow | undefined
    if (!existing) {
      db.close()
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!canManageClan(req.user, existing.clan)) {
      db.close()
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede eliminar este integrante' })
    }

    db.transaction(() => {
      // clan_members.member_id referencia a members(id): hay que soltar esa
      // referencia (borrando la fila del roster) antes de poder borrar la
      // cuenta, si no la FK lo rechaza.
      db.prepare('DELETE FROM clan_members WHERE id = ?').run(id)
      if (existing.member_id) {
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.member_id)
        db.prepare('DELETE FROM member_report_access WHERE member_id = ?').run(existing.member_id)
        db.prepare('DELETE FROM members WHERE id = ?').run(existing.member_id)
      }
    })()

    db.close()
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error eliminando integrante' })
  }
})

function moveMember(
  req: Request,
  res: Response,
  fromClan: 'rayo' | 'exiliados',
  toClan: 'rayo' | 'exiliados',
  errorIfWrongClan: string,
  errorIfNotAllowed: string
) {
  const { id } = req.params

  try {
    const db = getDatabase()
    const existing = db.prepare('SELECT * FROM clan_members WHERE id = ?').get(id) as ClanMemberRow | undefined
    if (!existing) {
      db.close()
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (existing.clan !== fromClan) {
      db.close()
      return res.status(400).json({ success: false, error: errorIfWrongClan })
    }
    const isChicolinas = req.user?.username === 'chicolinas'
    if (req.user?.clan !== fromClan && !isChicolinas) {
      db.close()
      return res.status(403).json({ success: false, error: errorIfNotAllowed })
    }

    db.transaction(() => {
      const maxOrder = db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM clan_members WHERE clan = ?')
        .get(toClan) as { m: number }

      db.prepare('UPDATE clan_members SET clan = ?, sort_order = ? WHERE id = ?').run(toClan, maxOrder.m + 1, id)

      if (existing.member_id) {
        // Conserva usuario y contraseña ya creados; solo cambia de clan.
        db.prepare('UPDATE members SET clan = ? WHERE id = ?').run(toClan, existing.member_id)
      }
    })()

    const updated = db
      .prepare(
        `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.id = ?
      `
      )
      .get(id) as ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }
    db.close()

    res.json({ success: true, data: toApiShape(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error moviendo al integrante' })
  }
}

// POST /api/clan-members/:id/promote - Asciende un integrante de Rayo a Exiliados.
// Solo un capitán de Rayo (o chicolinas) puede iniciar el ascenso.
router.post('/:id/promote', requireCaptain, (req, res) => {
  moveMember(
    req,
    res,
    'rayo',
    'exiliados',
    'Solo se puede ascender integrantes de Rayo',
    'Solo un capitán de Rayo puede ascender integrantes a Exiliados'
  )
})

// POST /api/clan-members/:id/demote - Desciende un integrante de Exiliados a Rayo.
// Solo un capitán de Exiliados (o chicolinas) puede iniciar el descenso.
router.post('/:id/demote', requireCaptain, (req, res) => {
  moveMember(
    req,
    res,
    'exiliados',
    'rayo',
    'Solo se puede descender integrantes de Exiliados',
    'Solo un capitán de Exiliados puede descender integrantes a Rayo'
  )
})

export default router
