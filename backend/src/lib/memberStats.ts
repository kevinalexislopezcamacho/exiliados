import Database from 'better-sqlite3'
import type { ParsedMatch } from './battleReportParser'

export interface MemberRecentMatch {
  jornada: number
  rival: string
  resultado: string
  resultadoLetra: string
  reportId: number
  reportTitle: string
}

export interface MemberStats {
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
  recentMatches: MemberRecentMatch[]
}

const RECENT_LIMIT = 8

// Estadísticas reales de un integrante, sacadas de los reportes de batalla
// (.xlsx) subidos para su clan — busca su nombre entre los managers de cada
// partido registrado.
export function computeMemberStats(db: Database.Database, fullName: string, clan: string): MemberStats {
  const reports = db
    .prepare(`SELECT id, title, matches_json FROM battle_reports WHERE clan = ? ORDER BY created_at DESC`)
    .all(clan) as Array<{ id: number; title: string; matches_json: string }>

  const nameLower = fullName.trim().toLowerCase()
  let pj = 0
  let v = 0
  let e = 0
  let d = 0
  let gf = 0
  let gc = 0
  const recentMatches: MemberRecentMatch[] = []

  for (const report of reports) {
    const matches = JSON.parse(report.matches_json) as ParsedMatch[]
    const mine = matches.filter((m) => m.manager.trim().toLowerCase() === nameLower)

    for (const m of mine) {
      pj += 1
      gf += m.gf ?? 0
      gc += m.gc ?? 0
      if (m.resultadoLetra === 'V') v += 1
      else if (m.resultadoLetra === 'E') e += 1
      else if (m.resultadoLetra === 'D') d += 1
    }

    if (recentMatches.length < RECENT_LIMIT) {
      for (const m of [...mine].reverse()) {
        recentMatches.push({
          jornada: m.jornada,
          rival: m.rival,
          resultado: m.resultado,
          resultadoLetra: m.resultadoLetra,
          reportId: report.id,
          reportTitle: report.title,
        })
        if (recentMatches.length >= RECENT_LIMIT) break
      }
    }
  }

  const pts = v * 3 + e
  return {
    pj,
    v,
    e,
    d,
    gf,
    gc,
    dif: gf - gc,
    pts,
    efectividad: pj > 0 ? pts / (pj * 3) : 0,
    recentMatches,
  }
}
