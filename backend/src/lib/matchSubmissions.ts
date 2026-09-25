import { deriveOutcome, type ParsedMatch } from './battleReportParser'

// Un partido que un integrante reportó a mano desde la página, mientras la
// batalla todavía no tiene el Excel oficial (ver battle_match_submissions).
export interface MatchSubmissionRow {
  id: number
  report_id: number
  member_id: number
  manager: string
  jornada: number | null
  condicion: string
  rival: string
  gol_local: number | null
  gol_visita: number | null
  tiros_local: number | null
  tiros_visita: number | null
  posesion_local: number | null
  posesion_visita: number | null
  presion: number | null
  tactica_nuestra: string
  tactica_rival: string
  estilo_nuestro: string
  estilo_rival: string
  estilo_pct: number | null
  velocidad: number | null
  defensas: string
  medios: string
  delanteros: string
  campus: number | null
  conclusiones: string
  created_at: string
  updated_at: string
}

// Mismas claves que arma battleReportParser.ts para estos mismos datos
// cuando vienen del Excel, así el Análisis Táctico y la tabla de detalle
// funcionan igual sin importar si el partido vino a mano o de un archivo.
export function submissionToMatch(row: MatchSubmissionRow): ParsedMatch {
  const outcome = deriveOutcome(row.condicion, row.gol_local, row.gol_visita)
  const detalle: Record<string, string | number> = {}
  if (row.presion !== null) detalle['PRESIÓN'] = row.presion
  if (row.tactica_nuestra) detalle['TÁCTICAS__NUESTRA'] = row.tactica_nuestra
  if (row.tactica_rival) detalle['TÁCTICAS__RIVAL'] = row.tactica_rival
  if (row.estilo_nuestro) detalle['ESTILO__NUESTRO'] = row.estilo_nuestro
  if (row.estilo_rival) detalle['ESTILO__RIVAL'] = row.estilo_rival
  if (row.estilo_pct !== null) detalle['ESTILO'] = row.estilo_pct
  if (row.velocidad !== null) detalle['VELOCIDAD'] = row.velocidad
  if (row.defensas) detalle['DEFENSAS'] = row.defensas
  if (row.medios) detalle['MEDIOS'] = row.medios
  if (row.delanteros) detalle['DELANTEROS'] = row.delanteros
  if (row.campus !== null) detalle['CAMPUS'] = row.campus ? 'Sí' : 'No'

  return {
    jornada: row.jornada ?? 0,
    condicion: row.condicion,
    manager: row.manager,
    rival: row.rival,
    golLocal: row.gol_local,
    golVisita: row.gol_visita,
    resultado: outcome.resultado,
    resultadoLetra: outcome.resultadoLetra,
    tirosLocal: row.tiros_local,
    tirosVisita: row.tiros_visita,
    posesionLocal: row.posesion_local,
    posesionVisita: row.posesion_visita,
    gf: outcome.gf,
    gc: outcome.gc,
    pts: outcome.pts,
    dif: outcome.dif,
    conclusiones: row.conclusiones,
    detalle,
  }
}

// Al subir el Excel oficial de una batalla que ya tenía partidos reportados
// a mano: el Excel manda para cualquier manager que aparezca en él; los
// partidos manuales de gente que el Excel no trae se agregan como respaldo.
export function mergeSubmissionsIntoMatches(
  parsedMatches: ParsedMatch[],
  submissions: MatchSubmissionRow[]
): ParsedMatch[] {
  const managersInXlsx = new Set(parsedMatches.map((m) => m.manager.trim().toLowerCase()))
  const leftover = submissions
    .filter((s) => !managersInXlsx.has(s.manager.trim().toLowerCase()))
    .map(submissionToMatch)
  return [...parsedMatches, ...leftover]
}
