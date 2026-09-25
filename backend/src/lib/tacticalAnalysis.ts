import Database from 'better-sqlite3'
import type { ParsedMatch } from './battleReportParser'

export interface PressureBand {
  key: string
  label: string
  min: number
  max: number
}

// Bandas de presión que definió el capitán: 0-19 muy baja ... 80-100 muy alta.
export const PRESSURE_BANDS: PressureBand[] = [
  { key: 'muy_baja', label: 'Muy baja (0-19)', min: 0, max: 19 },
  { key: 'baja', label: 'Baja (20-39)', min: 20, max: 39 },
  { key: 'neutra', label: 'Neutra (40-59)', min: 40, max: 59 },
  { key: 'alta', label: 'Alta (60-79)', min: 60, max: 79 },
  { key: 'muy_alta', label: 'Muy alta (80-100)', min: 80, max: 100 },
]

interface RecordAcc {
  pj: number
  v: number
  e: number
  d: number
}

export interface PressureStat extends RecordAcc {
  band: string
  label: string
  efectividad: number
}

export interface FormationStat extends RecordAcc {
  formacion: string
  efectividad: number
}

export interface FormationPressureStat extends RecordAcc {
  formacion: string
  rivalFormacion: string
  band: string
  label: string
  efectividad: number
}

export interface TacticalAnalysis {
  totalPartidosConDatos: number
  byPressure: PressureStat[]
  byFormation: FormationStat[]
  byFormationAndPressure: FormationPressureStat[]
}

function emptyRecord(): RecordAcc {
  return { pj: 0, v: 0, e: 0, d: 0 }
}

function addResult(acc: RecordAcc, letra: string) {
  acc.pj += 1
  if (letra === 'V') acc.v += 1
  else if (letra === 'E') acc.e += 1
  else if (letra === 'D') acc.d += 1
}

function efectividad(acc: RecordAcc): number {
  return acc.pj > 0 ? (acc.v * 3 + acc.e) / (acc.pj * 3) : 0
}

function bandFor(pressure: number): PressureBand | null {
  return PRESSURE_BANDS.find((b) => pressure >= b.min && pressure <= b.max) ?? null
}

export function computeTacticalAnalysis(db: Database.Database, clan: string): TacticalAnalysis {
  const reports = db
    .prepare(`SELECT matches_json FROM battle_reports WHERE clan = ?`)
    .all(clan) as Array<{ matches_json: string }>

  const byPressure = new Map<string, RecordAcc>()
  const byFormation = new Map<string, RecordAcc>()
  const byFormationAndPressure = new Map<string, RecordAcc>()
  let totalPartidosConDatos = 0

  for (const report of reports) {
    const matches = JSON.parse(report.matches_json) as ParsedMatch[]
    for (const m of matches) {
      const presionRaw = m.detalle?.['PRESIÓN']
      const formacionRaw = m.detalle?.['TÁCTICAS__NUESTRA']
      const rivalFormacionRaw = m.detalle?.['TÁCTICAS__RIVAL']
      const presion = presionRaw !== undefined ? Number(presionRaw) : NaN
      const formacion = formacionRaw !== undefined ? String(formacionRaw).trim() : ''
      const rivalFormacion = rivalFormacionRaw !== undefined ? String(rivalFormacionRaw).trim() : ''

      const hasPresion = Number.isFinite(presion)
      const hasFormacion = !!formacion

      if (!hasPresion && !hasFormacion) continue
      totalPartidosConDatos += 1

      if (hasPresion) {
        const band = bandFor(presion)
        if (band) {
          const acc = byPressure.get(band.key) ?? emptyRecord()
          addResult(acc, m.resultadoLetra)
          byPressure.set(band.key, acc)
        }
      }

      if (hasFormacion) {
        const acc = byFormation.get(formacion) ?? emptyRecord()
        addResult(acc, m.resultadoLetra)
        byFormation.set(formacion, acc)
      }

      if (hasPresion && hasFormacion) {
        const band = bandFor(presion)
        if (band) {
          const rivalKey = rivalFormacion || '—'
          const key = `${formacion}::${band.key}::${rivalKey}`
          const acc = byFormationAndPressure.get(key) ?? emptyRecord()
          addResult(acc, m.resultadoLetra)
          byFormationAndPressure.set(key, acc)
        }
      }
    }
  }

  const byPressureArr: PressureStat[] = PRESSURE_BANDS.map((band) => {
    const acc = byPressure.get(band.key) ?? emptyRecord()
    return { band: band.key, label: band.label, ...acc, efectividad: efectividad(acc) }
  }).filter((s) => s.pj > 0)

  const byFormationArr: FormationStat[] = Array.from(byFormation.entries())
    .map(([formacion, acc]) => ({ formacion, ...acc, efectividad: efectividad(acc) }))
    .sort((a, b) => b.pj - a.pj)

  const byFormationAndPressureArr: FormationPressureStat[] = Array.from(byFormationAndPressure.entries())
    .map(([key, acc]) => {
      const [formacion, bandKey, rivalFormacion] = key.split('::')
      const band = PRESSURE_BANDS.find((b) => b.key === bandKey)!
      return { formacion, rivalFormacion, band: bandKey, label: band.label, ...acc, efectividad: efectividad(acc) }
    })
    .sort((a, b) => b.pj - a.pj)

  return {
    totalPartidosConDatos,
    byPressure: byPressureArr,
    byFormation: byFormationArr,
    byFormationAndPressure: byFormationAndPressureArr,
  }
}
