// Tipos y piezas compartidas del Mundial Exiliados.

export interface TorneoParticipante {
  slot: number
  memberId: number | null
  isBot: boolean
  name: string
  countryCode: string
  clan: string | null
  pot: number
  group: string
  groupPos: number
}

export interface TorneoPartido {
  id: number
  stage: 'G' | 'R16' | 'QF' | 'SF' | '3P' | 'F'
  stageLabel: string
  group: string | null
  matchday: number | null
  bracketPos: number | null
  homeSlot: number | null
  awaySlot: number | null
  homeLabel: string | null
  awayLabel: string | null
  opensDay: string
  closesDay: string
  status: 'pendiente' | 'jugado'
  homeGoals: number | null
  awayGoals: number | null
  homePens: number | null
  awayPens: number | null
  winnerSlot: number | null
}

export interface StandingRow {
  slot: number
  pj: number
  g: number
  e: number
  p: number
  gf: number
  gc: number
  dg: number
  pts: number
}

export interface TorneoData {
  torneo: { id: number; name: string; status: 'inscripcion' | 'en_juego' | 'finalizado'; startDay: string | null; totalPlayers: number } | null
  today?: string
  isOrganizer?: boolean
  nextMatch?: (TorneoPartido & { open: boolean; myFinished: boolean; myStarted: boolean }) | null
  podium?: { champion: number | null; runnerUp: number | null; third: number | null } | null
  canJoin?: boolean
  inscritos?: Array<{ memberId: number; name: string; countryCode: string; clan: string | null }>
  meInscrito?: boolean
  participantes?: TorneoParticipante[]
  drawOrder?: number[]
  drawSeen?: boolean
  mySlot?: number | null
  grupos?: Record<string, StandingRow[]>
  partidos?: TorneoPartido[]
}

// Bandera desde flagcdn (en Windows los emojis de bandera se ven como letras).
export function Flag({ code, className = '' }: { code: string; className?: string }) {
  if (!code) return <span className={`inline-flex items-center justify-center bg-white/10 text-[10px] aspect-[4/3] ${className}`}>🏳️</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`https://flagcdn.com/w160/${code}.png`} alt="" loading="lazy" className={`aspect-[4/3] object-cover ${className}`} />
}

// "2026-10-15" → "mié 15 oct"
export function formatDay(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
