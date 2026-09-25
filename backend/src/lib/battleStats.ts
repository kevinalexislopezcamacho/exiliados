import type { ParsedMatch } from './battleReportParser'

export interface ManagerStats {
  manager: string
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
}

export interface JornadaStats {
  jornada: number
  v: number
  e: number
  d: number
}

export interface BattleSummary {
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
  managers: ManagerStats[]
  jornadas: JornadaStats[]
  topScorer: ManagerStats | null
  bestManager: ManagerStats | null
  worstManager: ManagerStats | null
}

function emptyManagerStats(manager: string): ManagerStats {
  return { manager, pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0, dif: 0, pts: 0, efectividad: 0 }
}

export function summarizeBattle(matches: ParsedMatch[]): BattleSummary {
  const totals = { pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 }
  const byManager = new Map<string, ManagerStats>()
  const byJornada = new Map<number, JornadaStats>()

  for (const match of matches) {
    const isWin = match.resultadoLetra === 'V'
    const isDraw = match.resultadoLetra === 'E'
    const isLoss = match.resultadoLetra === 'D'
    const gf = match.gf ?? 0
    const gc = match.gc ?? 0

    totals.pj += 1
    totals.gf += gf
    totals.gc += gc
    if (isWin) totals.v += 1
    else if (isDraw) totals.e += 1
    else if (isLoss) totals.d += 1

    // Agrupa por minúsculas: el mismo manager puede tener mayúsculas
    // distintas entre jornadas dentro del mismo reporte.
    const managerKey = match.manager.trim().toLowerCase()
    const stat = byManager.get(managerKey) ?? emptyManagerStats(match.manager.trim())
    stat.pj += 1
    stat.gf += gf
    stat.gc += gc
    if (isWin) stat.v += 1
    else if (isDraw) stat.e += 1
    else if (isLoss) stat.d += 1
    byManager.set(managerKey, stat)

    const jStat = byJornada.get(match.jornada) ?? { jornada: match.jornada, v: 0, e: 0, d: 0 }
    if (isWin) jStat.v += 1
    else if (isDraw) jStat.e += 1
    else if (isLoss) jStat.d += 1
    byJornada.set(match.jornada, jStat)
  }

  const managers = Array.from(byManager.values())
    .map((s) => ({
      ...s,
      dif: s.gf - s.gc,
      pts: s.v * 3 + s.e,
      efectividad: s.pj > 0 ? (s.v * 3 + s.e) / (s.pj * 3) : 0,
    }))
    .sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf)

  const jornadas = Array.from(byJornada.values()).sort((a, b) => a.jornada - b.jornada)

  const pts = totals.v * 3 + totals.e
  const topScorer = managers.length ? [...managers].sort((a, b) => b.gf - a.gf)[0] : null

  return {
    pj: totals.pj,
    v: totals.v,
    e: totals.e,
    d: totals.d,
    gf: totals.gf,
    gc: totals.gc,
    dif: totals.gf - totals.gc,
    pts,
    efectividad: totals.pj > 0 ? pts / (totals.pj * 3) : 0,
    managers,
    jornadas,
    topScorer,
    bestManager: managers[0] ?? null,
    worstManager: managers.length ? managers[managers.length - 1] : null,
  }
}
