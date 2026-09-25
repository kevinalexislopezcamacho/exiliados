import type { Client } from '@libsql/client'
import { slugifyUsername } from '../db'
import { RANKED_CLANS, type RankedClan } from './clanTypes'
import { computeReportRankings } from './reportRankings'
import { computeSquadRankings } from './squadRankings'
import { compositeScore, normalize } from './compositeScore'
import type { MetaCompliance } from './metaTracking'

export interface GeneralRankingEntry {
  name: string
  clan: RankedClan | null
  flag: string
  pj: number | null
  pts: number | null
  efectividad: number | null
  valorActual: number | null
  eficiencia: number | null
  compras: number | null
  meta: MetaCompliance | null
  score: number
}

// Quinto ranking: combina Rayo + Exiliados, cruzando jornadas (puntos,
// efectividad, meta) con armado (valor de equipo, eficiencia) por manager, y
// calcula el mismo puntaje compuesto 0-100 que se usa en los rankings por
// clan, para decidir quién es "el mejor" de verdad entre todos.
export async function computeGeneralRanking(db: Client): Promise<GeneralRankingEntry[]> {
  const jornadas = await computeReportRankings(db)
  const armado = await computeSquadRankings(db)

  const byName = new Map<string, GeneralRankingEntry>()

  for (const clan of RANKED_CLANS) {
    for (const entry of jornadas[clan]) {
      const key = slugifyUsername(entry.name)
      byName.set(key, {
        name: entry.name,
        clan,
        flag: entry.flag,
        pj: entry.pj,
        pts: entry.pts,
        efectividad: entry.efectividad,
        valorActual: entry.valorActual,
        eficiencia: entry.eficiencia,
        compras: null,
        meta: entry.meta,
        score: 0,
      })
    }
    for (const entry of armado[clan]) {
      const key = slugifyUsername(entry.usuario)
      const existing = byName.get(key) ?? {
        name: entry.usuario,
        clan,
        flag: '',
        pj: null,
        pts: null,
        efectividad: null,
        valorActual: null,
        eficiencia: null,
        compras: null,
        meta: null,
        score: 0,
      }
      existing.valorActual = entry.valorActual
      existing.eficiencia = entry.eficiencia
      existing.compras = entry.compras
      if (!existing.clan) existing.clan = clan
      byName.set(key, existing)
    }
  }

  const entries = Array.from(byName.values())
  const valores = entries.map((e) => e.valorActual)

  for (const entry of entries) {
    const valorNormalizado = normalize(entry.valorActual, valores)
    entry.score = compositeScore({
      efectividad: entry.efectividad,
      eficiencia: entry.eficiencia,
      valorNormalizado,
      metaMet: entry.meta ? entry.meta.met : null,
    })
  }

  return entries.sort((a, b) => b.score - a.score || (b.pts ?? -Infinity) - (a.pts ?? -Infinity))
}
