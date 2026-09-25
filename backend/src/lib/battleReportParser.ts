import ExcelJS from 'exceljs'

const UTILITY_SHEETS = new Set(['LISTAS', 'HISTORIAL', 'TEAM RED', 'TEAM BLUE', 'TEAM REDS', 'TEAM BLUES', 'RESUMEN'])
const AMBIGUOUS_LABELS = new Set(['LOCAL', 'VISITA', 'MEDIO', 'NUESTRA', 'RIVAL', 'NUESTRO', 'YO'])

export interface ParsedMatch {
  jornada: number
  condicion: string
  manager: string
  rival: string
  golLocal: number | null
  golVisita: number | null
  resultado: string
  resultadoLetra: string
  tirosLocal: number | null
  tirosVisita: number | null
  posesionLocal: number | null
  posesionVisita: number | null
  gf: number | null
  gc: number | null
  pts: number | null
  dif: number | null
  conclusiones: string
  detalle: Record<string, string | number>
}

export interface ParsedBattle {
  sheetName: string
  teamLabel: string
  rivalLabel: string
  matches: ParsedMatch[]
  // Slot (1-5) -> nombre, sacado de las columnas "MGR 1".."MGR 5" (nuestros)
  // y "RIV 1".."RIV 5" (rival) de la cabecera. Ese slot es el que define la
  // meta de cada quien (1,3,5,7,9), sin necesitar el archivo de armado.
  managerSlots: Record<number, string>
  rivalSlots: Record<number, string>
}

// Slot (posición del manager en la rotación de la batalla) -> meta objetivo
// en la tabla combinada de 10 (posición 1,3,5,7,9).
export const META_BY_SLOT: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 }

function extractSlots(rows: Array<Array<string | number | boolean | null>>): {
  managerSlots: Record<number, string>
  rivalSlots: Record<number, string>
} {
  const managerSlots: Record<number, string> = {}
  const rivalSlots: Record<number, string> = {}
  const labelRow = rows[2] ?? []
  const nameRow = rows[3] ?? []

  for (let i = 0; i < labelRow.length; i++) {
    const label = String(labelRow[i] ?? '').trim().toUpperCase()
    const mgrMatch = label.match(/^MGR\s*(\d)$/)
    const rivMatch = label.match(/^RIV\s*(\d)$/)
    if (!mgrMatch && !rivMatch) continue
    const name = String(nameRow[i] ?? '').trim()
    if (!name) continue
    if (mgrMatch) managerSlots[Number(mgrMatch[1])] = name
    else if (rivMatch) rivalSlots[Number(rivMatch[1])] = name
  }

  return { managerSlots, rivalSlots }
}

function cellToPrimitive(value: ExcelJS.CellValue): string | number | boolean | null {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    if ('result' in value) return cellToPrimitive((value as ExcelJS.CellFormulaValue).result ?? '')
    if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
    if ('text' in value) return String((value as any).text ?? '')
    if ('error' in value) return ''
    return ''
  }
  return value as string | number | boolean
}

function sheetToRows(worksheet: ExcelJS.Worksheet): Array<Array<string | number | boolean | null>> {
  const rows: Array<Array<string | number | boolean | null>> = []
  const colCount = Math.max(worksheet.columnCount, 60)
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r)
    const arr: Array<string | number | boolean | null> = new Array(colCount).fill('')
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      if (colNumber - 1 < colCount) arr[colNumber - 1] = cellToPrimitive(cell.value)
    })
    rows.push(arr)
  }
  return rows
}

function toNumberOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export interface MatchOutcome {
  gf: number | null
  gc: number | null
  dif: number | null
  resultadoLetra: string
  pts: number
  resultado: string
}

// GF/GC/DIF/resultado/PTS se derivan siempre de goles+condición (nunca de
// columnas de fórmulas del Excel, que a veces no traen el resultado
// cacheado). La usan tanto el parser del Excel como los partidos reportados
// a mano, para que ambos calculen el resultado exactamente igual.
export function deriveOutcome(condicion: string, golLocal: number | null, golVisita: number | null): MatchOutcome {
  const gf = condicion === 'Visita' ? golVisita : golLocal
  const gc = condicion === 'Visita' ? golLocal : golVisita
  const dif = gf !== null && gc !== null ? gf - gc : null
  const resultadoLetra = dif !== null ? (dif > 0 ? 'V' : dif === 0 ? 'E' : 'D') : ''
  const pts = resultadoLetra === 'V' ? 3 : resultadoLetra === 'E' ? 1 : 0
  const resultado = golLocal !== null && golVisita !== null ? `${golLocal}-${golVisita}` : ''
  return { gf, gc, dif, resultadoLetra, pts, resultado }
}

function resolveColumnKeys(groupRow: Array<string | number | boolean | null>, labelRow: Array<string | number | boolean | null>): string[] {
  const seen: Record<string, number> = {}
  let currentGroup = ''
  return labelRow.map((raw, i) => {
    const g = String(groupRow[i] ?? '').trim()
    if (g) currentGroup = g
    const label = String(raw ?? '').trim()
    let key = label || `COL_${i}`
    if (AMBIGUOUS_LABELS.has(label)) key = `${currentGroup}__${label}`
    if (seen[key] !== undefined) {
      seen[key] += 1
      key = `${key}__${seen[key]}`
    } else {
      seen[key] = 0
    }
    return key
  })
}

function findBattleSheet(workbook: ExcelJS.Workbook): { sheetName: string; rows: Array<Array<string | number | boolean | null>> } | null {
  for (const worksheet of workbook.worksheets) {
    if (UTILITY_SHEETS.has(worksheet.name.trim().toUpperCase())) continue
    const rows = sheetToRows(worksheet)
    if (rows.length < 9) continue
    const headerRow = rows[7] ?? []
    const looksRight =
      String(headerRow[0]).toUpperCase() === 'JORNADA' && String(headerRow[6]).toUpperCase() === 'RESULTADO'
    if (!looksRight) continue
    const hasData = rows.slice(8).some((row) => row[4] !== '' && row[4] !== null && row[4] !== undefined)
    if (hasData) return { sheetName: worksheet.name, rows }
  }
  return null
}

const CORE_KEYS = new Set([
  'JORNADA',
  'CONDICIÓN',
  'GOL LOCAL',
  'GOL VISITA',
  'RESULTADO',
  'R',
  'TIROS__LOCAL',
  'TIROS__VISITA',
  'POSESIÓN__LOCAL',
  'POSESIÓN__VISITA',
  'CONCLUSIONES (OPCIONAL)',
  'GF',
  'GC',
  'PTS',
  'DIF',
])

export async function parseBattleWorkbook(buffer: Buffer): Promise<ParsedBattle> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  const found = findBattleSheet(workbook)
  if (!found) {
    throw new Error('No se encontró una pestaña de batalla con datos jugados en este archivo')
  }
  const { sheetName, rows } = found

  const groupRow = rows[6] ?? []
  const labelRow = rows[7] ?? []
  const keys = resolveColumnKeys(groupRow, labelRow)

  const condicionIdx = keys.indexOf('CONDICIÓN')
  const teamLabel = String(labelRow[condicionIdx + 1] ?? 'Nosotros') || 'Nosotros'
  const rivalLabel = String(labelRow[condicionIdx + 2] ?? 'Rival') || 'Rival'
  const { managerSlots, rivalSlots } = extractSlots(rows)

  const matches: ParsedMatch[] = []
  let currentJornada = 0

  for (let r = 8; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.every((cell) => cell === '' || cell === null || cell === undefined)) continue

    const record: Record<string, string | number | boolean | null> = {}
    keys.forEach((key, i) => {
      record[key] = row[i]
    })

    if (record['JORNADA'] !== '' && record['JORNADA'] !== null && record['JORNADA'] !== undefined) {
      currentJornada = Number(record['JORNADA']) || currentJornada
    }

    const golLocal = toNumberOrNull(record['GOL LOCAL'])
    const golVisita = toNumberOrNull(record['GOL VISITA'])
    if (golLocal === null && golVisita === null) continue

    const manager = String(row[condicionIdx + 1] ?? '').trim()
    const rival = String(row[condicionIdx + 2] ?? '').trim()
    if (!manager) continue

    const condicion = String(record['CONDICIÓN'] ?? '')
    // GF/GC/PTS/DIF/R vienen de fórmulas compartidas en el Excel que a veces no
    // traen el resultado cacheado (Google Sheets no siempre lo guarda para
    // todas las celdas del rango compartido). Se calculan aquí en vez de leer
    // esas columnas directamente, ya que son derivables de datos que sí son fiables.
    const outcome = deriveOutcome(condicion, golLocal, golVisita)
    const { gf, gc, dif } = outcome
    let resultadoLetra = String(record['R'] ?? '').trim().toUpperCase()
    if (resultadoLetra !== 'V' && resultadoLetra !== 'E' && resultadoLetra !== 'D') {
      resultadoLetra = outcome.resultadoLetra
    }
    const pts = resultadoLetra === 'V' ? 3 : resultadoLetra === 'E' ? 1 : 0

    const detalle: Record<string, string | number> = {}
    keys.forEach((key, i) => {
      if (i === condicionIdx + 1 || i === condicionIdx + 2) return
      if (CORE_KEYS.has(key)) return
      const value = row[i]
      if (value !== '' && value !== null && value !== undefined) {
        detalle[key] = typeof value === 'boolean' ? String(value) : value
      }
    })

    matches.push({
      jornada: currentJornada,
      condicion,
      manager,
      rival,
      golLocal,
      golVisita,
      resultado: String(record['RESULTADO'] ?? '') || (golLocal !== null && golVisita !== null ? `${golLocal}-${golVisita}` : ''),
      resultadoLetra,
      tirosLocal: toNumberOrNull(record['TIROS__LOCAL']),
      tirosVisita: toNumberOrNull(record['TIROS__VISITA']),
      posesionLocal: toNumberOrNull(record['POSESIÓN__LOCAL']),
      posesionVisita: toNumberOrNull(record['POSESIÓN__VISITA']),
      gf,
      gc,
      pts,
      dif,
      conclusiones: String(record['CONCLUSIONES (OPCIONAL)'] ?? ''),
      detalle,
    })
  }

  return { sheetName, teamLabel, rivalLabel, matches, managerSlots, rivalSlots }
}
