import type { SquadTeamEntry } from './squadReportParser'

export interface SquadReportSummary {
  equipos: number
  valorTotal: number
  valorPromedio: number
  eficienciaPromedio: number
  bestValue: SquadTeamEntry | null
  bestEfficiency: SquadTeamEntry | null
}

export function summarizeSquadReport(teams: SquadTeamEntry[]): SquadReportSummary {
  const withValue = teams.filter((t) => t.valorActual !== null)
  const withEff = teams.filter((t) => t.eficiencia !== null)

  const valorTotal = withValue.reduce((sum, t) => sum + (t.valorActual ?? 0), 0)
  const eficienciaTotal = withEff.reduce((sum, t) => sum + (t.eficiencia ?? 0), 0)

  const bestValue = withValue.length
    ? [...withValue].sort((a, b) => (b.valorActual ?? 0) - (a.valorActual ?? 0))[0]
    : null
  const bestEfficiency = withEff.length
    ? [...withEff].sort((a, b) => (b.eficiencia ?? 0) - (a.eficiencia ?? 0))[0]
    : null

  return {
    equipos: teams.length,
    valorTotal,
    valorPromedio: withValue.length ? valorTotal / withValue.length : 0,
    eficienciaPromedio: withEff.length ? eficienciaTotal / withEff.length : 0,
    bestValue,
    bestEfficiency,
  }
}
