import ExcelJS from 'exceljs'

export interface SquadTeamEntry {
  equipo: string
  grupo: string
  usuario: string
  valorInicial: number | null
  valorActual: number | null
  vendido: number | null
  gastado: number | null
  disponible: number | null
  progreso: number | null
  factorVenta: number | null
  factorCompra: number | null
  inmediatas: number | null
  factorVentaInmediatas: number | null
  eficiencia: number | null
  ventas: number | null
  compras: number | null
  meta: number | null
}

export interface ParsedSquadReport {
  sheetName: string
  teams: SquadTeamEntry[]
}

// Team N (1-5) -> meta objetivo (posición 1,3,5,7,9 en la tabla combinada de esa batalla)
const META_BY_SLOT: Record<number, number> = { 1: 1, 2: 3, 3: 5, 4: 7, 5: 9 }

function cellToPrimitive(value: ExcelJS.CellValue): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    if ('result' in value) return cellToPrimitive((value as ExcelJS.CellFormulaValue).result ?? null)
    if ('richText' in value) return (value as ExcelJS.CellRichTextValue).richText.map((rt) => rt.text).join('')
    return null
  }
  return value as string | number
}

function toNumber(v: string | number | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function metaForEquipo(equipo: string): number | null {
  const match = equipo.match(/(\d+)\s*$/)
  if (!match) return null
  const slot = Number(match[1])
  return META_BY_SLOT[slot] ?? null
}

export async function parseSquadWorkbook(buffer: Buffer): Promise<ParsedSquadReport> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer as any)

  let target: ExcelJS.Worksheet | null = null
  for (const worksheet of workbook.worksheets) {
    const b2 = String(cellToPrimitive(worksheet.getCell('B2').value) ?? '').trim().toUpperCase()
    const d2 = String(cellToPrimitive(worksheet.getCell('D2').value) ?? '').trim().toUpperCase()
    if (b2 === 'EQUIPO' && d2 === 'USUARIO') {
      target = worksheet
      break
    }
  }

  if (!target) {
    throw new Error('No se encontró una hoja "Equipos" con el formato esperado (columnas EQUIPO/USUARIO)')
  }

  const teams: SquadTeamEntry[] = []
  for (let r = 3; r <= target.rowCount; r++) {
    const row = target.getRow(r)
    const equipo = String(cellToPrimitive(row.getCell(2).value) ?? '').trim()
    if (!equipo) continue
    const usuario = String(cellToPrimitive(row.getCell(4).value) ?? '').trim()
    if (!usuario) continue

    teams.push({
      equipo,
      grupo: String(cellToPrimitive(row.getCell(3).value) ?? '').trim(),
      usuario,
      valorInicial: toNumber(cellToPrimitive(row.getCell(5).value)),
      valorActual: toNumber(cellToPrimitive(row.getCell(8).value)),
      vendido: toNumber(cellToPrimitive(row.getCell(11).value)),
      gastado: toNumber(cellToPrimitive(row.getCell(13).value)),
      disponible: toNumber(cellToPrimitive(row.getCell(15).value)),
      progreso: toNumber(cellToPrimitive(row.getCell(16).value)),
      factorVenta: toNumber(cellToPrimitive(row.getCell(17).value)),
      factorCompra: toNumber(cellToPrimitive(row.getCell(18).value)),
      inmediatas: toNumber(cellToPrimitive(row.getCell(20).value)),
      factorVentaInmediatas: toNumber(cellToPrimitive(row.getCell(21).value)),
      eficiencia: toNumber(cellToPrimitive(row.getCell(22).value)),
      ventas: toNumber(cellToPrimitive(row.getCell(23).value)),
      compras: toNumber(cellToPrimitive(row.getCell(24).value)),
      meta: metaForEquipo(equipo),
    })
  }

  if (teams.length === 0) {
    throw new Error('No se encontraron equipos con datos en la hoja "Equipos"')
  }

  return { sheetName: target.name, teams }
}
