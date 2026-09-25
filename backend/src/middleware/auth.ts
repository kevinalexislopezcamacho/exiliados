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

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.['auth-token']

  if (!token) {
    return res.status(401).json({ success: false, error: 'No autenticado' })
  }

  const db = getDatabase()
  const user = db
    .prepare(
      `
    SELECT m.id, m.username, m.role, m.full_name, m.clan
    FROM members m
    JOIN sessions s ON m.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `
    )
    .get(token) as AuthUser | undefined
  db.close()

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

// Solo chicolinas puede prender/apagar el acceso de los integrantes a los
// reportes (jornadas/armado) de cada clan.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.username !== 'chicolinas') {
      return res.status(403).json({ success: false, error: 'Solo chicolinas puede cambiar esto' })
    }
    next()
  })
}

// Solo chicolinas queda exenta: siempre puede ver los reportes de cualquier
// clan. Todos los demás (capitanes incluidos, menos ella) solo si chicolinas
// habilitó el acceso para ESA persona en particular (no por clan).
export function requireReportAccess(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.username === 'chicolinas') return next()

    const db = getDatabase()
    const row = db.prepare('SELECT enabled FROM member_report_access WHERE member_id = ?').get(req.user?.id) as
      | { enabled: number }
      | undefined
    db.close()

    if (row?.enabled) return next()
    return res.status(403).json({
      success: false,
      error: 'Chicolinas todavía no te habilitó el acceso a los reportes',
    })
  })
}
