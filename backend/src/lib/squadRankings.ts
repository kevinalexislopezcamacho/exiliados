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

// Ranking de armado por clan: para cada manager se usa su entrada MÁS
// RECIENTE (el último reporte de armado donde aparece), para reflejar el
// estado actual de su equipo y no mezclar batallas viejas. La hoja "Equipos"
// trae AMBOS lados de la batalla (nosotros y el rival) — se filtra por el
// roster real del clan para no mostrar jugadores rivales.
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
        sql: `SELECT title, teams_json, created_at FROM squad_reports WHERE clan = ? ORDER BY created_at DESC`,
        args: [clan],
      })
    ).rows as unknown as Array<{ title: string; teams_json: string; created_at: string }>

    const seen = new Set<string>()
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
        if (!key || seen.has(key) || !rosterNames.has(key)) continue
        seen.add(key)
        data[clan].push({
          usuario: t.usuario,
          valorActual: t.valorActual,
          eficiencia: t.eficiencia,
          compras: t.compras,
          ventas: t.ventas,
          reportTitle: report.title,
        })
      }
    }

    data[clan].sort((a, b) => (b.valorActual ?? -Infinity) - (a.valorActual ?? -Infinity))
  }

  return data
}
