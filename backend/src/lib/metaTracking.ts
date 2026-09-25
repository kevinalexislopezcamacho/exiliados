import Database from 'better-sqlite3'
import type { ParsedMatch } from './battleReportParser'
import { META_BY_SLOT } from './battleReportParser'
import { slugifyUsername } from '../db'

export interface MetaCompliance {
  met: boolean
}

interface CombinedEntry {
  name: string
  pts: number
  dif: number
  gf: number
}

// Tabla de posiciones combinada (nuestros 5 managers + los 5 del rival) de
// una batalla, para poder comparar la posición real contra la meta de cada
// equipo (slot 1-5 -> meta 1,3,5,7,9). No se expone, es interna.
function computeCombinedStandings(matches: ParsedMatch[]): Map<string, number> {
  const ours = new Map<string, CombinedEntry>()
  const rivals = new Map<string, CombinedEntry>()

  for (const m of matches) {
    const gf = m.gf ?? 0
    const gc = m.gc ?? 0
    const ptsOurs = m.resultadoLetra === 'V' ? 3 : m.resultadoLetra === 'E' ? 1 : 0
    const ptsRival = m.resultadoLetra === 'D' ? 3 : m.resultadoLetra === 'E' ? 1 : 0

    // Agrupa por versión "slug": el mismo manager puede estar escrito
    // distinto entre jornadas dentro del mismo reporte.
    const managerKey = slugifyUsername(m.manager)
    const rivalKey = slugifyUsername(m.rival)

    const o = ours.get(managerKey) ?? { name: m.manager.trim(), pts: 0, dif: 0, gf: 0 }
    o.pts += ptsOurs
    o.dif += gf - gc
    o.gf += gf
    ours.set(managerKey, o)

    const r = rivals.get(rivalKey) ?? { name: m.rival.trim(), pts: 0, dif: 0, gf: 0 }
    r.pts += ptsRival
    r.dif += gc - gf
    r.gf += gc
    rivals.set(rivalKey, r)
  }

  const combined = [...ours.values(), ...rivals.values()].sort(
    (a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf
  )

  const positions = new Map<string, number>()
  combined.forEach((entry, idx) => positions.set(slugifyUsername(entry.name), idx + 1))
  return positions
}

// Si cada manager de un clan cumplió meta o no en su batalla de jornadas MÁS
// RECIENTE. La meta sale del propio archivo de jornadas: la posición del
// manager en las columnas "MGR 1".."MGR 5" (o "RIV 1".."RIV 5" si el que se
// evalúa es un rival) define su meta objetivo (slot 1=meta1 ... slot 5=meta9),
// y se compara contra la posición real que sacó en la tabla combinada de 10.
// No depende del archivo de armado.
export function computeMetaCompliance(db: Database.Database, clan: string): Map<string, MetaCompliance> {
  const battleReports = db
    .prepare(`SELECT matches_json, slots_json FROM battle_reports WHERE clan = ? ORDER BY created_at DESC`)
    .all(clan) as Array<{ matches_json: string; slots_json: string }>

  const result = new Map<string, MetaCompliance>()

  for (const battle of battleReports) {
    let slots: { managerSlots?: Record<string, string> } = {}
    try {
      slots = JSON.parse(battle.slots_json || '{}')
    } catch {
      slots = {}
    }
    const managerSlots = slots.managerSlots ?? {}
    if (Object.keys(managerSlots).length === 0) continue

    const metaByName = new Map<string, number>()
    for (const [slot, name] of Object.entries(managerSlots)) {
      const meta = META_BY_SLOT[Number(slot)]
      if (meta !== undefined && name) metaByName.set(slugifyUsername(name), meta)
    }
    if (metaByName.size === 0) continue

    const matches = JSON.parse(battle.matches_json) as ParsedMatch[]
    const positions = computeCombinedStandings(matches)

    // Dedup por versión "slug": el mismo manager puede estar escrito
    // distinto entre jornadas dentro del mismo reporte.
    const ourManagerKeys = new Set(matches.map((m) => slugifyUsername(m.manager)).filter(Boolean))
    for (const key of ourManagerKeys) {
      // Ya se evaluó con un reporte más reciente (los reportes vienen
      // ordenados de más nuevo a más viejo): no se sobrescribe.
      if (result.has(key)) continue

      const meta = metaByName.get(key)
      if (meta === undefined) continue
      const position = positions.get(key)
      if (position === undefined) continue

      result.set(key, { met: position <= meta })
    }
  }

  return result
}
