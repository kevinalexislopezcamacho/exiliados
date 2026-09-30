import type { Client } from '@libsql/client'
import { slugifyUsername } from '../db'
import { RANKED_CLANS, type RankedClan } from './clanTypes'

export interface SquadRankingEntry {
  usuario: string
  valorActual: number | null
  eficiencia: number | null
  compras: number | null
  ventas: number | null
  reportTitle: string
}

export type SquadRankingsData = Record<RankedClan, SquadRankingEntry[]>

// Ranking de armado por clan: para cada manager se usa su entrada de MAYOR
// VALOR DE EQUIPO entre todos los reportes de armado donde aparece (su pico
// histórico), junto con la eficiencia/compras/ventas de ESE MISMO reporte
// (no se mezclan campos de reportes distintos). La hoja "Equipos" trae AMBOS
// lados de la batalla (nosotros y el rival) — se filtra por el roster real
// del clan para no mostrar jugadores rivales.
export async function computeSquadRankings(db: Client): Promise<SquadRankingsData> {
  const data: SquadRankingsData = { rayo: [], exiliados: [] }

  for (const clan of RANKED_CLANS) {
    const rosterNames = new Set(
      (
        (await db.execute({ sql: `SELECT name FROM clan_members WHERE clan = ?`, args: [clan] }))
          .rows as unknown as Array<{ name: string }>
      ).map((r) => slugifyUsername(r.name))
    )

    const reports = (
      await db.execute({
        sql: `SELECT title, teams_json FROM squad_reports WHERE clan = ?`,
        args: [clan],
      })
    ).rows as unknown as Array<{ title: string; teams_json: string }>

    const best = new Map<string, SquadRankingEntry>()
    for (const report of reports) {
      const teams = JSON.parse(report.teams_json) as Array<{
        usuario: string
        valorActual: number | null
        eficiencia: number | null
        compras: number | null
        ventas: number | null
      }>
      for (const t of teams) {
        const key = slugifyUsername(t.usuario)
        if (!key || !rosterNames.has(key)) continue
        const current = best.get(key)
        if (current && (current.valorActual ?? -Infinity) >= (t.valorActual ?? -Infinity)) continue
        best.set(key, {
          usuario: t.usuario,
          valorActual: t.valorActual,
          eficiencia: t.eficiencia,
          compras: t.compras,
          ventas: t.ventas,
          reportTitle: report.title,
        })
      }
    }

    data[clan] = Array.from(best.values()).sort((a, b) => (b.valorActual ?? -Infinity) - (a.valorActual ?? -Infinity))
  }

  return data
}
