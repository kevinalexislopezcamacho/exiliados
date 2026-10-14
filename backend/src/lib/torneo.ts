import type { Client } from '@libsql/client'
import { slugifyUsername } from '../db'
import { computeGeneralRanking } from './generalRanking'
import { dayKey, GameError, shiftDay, shuffle } from './minigameCore'

// Mundial Exiliados: 32 participantes, 8 grupos de 4 (pasan 2), octavos,
// cuartos, semis, tercer puesto y final. Cada partido tiene una ventana de 2
// días. Si se inscriben menos de 32, el resto son bots.

export const TOTAL_PLAYERS = 32
export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const POTS = 4
const MATCH_WINDOW_DAYS = 2

export type TorneoStatus = 'inscripcion' | 'en_juego' | 'finalizado'

export interface Torneo {
  id: number
  name: string
  status: TorneoStatus
  start_day: string | null
  draw_json: string | null
  created_by: string | null
}

export interface Participante {
  slot: number
  member_id: number | null
  name: string
  country_code: string
  clan: string | null
  seed_score: number
  pot: number
  group_letter: string
  group_pos: number
}

export interface Partido {
  id: number
  stage: Stage
  group_letter: string | null
  matchday: number | null
  bracket_pos: number | null
  home_slot: number | null
  away_slot: number | null
  home_label: string | null
  away_label: string | null
  opens_day: string
  closes_day: string
  status: 'pendiente' | 'jugado'
  home_goals: number | null
  away_goals: number | null
  home_pens: number | null
  away_pens: number | null
  winner_slot: number | null
}

export type Stage = 'G' | 'R16' | 'QF' | 'SF' | '3P' | 'F'

export const STAGE_LABELS: Record<Stage, string> = {
  G: 'Fase de grupos',
  R16: 'Octavos de final',
  QF: 'Cuartos de final',
  SF: 'Semifinales',
  '3P': 'Tercer puesto',
  F: 'Final',
}

// Bots que completan el cuadro: nombres de "leyenda" con su bandera.
const BOTS: Array<[string, string]> = [
  ['Bot Pibe de Oro', 'ar'], ['Bot Fenómeno', 'br'], ['Bot Káiser', 'de'], ['Bot Galáctico', 'es'],
  ['Bot Naranja Mecánica', 'nl'], ['Bot Catenaccio', 'it'], ['Bot Gallo', 'fr'], ['Bot Charrúa', 'uy'],
  ['Bot Azteca', 'mx'], ['Bot Cafetero', 'co'], ['Bot Samurái', 'jp'], ['Bot Tres Leones', 'gb-eng'],
  ['Bot Vikingo', 'no'], ['Bot Diablo Rojo', 'be'], ['Bot Vatreni', 'hr'], ['Bot Lusitano', 'pt'],
  ['Bot La Roja', 'cl'], ['Bot Guaraní', 'py'], ['Bot Inca', 'pe'], ['Bot Vinotinto', 've'],
  ['Bot León del Atlas', 'ma'], ['Bot Faraón', 'eg'], ['Bot Elefante', 'ci'], ['Bot Águila Verde', 'ng'],
  ['Bot Dinamita', 'dk'], ['Bot Tigre', 'kr'], ['Bot Canguro', 'au'], ['Bot Tricolor', 'ec'],
  ['Bot Celeste', 'sv'], ['Bot Ticos', 'cr'], ['Bot Yankee', 'us'], ['Bot Arce', 'ca'],
]

// Emparejamientos de grupo según la posición del bombo (1 a 4).
const GROUP_FIXTURES: Array<[number, Array<[number, number]>]> = [
  [1, [[1, 2], [3, 4]]],
  [2, [[1, 3], [4, 2]]],
  [3, [[4, 1], [2, 3]]],
]

// Cuadro de octavos, como en el Mundial: 1º de un grupo contra 2º del vecino.
const R16_PAIRS: Array<[string, string]> = [
  ['1A', '2B'], ['1C', '2D'], ['1E', '2F'], ['1G', '2H'],
  ['1B', '2A'], ['1D', '2C'], ['1F', '2E'], ['1H', '2G'],
]

export async function getCurrentTorneo(db: Client): Promise<Torneo | null> {
  return ((await db.execute('SELECT * FROM torneos ORDER BY id DESC LIMIT 1')).rows[0] as unknown as Torneo) ?? null
}

export async function createTorneo(db: Client, name: string, createdBy: string) {
  const current = await getCurrentTorneo(db)
  if (current && current.status !== 'finalizado') throw new GameError('Ya hay un torneo en curso')
  await db.execute({
    sql: `INSERT INTO torneos (name, status, created_by) VALUES (?, 'inscripcion', ?)`,
    args: [name.trim() || 'Mundial Exiliados', createdBy],
  })
}

// Borra el torneo con todo lo suyo (capitanes). Sirve para cancelarlo.
export async function deleteTorneo(db: Client, torneoId: number) {
  const t = (await db.execute({ sql: 'SELECT id FROM torneos WHERE id = ?', args: [torneoId] })).rows[0]
  if (!t) throw new GameError('El torneo no existe')
  await db.batch(
    [
      'torneo_sorteo_visto',
      'torneo_partidos',
      'torneo_participantes',
      'torneo_inscritos',
    ].map((table) => ({ sql: `DELETE FROM ${table} WHERE torneo_id = ?`, args: [torneoId] }))
      .concat([{ sql: 'DELETE FROM torneos WHERE id = ?', args: [torneoId] }]),
    'write'
  )
}

export async function setInscripcion(db: Client, torneo: Torneo, memberId: number, inscribir: boolean) {
  if (torneo.status !== 'inscripcion') throw new GameError('La inscripción ya está cerrada')
  if (inscribir) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO torneo_inscritos (torneo_id, member_id) VALUES (?, ?)',
      args: [torneo.id, memberId],
    })
  } else {
    await db.execute({ sql: 'DELETE FROM torneo_inscritos WHERE torneo_id = ? AND member_id = ?', args: [torneo.id, memberId] })
  }
}

// Datos de cada integrante (nombre del roster, bandera y clan).
async function memberInfo(db: Client, memberIds: number[]) {
  if (memberIds.length === 0) return new Map<number, { name: string; countryCode: string; clan: string | null }>()
  const rows = (
    await db.execute({
      sql: `SELECT m.id, m.full_name, m.username, m.clan as memberClan, cm.name as rosterName, cm.country_code, cm.clan
            FROM members m LEFT JOIN clan_members cm ON cm.member_id = m.id
            WHERE m.id IN (${memberIds.map(() => '?').join(', ')})`,
      args: memberIds,
    })
  ).rows as unknown as Array<{
    id: number
    full_name: string | null
    username: string
    memberClan: string | null
    rosterName: string | null
    country_code: string | null
    clan: string | null
  }>
  return new Map(
    rows.map((r) => [
      Number(r.id),
      {
        name: r.rosterName || r.full_name || r.username,
        countryCode: (r.country_code ?? '').toLowerCase(),
        clan: r.clan ?? r.memberClan ?? null,
      },
    ])
  )
}

export async function listInscritos(db: Client, torneoId: number) {
  const ids = (
    await db.execute({ sql: 'SELECT member_id FROM torneo_inscritos WHERE torneo_id = ? ORDER BY created_at ASC', args: [torneoId] })
  ).rows.map((r) => Number((r as unknown as { member_id: number }).member_id))
  const info = await memberInfo(db, ids)
  return ids.map((id) => ({ memberId: id, ...(info.get(id) ?? { name: '—', countryCode: '', clan: null }) }))
}

// Sorteo: se ordena a los inscritos por el ranking general, se completa con
// bots hasta 32, se arman 4 bombos de 8 y de cada bombo sale uno para cada
// grupo. El orden de salida queda guardado para repetir la animación.
export async function performDraw(db: Client, torneo: Torneo) {
  if (torneo.status !== 'inscripcion') throw new GameError('El sorteo ya se hizo')
  const inscritos = await listInscritos(db, torneo.id)
  if (inscritos.length < 2) throw new GameError('Hacen falta al menos 2 inscritos para hacer el sorteo')

  const ranking = await computeGeneralRanking(db)
  const scoreBySlug = new Map(ranking.map((e) => [slugifyUsername(e.name), e.score]))
  const humans = inscritos
    .map((p) => ({ ...p, seed: scoreBySlug.get(slugifyUsername(p.name)) ?? 0 }))
    .sort((a, b) => b.seed - a.seed || a.name.localeCompare(b.name))
    .slice(0, TOTAL_PLAYERS)

  const bots = shuffle(BOTS, Math.random)
    .slice(0, TOTAL_PLAYERS - humans.length)
    .map(([name, countryCode]) => ({ memberId: null as number | null, name, countryCode, clan: null as string | null, seed: -1 }))

  const seeded = [...humans, ...bots]
  const order: number[] = []
  const rows: Participante[] = []
  for (let pot = 1; pot <= POTS; pot++) {
    const potPlayers = shuffle(seeded.slice((pot - 1) * 8, pot * 8), Math.random)
    potPlayers.forEach((p, i) => {
      const slot = rows.length
      rows.push({
        slot,
        member_id: p.memberId,
        name: p.name,
        country_code: p.countryCode,
        clan: p.clan,
        seed_score: p.seed,
        pot,
        group_letter: GROUPS[i],
        group_pos: pot,
      })
      order.push(slot)
    })
  }

  // El torneo arranca al día siguiente del sorteo.
  const start = shiftDay(dayKey(), 1)
  const window = (offset: number) => ({ opens: shiftDay(start, offset), closes: shiftDay(start, offset + MATCH_WINDOW_DAYS - 1) })
  const slotOf = (group: string, pos: number) => rows.find((r) => r.group_letter === group && r.group_pos === pos)!.slot

  const statements: Array<{ sql: string; args: Array<string | number | null> }> = rows.map((r) => ({
    sql: `INSERT INTO torneo_participantes (torneo_id, slot, member_id, name, country_code, clan, seed_score, pot, group_letter, group_pos)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [torneo.id, r.slot, r.member_id, r.name, r.country_code, r.clan, r.seed_score, r.pot, r.group_letter, r.group_pos],
  }))

  const insertMatch = (m: {
    stage: Stage
    group?: string | null
    matchday?: number | null
    pos?: number | null
    home?: number | null
    away?: number | null
    homeLabel?: string | null
    awayLabel?: string | null
    offset: number
  }) => {
    const w = window(m.offset)
    statements.push({
      sql: `INSERT INTO torneo_partidos (torneo_id, stage, group_letter, matchday, bracket_pos, home_slot, away_slot, home_label, away_label, opens_day, closes_day)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        torneo.id, m.stage, m.group ?? null, m.matchday ?? null, m.pos ?? null, m.home ?? null, m.away ?? null,
        m.homeLabel ?? null, m.awayLabel ?? null, w.opens, w.closes,
      ],
    })
  }

  for (const [matchday, pairs] of GROUP_FIXTURES) {
    for (const group of GROUPS) {
      for (const [h, a] of pairs) {
        insertMatch({ stage: 'G', group, matchday, home: slotOf(group, h), away: slotOf(group, a), offset: (matchday - 1) * MATCH_WINDOW_DAYS })
      }
    }
  }
  R16_PAIRS.forEach(([h, a], pos) => insertMatch({ stage: 'R16', pos, homeLabel: h, awayLabel: a, offset: 6 }))
  for (let pos = 0; pos < 4; pos++) {
    insertMatch({ stage: 'QF', pos, homeLabel: `Ganador O${pos * 2 + 1}`, awayLabel: `Ganador O${pos * 2 + 2}`, offset: 8 })
  }
  insertMatch({ stage: 'SF', pos: 0, homeLabel: 'Ganador C1', awayLabel: 'Ganador C2', offset: 10 })
  insertMatch({ stage: 'SF', pos: 1, homeLabel: 'Ganador C3', awayLabel: 'Ganador C4', offset: 10 })
  insertMatch({ stage: '3P', pos: 0, homeLabel: 'Perdedor S1', awayLabel: 'Perdedor S2', offset: 12 })
  insertMatch({ stage: 'F', pos: 0, homeLabel: 'Ganador S1', awayLabel: 'Ganador S2', offset: 12 })

  statements.push({
    sql: `UPDATE torneos SET status = 'en_juego', start_day = ?, draw_json = ? WHERE id = ?`,
    args: [start, JSON.stringify(order), torneo.id],
  })
  await db.batch(statements, 'write')
}

export async function markDrawSeen(db: Client, torneoId: number, memberId: number) {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO torneo_sorteo_visto (torneo_id, member_id) VALUES (?, ?)',
    args: [torneoId, memberId],
  })
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

// Tabla de cada grupo: puntos, diferencia de gol, goles a favor y, como
// último desempate, el ranking con el que entró al sorteo.
export function computeStandings(participantes: Participante[], partidos: Partido[]) {
  const table = new Map<number, StandingRow>(
    participantes.map((p) => [p.slot, { slot: p.slot, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, dg: 0, pts: 0 }])
  )
  for (const m of partidos) {
    if (m.stage !== 'G' || m.status !== 'jugado' || m.home_slot === null || m.away_slot === null) continue
    const h = table.get(m.home_slot)!
    const a = table.get(m.away_slot)!
    const hg = Number(m.home_goals ?? 0)
    const ag = Number(m.away_goals ?? 0)
    h.pj++, a.pj++
    h.gf += hg, h.gc += ag, a.gf += ag, a.gc += hg
    if (hg > ag) (h.g++, a.p++, (h.pts += 3))
    else if (hg < ag) (a.g++, h.p++, (a.pts += 3))
    else (h.e++, a.e++, h.pts++, a.pts++)
  }
  for (const row of table.values()) row.dg = row.gf - row.gc

  const seedOf = new Map(participantes.map((p) => [p.slot, p.seed_score]))
  const groups: Record<string, StandingRow[]> = {}
  for (const g of GROUPS) {
    groups[g] = participantes
      .filter((p) => p.group_letter === g)
      .map((p) => table.get(p.slot)!)
      .sort((x, y) => y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || (seedOf.get(y.slot) ?? 0) - (seedOf.get(x.slot) ?? 0))
  }
  return groups
}
