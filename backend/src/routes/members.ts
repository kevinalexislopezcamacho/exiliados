import { Router } from 'express'
import { getDatabase, hashPassword } from '../db'
import { requireCaptain } from '../middleware/auth'

const router = Router()

// GET /api/members - Cuentas de capitán (gestión de acceso admin del sitio)
router.get('/', requireCaptain, (_req, res) => {
  try {
    const db = getDatabase()
    const members = db
      .prepare(`SELECT id, username, full_name, role, created_at FROM members WHERE role = 'captain' ORDER BY created_at DESC`)
      .all()
    db.close()

    res.json({ success: true, data: members, count: members.length })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching members' })
  }
})

// POST /api/members - Crear nuevo miembro
router.post('/', requireCaptain, (req, res) => {
  try {
    const { username, password, full_name, role } = req.body ?? {}

    if (!username || !password || !role) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' })
    }

    const db = getDatabase()
    const result = db
      .prepare(
        `
      INSERT INTO members (username, password, full_name, role, has_password)
      VALUES (?, ?, ?, ?, 1)
    `
      )
      .run(username, hashPassword(password), full_name || username, role)
    db.close()

    res.status(201).json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        username,
        full_name: full_name || username,
        role,
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error creating member' })
  }
})

// PUT /api/members/:id - Actualizar miembro
router.put('/:id', requireCaptain, (req, res) => {
  try {
    const { id } = req.params
    const { username, full_name, role, password } = req.body ?? {}

    const db = getDatabase()

    if (password) {
      db.prepare(
        `
        UPDATE members
        SET username = ?, full_name = ?, role = ?, password = ?, has_password = 1
        WHERE id = ?
      `
      ).run(username, full_name, role, hashPassword(password), id)
    } else {
      db.prepare(
        `
        UPDATE members
        SET username = ?, full_name = ?, role = ?
        WHERE id = ?
      `
      ).run(username, full_name, role, id)
    }

    const updated = db.prepare('SELECT id, username, full_name, role FROM members WHERE id = ?').get(id)
    db.close()

    res.json({ success: true, data: updated })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error updating member' })
  }
})

// DELETE /api/members/:id - Eliminar miembro
router.delete('/:id', requireCaptain, (req, res) => {
  try {
    const { id } = req.params

    const db = getDatabase()
    // Las sesiones tienen FK a members: hay que borrarlas antes que la cuenta.
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    db.prepare('DELETE FROM members WHERE id = ?').run(id)
    db.close()

    res.json({ success: true, message: 'Member deleted' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Error deleting member' })
  }
})

export default router
