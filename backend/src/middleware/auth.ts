import { NextFunction, Request, Response } from 'express'
import { getDatabase } from '../db'

export interface AuthUser {
  id: number
  username: string
  role: string
  full_name: string
  clan: string | null
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.['auth-token']

  if (!token) {
    return res.status(401).json({ success: false, error: 'No autenticado' })
  }

  const db = getDatabase()
  const user = (
    await db.execute({
      sql: `
    SELECT m.id, m.username, m.role, m.full_name, m.clan
    FROM members m
    JOIN sessions s ON m.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `,
      args: [token],
    })
  ).rows[0] as unknown as AuthUser | undefined

  if (!user) {
    return res.status(401).json({ success: false, error: 'Sesión inválida o expirada' })
  }

  req.user = user
  next()
}

export function requireCaptain(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'captain') {
      return res.status(403).json({ success: false, error: 'Solo los capitanes pueden acceder a esto' })
    }
    next()
  })
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.username !== 'chicolinas') {
      return res.status(403).json({ success: false, error: 'Solo chicolinas puede cambiar esto' })
    }
    next()
  })
}

export function requireReportAccess(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    if (req.user?.username === 'chicolinas') return next()

    const db = getDatabase()
    const row = (
      await db.execute({ sql: 'SELECT enabled FROM member_report_access WHERE member_id = ?', args: [req.user!.id] })
    ).rows[0] as unknown as { enabled: number } | undefined

    if (row?.enabled) return next()
    return res.status(403).json({
      success: false,
      error: 'Chicolinas todavía no te habilitó el acceso a los reportes',
    })
  })
}
