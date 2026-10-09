import { Router, Request, Response } from 'express'
import { getDatabase, hashPassword, slugifyUsername, ROSTER_DEFAULT_PASSWORD } from '../db'
import { requireAuth, requireCaptain } from '../middleware/auth'
import { computeGeneralRanking } from '../lib/generalRanking'

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
  notes: string
}

const SELECT_WITH_ACCOUNT = `
  SELECT cm.id, cm.name, cm.clan, cm.country_code, cm.title, cm.sort_order, cm.member_id, cm.notes,
         m.username as username, m.has_password as hasPassword, m.role as role
  FROM clan_members cm
  LEFT JOIN members m ON m.id = cm.member_id
  WHERE cm.id = ?
`

// Cualquier capitán existente gestiona el roster de ambos clanes (Rayo y
// Exiliados): ver, crear, editar, borrar y ascender/descender integrantes.
// Esta función ya corre después de requireCaptain, así que solo hace falta
// confirmar que hay un usuario autenticado.
function canManageClan(user: { clan: string | null; username: string } | undefined, _clan: string): boolean {
  return !!user
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
    notes: row.notes ?? '',
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

// GET /api/clan-members/profile?clan=X&name=Y - Info + estadísticas (del
// Ranking General) + notas de un integrante, para el popup de "ver manager".
// Cualquier usuario logueado puede verlo (no solo capitanes).
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const clan = String(req.query.clan ?? '')
    const name = String(req.query.name ?? '')
    if (!MANAGEABLE_CLANS.has(clan) || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Debes indicar clan y nombre' })
    }

    const db = getDatabase()
    const targetSlug = slugifyUsername(name)
    const rows = (
      await db.execute({ sql: 'SELECT * FROM clan_members WHERE clan = ?', args: [clan] })
    ).rows as unknown as ClanMemberRow[]
    const row = rows.find((r) => slugifyUsername(r.name) === targetSlug)
    if (!row) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }

    let account: { username: string | null; hasPassword: number | null; role: string | null } = {
      username: null,
      hasPassword: null,
      role: null,
    }
    if (row.member_id) {
      const m = (
        await db.execute({ sql: 'SELECT username, has_password, role FROM members WHERE id = ?', args: [row.member_id] })
      ).rows[0] as unknown as { username: string; has_password: number; role: string } | undefined
      if (m) account = { username: m.username, hasPassword: m.has_password, role: m.role }
    }

    const ranking = await computeGeneralRanking(db)
    const stats = ranking.find((e) => slugifyUsername(e.name) === targetSlug) ?? null

    res.json({ success: true, data: { ...toApiShape({ ...row, ...account }), stats } })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error obteniendo el perfil' })
  }
})

// PUT /api/clan-members/profile - Guarda las notas de un integrante (solo
// capitanes). Se identifica por clan+nombre, igual que el GET de arriba.
router.put('/profile', requireCaptain, async (req, res) => {
  try {
    const { clan, name, notes } = req.body ?? {}
    if (!MANAGEABLE_CLANS.has(clan) || !String(name ?? '').trim()) {
      return res.status(400).json({ success: false, error: 'Debes indicar clan y nombre' })
    }

    const db = getDatabase()
    const targetSlug = slugifyUsername(String(name))
    const rows = (
      await db.execute({ sql: 'SELECT id, name FROM clan_members WHERE clan = ?', args: [clan] })
    ).rows as unknown as Array<{ id: number; name: string }>
    const row = rows.find((r) => slugifyUsername(r.name) === targetSlug)
    if (!row) {
      return res.status(404).json({ success: false, error: 'Integrante no encontrado' })
    }

    await db.execute({ sql: 'UPDATE clan_members SET notes = ? WHERE id = ?', args: [String(notes ?? ''), row.id] })

    const updated = (await db.execute({ sql: SELECT_WITH_ACCOUNT, args: [row.id] })).rows[0] as unknown as ClanMemberRow & {
      username: string | null
      hasPassword: number | null
      role: string | null
    }
    res.json({ success: true, data: toApiShape(updated) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error guardando las notas' })
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
// a un integrante que ya tiene cuenta de acceso. Cualquier capitán existente
// puede hacerlo.
router.post('/:id/set-role', requireCaptain, async (req, res) => {
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
        await tx.execute({ sql: 'DELETE FROM battle_match_submissions WHERE member_id = ?', args: [existing.member_id] })
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
  errorIfWrongClan: string
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
// Cualquier capitán existente puede iniciar el ascenso.
router.post('/:id/promote', requireCaptain, (req, res) => {
  moveMember(req, res, 'rayo', 'exiliados', 'Solo se puede ascender integrantes de Rayo')
})

// POST /api/clan-members/:id/demote - Desciende un integrante de Exiliados a Rayo.
// Cualquier capitán existente puede iniciar el descenso.
router.post('/:id/demote', requireCaptain, (req, res) => {
  moveMember(req, res, 'exiliados', 'rayo', 'Solo se puede descender integrantes de Exiliados')
})

export default router
