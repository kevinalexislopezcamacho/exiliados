import { Router } from 'express'
import crypto from 'crypto'
import { getDatabase, hashPassword, slugifyUsername, verifyPassword } from '../db'
import type { Client } from '@libsql/client'

const router = Router()

interface MemberRow {
  id: number
  username: string
  password: string
  role: string
  full_name: string
  clan: string | null
  has_password: number
}

async function createSession(db: Client, user: MemberRow) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  await db.execute({
    sql: 'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)',
    args: [user.id, token, expiresAt],
  })

  return {
    token,
    data: {
      id: user.id,
      username: user.username,
      role: user.role,
      full_name: user.full_name,
      clan: user.clan,
      token,
    },
  }
}

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}

    if (!username) {
      return res.status(400).json({ success: false, error: 'Usuario requerido' })
    }

    // Acepta el usuario tal como aparece en el roster (con espacios,
    // acentos o mayúsculas) y lo normaliza al mismo formato con el que se
    // generaron las cuentas, para no obligar a escribirlo exacto.
    const db = getDatabase()
    const user = (
      await db.execute({ sql: 'SELECT * FROM members WHERE username = ?', args: [slugifyUsername(username)] })
    ).rows[0] as unknown as MemberRow | undefined

    if (!user) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' })
    }

    // Cuenta del roster que todavía no tiene contraseña propia: en vez de
    // fallar el login, le avisamos al frontend para que muestre el paso de
    // "crea tu contraseña" (POST /api/auth/set-password).
    if (!user.has_password) {
      return res.json({ success: false, needsPasswordSetup: true, full_name: user.full_name })
    }

    if (!password || !verifyPassword(password, user.password)) {
      return res.status(401).json({ success: false, error: 'Usuario o contraseña incorrectos' })
    }

    const { token, data } = await createSession(db, user)

    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({ success: true, data })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en login',
    })
  }
})

// POST /api/auth/set-password - Primer inicio de sesión de un integrante del
// roster: crea su contraseña y lo deja logueado. Solo funciona una vez (si
// la cuenta ya tiene contraseña, se rechaza).
router.post('/set-password', async (req, res) => {
  try {
    const { username, password } = req.body ?? {}

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Usuario y contraseña requeridos' })
    }
    if (String(password).length < 4) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 4 caracteres' })
    }

    const db = getDatabase()
    const user = (
      await db.execute({ sql: 'SELECT * FROM members WHERE username = ?', args: [slugifyUsername(username)] })
    ).rows[0] as unknown as MemberRow | undefined

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' })
    }
    if (user.has_password) {
      return res.status(400).json({ success: false, error: 'Esta cuenta ya tiene contraseña, inicia sesión normalmente' })
    }

    await db.execute({
      sql: 'UPDATE members SET password = ?, has_password = 1 WHERE id = ?',
      args: [hashPassword(password), user.id],
    })

    const { token, data } = await createSession(db, { ...user, has_password: 1 })

    res.cookie('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.json({ success: true, data })
  } catch (error) {
    console.error('Set password error:', error)
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error creando la contraseña',
    })
  }
})

router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body ?? {}

    if (token) {
      const db = getDatabase()
      await db.execute({ sql: 'DELETE FROM sessions WHERE token = ?', args: [token] })
    }

    res.clearCookie('auth-token')
    res.json({ success: true, message: 'Sesión cerrada' })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error al cerrar sesión' })
  }
})

export default router
