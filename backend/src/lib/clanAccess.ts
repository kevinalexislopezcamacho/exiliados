import type { AuthUser } from '../middleware/auth'

// Clanes cuyos reportes (jornadas/armado) puede VER este usuario. Exiliados
// es el clan "principal" y también supervisa a Rayo (el clan alimentador,
// de donde se asciende gente a Exiliados), así que sus integrantes ven los
// reportes de ambos clanes. Rayo solo ve los suyos. chicolinas no usa esto:
// siempre ve todo, se maneja aparte en cada ruta.
export function visibleClansFor(user: AuthUser | undefined): string[] {
  if (user?.clan === 'exiliados') return ['exiliados', 'rayo']
  return user?.clan ? [user.clan] : []
}
