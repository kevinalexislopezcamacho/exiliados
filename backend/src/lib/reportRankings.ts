import type { Client } from '@libsql/client'
import { getCountryFlag, slugifyUsername } from '../db'
import { computeMetaCompliance, type MetaCompliance } from './metaTracking'
import { computeSquadRankings } from './squadRankings'
import { compositeScore, normalize } from './compositeScore'
import { RANKED_CLANS, type RankedClan } from './clanTypes'

export { RANKED_CLANS }
export type { RankedClan }

export interface RankingEntry {
  name: string
  flag: string
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
  valorActual: number | null
  eficiencia: number | null
  meta: MetaCompliance | null
  score: number
}

export type RankingsData = Record<RankedClan, RankingEntry[]>

interface ManagerAccumulator {
  manager: string
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
}

// El ranking ya no se registra a mano: se recalcula sumando los managers de
// todos los reportes de batalla (.xlsx) subidos para cada clan, y se cruza
// con el armado (valor/eficiencia) y la meta para armar un puntaje
// compuesto — el mismo criterio que usa el Ranking General.
export async function computeReportRankings(db: Client): Promise<RankingsData> {
  const reportRows = (
    await db.execute(`SELECT clan, summary_json FROM battle_reports WHERE clan IN ('rayo', 'exiliados')`)
  ).rows as unknown as Array<{ clan: RankedClan; summary_json: string }>

  const totals = new Map<string, ManagerAccumulator>()

  for (const row of reportRows) {
    const summary = JSON.parse(row.summary_json) as { managers?: ManagerAccumulator[] }
    for (const m of summary.managers ?? []) {
      // Agrupa por versión "slug": el mismo manager puede estar escrito
      // distinto entre reportes subidos en momentos distintos.
      const key = `${row.clan}::${slugifyUsername(m.manager)}`
      const acc = totals.get(key) ?? { manager: m.manager.trim(), pj: 0, v: 0, e: 0, d: 0, gf: 0, gc: 0 }
      acc.pj += m.pj
      acc.v += m.v
      acc.e += m.e
      acc.d += m.d
      acc.gf += m.gf
      acc.gc += m.gc
      totals.set(key, acc)
    }
  }

  const flagRows = (
    await db.execute(`SELECT name, clan, country_code as countryCode FROM clan_members WHERE clan IN ('rayo', 'exiliados')`)
  ).rows as unknown as Array<{ name: string; clan: RankedClan; countryCode: string }>
  const flagByKey = new Map<string, string>()
  for (const row of flagRows) {
    flagByKey.set(`${row.clan}::${slugifyUsername(row.name)}`, row.countryCode ? getCountryFlag(row.countryCode) : '')
  }

  const metaByClan: Record<RankedClan, Map<string, MetaCompliance>> = {
    rayo: await computeMetaCompliance(db, 'rayo'),
    exiliados: await computeMetaCompliance(db, 'exiliados'),
  }

  const armadoByClan = await computeSquadRankings(db)
  const armadoByKey: Record<RankedClan, Map<string, { valorActual: number | null; eficiencia: number | null }>> = {
    rayo: new Map(),
    exiliados: new Map(),
  }
  for (const clan of RANKED_CLANS) {
    for (const entry of armadoByClan[clan]) {
      armadoByKey[clan].set(slugifyUsername(entry.usuario), {
        valorActual: entry.valorActual,
        eficiencia: entry.eficiencia,
      })
    }
  }

  const data: RankingsData = { rayo: [], exiliados: [] }
  for (const [key, stat] of totals) {
    const clan = key.split('::')[0] as RankedClan
    const nameSlug = slugifyUsername(stat.manager)
    const flag = flagByKey.get(`${clan}::${nameSlug}`) ?? ''
    const armado = armadoByKey[clan].get(nameSlug) ?? { valorActual: null, eficiencia: null }
    data[clan].push({
      name: stat.manager,
      flag,
      pj: stat.pj,
      v: stat.v,
      e: stat.e,
      d: stat.d,
      gf: stat.gf,
      gc: stat.gc,
      dif: stat.gf - stat.gc,
      pts: stat.v * 3 + stat.e,
      efectividad: stat.pj > 0 ? (stat.v * 3 + stat.e) / (stat.pj * 3) : 0,
      valorActual: armado.valorActual,
      eficiencia: armado.eficiencia,
      meta: metaByClan[clan].get(nameSlug) ?? null,
      score: 0,
    })
  }

  // El valor se normaliza contra TODOS los managers de ambos clanes (no solo
  // el propio clan), para que el puntaje de cada quien sea el mismo número
  // sin importar si se ve en el ranking por clan o en el general.
  const valoresGlobales = RANKED_CLANS.flatMap((clan) => data[clan].map((e) => e.valorActual))

  for (const clan of RANKED_CLANS) {
    for (const entry of data[clan]) {
      const valorNormalizado = normalize(entry.valorActual, valoresGlobales)
      entry.score = compositeScore({
        efectividad: entry.efectividad,
        eficiencia: entry.eficiencia,
        valorNormalizado,
        metaMet: entry.meta ? entry.meta.met : null,
      })
    }
    data[clan].sort((a, b) => b.score - a.score || b.pts - a.pts || a.name.localeCompare(b.name))
  }

  return data
}
