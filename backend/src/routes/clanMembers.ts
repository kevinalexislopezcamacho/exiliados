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

const SELECT_WITH_ACCOUNT = `
  SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
         m.username as username, m.has_password as hasPassword, m.role as role
  FROM clan_members cm
  LEFT JOIN members m ON m.id = cm.member_id
  WHERE cm.id = ?
`

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
router.get('/', requireCaptain, async (req, res) => {
  try {
    const clan = String(req.query.clan ?? '')
    if (!MANAGEABLE_CLANS.has(clan)) {
      return res.status(400).json({ success: false, error: 'Clan inválido' })
    }
    if (!canManageClan(req.user, clan)) {
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede ver este roster' })
    }

    const db = getDatabase()
    const rows = (
      await db.execute({
        sql: `
        SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id,
               m.username as username, m.has_password as hasPassword, m.role as role
        FROM clan_members cm
        LEFT JOIN members m ON m.id = cm.member_id
        WHERE cm.clan = ?
        ORDER BY cm.sort_order ASC
      `,
        args: [clan],
      })
    ).rows as unknown as Array<ClanMemberRow & { username: string | null; hasPassword: number | null; role: string | null }>

    res.json({ success: true, data: rows.map(toApiShape) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el roster' })
  }
})

// POST /api/clan-members - Agrega un integrante al roster (y su cuenta de acceso)
router.post('/', requireCaptain, async (req, res) => {
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

    const taken = (await db.execute({ sql: 'SELECT id FROM members WHERE LOWER(username) = ?', args: [finalUsername] }))
      .rows[0]
    if (taken) {
      return res.status(409).json({ success: false, error: `El usuario "${finalUsername}" ya está en uso` })
    }

    const tx = await db.transaction('write')
    let newId: number
    try {
      const maxOrder = (
        await tx.execute({ sql: 'SELECT COALESCE(MAX(sort_order), -1) as m FROM clan_members WHERE clan = ?', args: [clan] })
      ).rows[0] as unknown as { m: number }

      const clanMemberResult = await tx.execute({
        sql: `INSERT INTO clan_members (name, clan, country_code, title, sort_order) VALUES (?, ?, ?, ?, ?)`,
        args: [trimmedName, clan, String(countryCode ?? '').trim().toLowerCase(), String(title ?? '').trim(), maxOrder.m + 1],
      })

      const memberResult = await tx.execute({
        sql: `INSERT INTO members (username, password, role, full_name, clan, has_password) VALUES (?, ?, 'member', ?, ?, 0)`,
        args: [finalUsername, hashPassword(ROSTER_DEFAULT_PASSWORD), trimmedName, clan],
      })

      await tx.execute({
        sql: 'UPDATE clan_members SET member_id = ? WHERE id = ?',
        args: [Number(memberResult.lastInsertRowid), Number(clanMemberResult.lastInsertRowid)],
      })

      newId = Number(clanMemberResult.lastInsertRowid)
      await tx.commit()
    } finally {
      tx.close()
    }

    const created = (await db.execute({ sql: SELECT_WITH_ACCOUNT, args: [newId] })).rows[0] as unknown as ClanMemberRow & {
      username: string | null
      hasPassword: number | null
      role: string | null
    }

    res.status(201).json({ success: true, data: toApiShape(created) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error agregando integrante' })
  }
})

// PUT /api/clan-members/:id - Edita nombre, usuario, nacionalidad y selección
router.put('/:id', requireCaptain, async (req, res) => {
  const { id } = req.params
  const { name, countryCode, title, username } = req.body ?? {}

  try {
    const db = getDatabase()
    const existing = (await db.execute({ sql: 'SELECT * FROM clan_members WHERE id = ?', args: [id] }))
      .rows[0] as unknown as ClanMemberRow | undefined
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!canManageClan(req.user, existing.clan)) {
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede editar este integrante' })
    }

    const trimmedName = name !== undefined ? String(name).trim() : existing.name
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' })
    }

    let desiredUsername: string | null = null
    if (username !== undefined) {
      desiredUsername = slugifyUsername(String(username).trim())
      if (!desiredUsername) {
        return res.status(400).json({ success: false, error: 'No se pudo generar un nombre de usuario válido' })
      }
      const collision = existing.member_id
        ? (
            await db.execute({
              sql: 'SELECT id FROM members WHERE LOWER(username) = ? AND id != ?',
              args: [desiredUsername, existing.member_id],
            })
          ).rows[0]
        : (await db.execute({ sql: 'SELECT id FROM members WHERE LOWER(username) = ?', args: [desiredUsername] })).rows[0]
      if (collision) {
        return res.status(409).json({ success: false, error: `El usuario "${desiredUsername}" ya está en uso` })
      }
    }

    const tx = await db.transaction('write')
    try {
      await tx.execute({
        sql: 'UPDATE clan_members SET name = ?, country_code = ?, title = ? WHERE id = ?',
        args: [
          trimmedName,
          countryCode !== undefined ? String(countryCode).trim().toLowerCase() : existing.country_code,
          title !== undefined ? String(title).trim() : existing.title,
          id,
        ],
      })

      if (existing.member_id) {
        if (desiredUsername) {
          await tx.execute({
            sql: 'UPDATE members SET username = ?, full_name = ? WHERE id = ?',
            args: [desiredUsername, trimmedName, existing.member_id],
          })
        } else {
          await tx.execute({ sql: 'UPDATE members SET full_name = ? WHERE id = ?', args: [trimmedName, existing.member_id] })
        }
      } else if (desiredUsername) {
        // Fila legada sin cuenta vinculada: se crea una ahora.
        const memberResult = await tx.execute({
          sql: `INSERT INTO members (username, password, role, full_name, clan, has_password) VALUES (?, ?, 'member', ?, ?, 0)`,
          args: [desiredUsername, hashPassword(ROSTER_DEFAULT_PASSWORD), trimmedName, existing.clan],
        })
        await tx.execute({
          sql: 'UPDATE clan_members SET member_id = ? WHERE id = ?',
          args: [Number(memberResult.lastInsertRowid), id],
        })
      }
      await tx.commit()
    } finally {
      tx.close()
    }

    const updated = (await db.execute({ sql: SELECT_WITH_ACCOUNT, args: [id] })).rows[0] as unknown as ClanMemberRow & {
      username: string | null
      hasPassword: number | null
      role: string | null
    }

    res.json({ success: true, data: toApiShape(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error actualizando integrante' })
  }
})

// POST /api/clan-members/:id/set-role - Sube o baja de rango (member <-> captain)
// a un integrante que ya tiene cuenta de acceso. Solo chicolinas puede hacerlo:
// dar el rol de capitán es más delicado que solo mover a alguien entre clanes.
router.post('/:id/set-role', requireSuperAdmin, async (req, res) => {
  const { id } = req.params
  const { role } = req.body ?? {}

  if (role !== 'captain' && role !== 'member') {
    return res.status(400).json({ success: false, error: 'El rol debe ser "captain" o "member"' })
  }

  try {
    const db = getDatabase()
    const existing = (await db.execute({ sql: 'SELECT * FROM clan_members WHERE id = ?', args: [id] }))
      .rows[0] as unknown as ClanMemberRow | undefined
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!existing.member_id) {
      return res.status(400).json({ success: false, error: 'Este integrante todavía no tiene cuenta de acceso' })
    }

    await db.execute({ sql: 'UPDATE members SET role = ? WHERE id = ?', args: [role, existing.member_id] })

    const updated = (await db.execute({ sql: SELECT_WITH_ACCOUNT, args: [id] })).rows[0] as unknown as ClanMemberRow & {
      username: string | null
      hasPassword: number | null
      role: string | null
    }

    res.json({ success: true, data: toApiShape(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error cambiando el rango' })
  }
})

// DELETE /api/clan-members/:id - Borra al integrante del roster y su cuenta de acceso
router.delete('/:id', requireCaptain, async (req, res) => {
  const { id } = req.params

  try {
    const db = getDatabase()
    const existing = (await db.execute({ sql: 'SELECT * FROM clan_members WHERE id = ?', args: [id] }))
      .rows[0] as unknown as ClanMemberRow | undefined
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (!canManageClan(req.user, existing.clan)) {
      return res.status(403).json({ success: false, error: 'Solo el capitán de ese clan puede eliminar este integrante' })
    }

    const tx = await db.transaction('write')
    try {
      // clan_members.member_id referencia a members(id): hay que soltar esa
      // referencia (borrando la fila del roster) antes de poder borrar la
      // cuenta, si no la FK lo rechaza.
      await tx.execute({ sql: 'DELETE FROM clan_members WHERE id = ?', args: [id] })
      if (existing.member_id) {
        await tx.execute({ sql: 'DELETE FROM sessions WHERE user_id = ?', args: [existing.member_id] })
        await tx.execute({ sql: 'DELETE FROM member_report_access WHERE member_id = ?', args: [existing.member_id] })
        await tx.execute({ sql: 'DELETE FROM members WHERE id = ?', args: [existing.member_id] })
      }
      await tx.commit()
    } finally {
      tx.close()
    }

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error eliminando integrante' })
  }
})

async function moveMember(
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
    const existing = (await db.execute({ sql: 'SELECT * FROM clan_members WHERE id = ?', args: [id] }))
      .rows[0] as unknown as ClanMemberRow | undefined
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }
    if (existing.clan !== fromClan) {
      return res.status(400).json({ success: false, error: errorIfWrongClan })
    }
    const isChicolinas = req.user?.username === 'chicolinas'
    if (req.user?.clan !== fromClan && !isChicolinas) {
      return res.status(403).json({ success: false, error: errorIfNotAllowed })
    }

    const tx = await db.transaction('write')
    try {
      const maxOrder = (
        await tx.execute({ sql: 'SELECT COALESCE(MAX(sort_order), -1) as m FROM clan_members WHERE clan = ?', args: [toClan] })
      ).rows[0] as unknown as { m: number }

      await tx.execute({
        sql: 'UPDATE clan_members SET clan = ?, sort_order = ? WHERE id = ?',
        args: [toClan, maxOrder.m + 1, id],
      })

      if (existing.member_id) {
        // Conserva usuario y contraseña ya creados; solo cambia de clan.
        await tx.execute({ sql: 'UPDATE members SET clan = ? WHERE id = ?', args: [toClan, existing.member_id] })
      }
      await tx.commit()
    } finally {
      tx.close()
    }

    const updated = (await db.execute({ sql: SELECT_WITH_ACCOUNT, args: [id] })).rows[0] as unknown as ClanMemberRow & {
      username: string | null
      hasPassword: number | null
      role: string | null
    }

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
