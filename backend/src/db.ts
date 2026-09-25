import { createClient, type Client } from '@libsql/client'
import crypto from 'crypto'

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

// Cliente de Turso (libSQL): a diferencia de better-sqlite3 no es un archivo
// local, es una conexión de red sin estado por request, así que se crea una
// sola vez y se reusa entre invocaciones (en Vercel, entre invocaciones
// "calientes" de la misma función serverless).
let client: Client | null = null

export function getDatabase(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return client
}

interface ColumnInfo {
  name: string
}

export async function initializeDatabase() {
  const db = getDatabase()

  await db.execute(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      full_name TEXT,
      clan TEXT,
      has_password INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const memberColumns = (await db.execute(`PRAGMA table_info(members)`)).rows as unknown as ColumnInfo[]
  if (!memberColumns.some((col) => col.name === 'has_password')) {
    await db.execute(`ALTER TABLE members ADD COLUMN has_password INTEGER NOT NULL DEFAULT 1`)
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES members(id)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS warriors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      rank TEXT NOT NULL,
      nationality TEXT NOT NULL,
      country_code TEXT NOT NULL,
      initial TEXT NOT NULL,
      image_url TEXT NOT NULL DEFAULT ''
    )
  `)

  const warriorColumns = (await db.execute(`PRAGMA table_info(warriors)`)).rows as unknown as ColumnInfo[]
  if (!warriorColumns.some((col) => col.name === 'image_url')) {
    await db.execute(`ALTER TABLE warriors ADD COLUMN image_url TEXT NOT NULL DEFAULT ''`)
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      delay REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS clan_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      clan TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)

  const clanMemberColumns = (await db.execute(`PRAGMA table_info(clan_members)`)).rows as unknown as ColumnInfo[]
  if (!clanMemberColumns.some((col) => col.name === 'title')) {
    await db.execute(`ALTER TABLE clan_members ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
  }
  if (!clanMemberColumns.some((col) => col.name === 'member_id')) {
    await db.execute(`ALTER TABLE clan_members ADD COLUMN member_id INTEGER REFERENCES members(id)`)
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS battle_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_member_id INTEGER NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clan_member_id) REFERENCES clan_members(id)
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS battle_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan TEXT NOT NULL,
      title TEXT NOT NULL,
      opponent TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      uploaded_by TEXT,
      summary_json TEXT NOT NULL,
      matches_json TEXT NOT NULL,
      slots_json TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const battleReportColumns = (await db.execute(`PRAGMA table_info(battle_reports)`)).rows as unknown as ColumnInfo[]
  if (!battleReportColumns.some((col) => col.name === 'slots_json')) {
    await db.execute(`ALTER TABLE battle_reports ADD COLUMN slots_json TEXT NOT NULL DEFAULT '{}'`)
  }
  // 'draft' = batalla creada sin Excel todavía, mientras se van cargando
  // partidos a mano; 'final' = ya tiene el Excel oficial (todos los reportes
  // viejos, subidos siempre por Excel, quedan 'final' con este default).
  if (!battleReportColumns.some((col) => col.name === 'status')) {
    await db.execute(`ALTER TABLE battle_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'final'`)
  }

  // Partidos que un integrante reporta a mano desde la página mientras una
  // batalla sigue en 'draft' (todavía no llega el Excel oficial). Al subir el
  // Excel de esa batalla, los que ya vienen ahí reemplazan a estos; los que
  // falten en el Excel se agregan como respaldo (ver matchSubmissions.ts).
  await db.execute(`
    CREATE TABLE IF NOT EXISTS battle_match_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      member_id INTEGER NOT NULL,
      manager TEXT NOT NULL,
      jornada INTEGER,
      condicion TEXT NOT NULL,
      rival TEXT NOT NULL DEFAULT '',
      gol_local INTEGER,
      gol_visita INTEGER,
      tiros_local INTEGER,
      tiros_visita INTEGER,
      posesion_local INTEGER,
      posesion_visita INTEGER,
      presion INTEGER,
      tactica_nuestra TEXT NOT NULL DEFAULT '',
      tactica_rival TEXT NOT NULL DEFAULT '',
      estilo_nuestro TEXT NOT NULL DEFAULT '',
      estilo_rival TEXT NOT NULL DEFAULT '',
      estilo_pct INTEGER,
      velocidad INTEGER,
      defensas TEXT NOT NULL DEFAULT '',
      medios TEXT NOT NULL DEFAULT '',
      delanteros TEXT NOT NULL DEFAULT '',
      campus INTEGER,
      conclusiones TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES battle_reports(id),
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `)

  const submissionColumns = (await db.execute(`PRAGMA table_info(battle_match_submissions)`))
    .rows as unknown as ColumnInfo[]
  const addSubmissionColumnIfMissing = async (name: string, ddl: string) => {
    if (!submissionColumns.some((col) => col.name === name)) {
      await db.execute(`ALTER TABLE battle_match_submissions ADD COLUMN ${ddl}`)
    }
  }
  await addSubmissionColumnIfMissing('presion', 'presion INTEGER')
  await addSubmissionColumnIfMissing('tactica_nuestra', "tactica_nuestra TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('tactica_rival', "tactica_rival TEXT NOT NULL DEFAULT ''")
  // 'estilo' (vieja, sin usar) queda huérfana si existe de una versión anterior;
  // el dato real de estilo ahora se separa en elección (nuestro/rival) y % (PORCENTAJES).
  await addSubmissionColumnIfMissing('estilo_nuestro', "estilo_nuestro TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('estilo_rival', "estilo_rival TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('estilo_pct', 'estilo_pct INTEGER')
  await addSubmissionColumnIfMissing('velocidad', 'velocidad INTEGER')
  await addSubmissionColumnIfMissing('defensas', "defensas TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('medios', "medios TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('delanteros', "delanteros TEXT NOT NULL DEFAULT ''")
  await addSubmissionColumnIfMissing('campus', 'campus INTEGER')

  await db.execute(`
    CREATE TABLE IF NOT EXISTS squad_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan TEXT NOT NULL,
      title TEXT NOT NULL,
      opponent TEXT NOT NULL DEFAULT '',
      file_name TEXT NOT NULL,
      sheet_name TEXT NOT NULL,
      uploaded_by TEXT,
      summary_json TEXT NOT NULL,
      teams_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_label TEXT NOT NULL,
      date_label TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT 'primary',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Acceso a reportes por integrante (no por clan): solo chicolinas puede
  // prender/apagar el acceso de cada persona individualmente. La ausencia de
  // fila (o enabled=0) significa bloqueado.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS member_report_access (
      member_id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `)

  const memberCount = (await db.execute('SELECT COUNT(*) as count FROM members')).rows[0] as unknown as {
    count: number
  }
  if (memberCount.count === 0) {
    const insertMember = (username: string, password: string, role: string, fullName: string, clan: string) =>
      db.execute({
        sql: `INSERT INTO members (username, password, role, full_name, clan) VALUES (?, ?, ?, ?, ?)`,
        args: [username, password, role, fullName, clan],
      })

    await insertMember('rodo', hashPassword('exiliados123'), 'member', 'Rodo', 'rayo')
    await insertMember('rojas', hashPassword('exiliados123'), 'member', 'Rojas', 'rayo')

    await insertMember('exi', hashPassword('capis123'), 'captain', 'Exi Suaro Perez', 'exiliados')
    await insertMember('chicolinas', hashPassword('capis123'), 'captain', 'Chicolinas', 'exiliados')
    await insertMember('tomas', hashPassword('capis123'), 'captain', 'Tomás', 'exiliados')
    await insertMember('cesar', hashPassword('capis123'), 'captain', 'Cesar', 'exiliados')
    await insertMember('pepe', hashPassword('capis123'), 'captain', 'Pepe', 'exiliados')

    console.log('Miembros por defecto insertados')
  }

  const warriorCount = (await db.execute('SELECT COUNT(*) as count FROM warriors')).rows[0] as unknown as {
    count: number
  }
  if (warriorCount.count === 0) {
    const insertWarrior = (
      name: string,
      role: string,
      rank: string,
      nationality: string,
      countryCode: string,
      initial: string
    ) =>
      db.execute({
        sql: `INSERT INTO warriors (name, role, rank, nationality, country_code, initial) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [name, role, rank, nationality, countryCode, initial],
      })

    await insertWarrior('Exi Suaro Perez', 'LÍDER', 'Campeón BHP', 'México', 'mx', 'E')
    await insertWarrior('Chicolinas', 'CAPITÁN', 'Campeón BHP', 'México', 'mx', 'C')
    await insertWarrior('Tomás', 'CAPITÁN', 'Campeón BHP', 'Argentina', 'ar', 'T')
    await insertWarrior('Cesar', 'CAPITÁN', 'Campeón MH', 'Colombia', 'co', 'C')
    await insertWarrior('Pepe', 'CAPITÁN', 'Campeón', 'México', 'mx', 'P')

    console.log('Guerreros por defecto insertados')
  }

  const statsCount = (await db.execute('SELECT COUNT(*) as count FROM stats')).rows[0] as unknown as {
    count: number
  }
  if (statsCount.count === 0) {
    const insertStat = (value: string, label: string, icon: string, delay: number, sortOrder: number) =>
      db.execute({
        sql: `INSERT INTO stats (value, label, icon, delay, sort_order) VALUES (?, ?, ?, ?, ?)`,
        args: [value, label, icon, delay, sortOrder],
      })

    await insertStat('150+', 'Victorias', 'Trophy', 0, 0)
    await insertStat('25', 'Guerreros', 'Users', 0.1, 1)
    await insertStat('98%', 'Precisión', 'Target', 0.2, 2)
    await insertStat('TOP 10', 'Ranking', 'Flame', 0.3, 3)

    console.log('Estadísticas por defecto insertadas')
  }

  const clanMemberCount = (await db.execute('SELECT COUNT(*) as count FROM clan_members')).rows[0] as unknown as {
    count: number
  }
  if (clanMemberCount.count === 0) {
    const insertClanMember = (name: string, clan: string, countryCode: string, title: string, sortOrder: number) =>
      db.execute({
        sql: `INSERT INTO clan_members (name, clan, country_code, title, sort_order) VALUES (?, ?, ?, ?, ?)`,
        args: [name, clan, countryCode, title, sortOrder],
      })

    // Rayo: roster real (24 integrantes)
    const rayoRoster: Array<[string, string, string]> = [
      ['Oribe Peralta 13', 'mx', ''],
      ['Pepe Loera', 'mx', 'Capitán · Ex sub 21'],
      ['César Banda', 'mx', ''],
      ['Os El Piojo Herrera 22', 'mx', ''],
      ['EXI Junier', 've', 'Ex sub 21'],
      ['delRioCesar11', 'mx', 'Ex seleccionado mayor'],
      ['AJ Rojas', 'mx', ''],
      ['Erick Jordan', 'ec', 'Sub 21'],
      ['lobo1985', 've', ''],
      ['EXI César_24_5变', 'mx', 'Capitán · Ex sub 21'],
      ['diego reyes_37', 'mx', 'Ex sub 21'],
      ['Anibal Abendaño', 'ec', 'Seleccionado mayor'],
      ['ElAve8', 'co', 'Sub 21'],
      ['JoseEch8678', 'co', 'Sub 21'],
      ['LaBrujaDelCuento', 'co', ''],
      ['JotaEmeGaymer', 'mx', ''],
      ['IshowFideo', 'ar', ''],
      ['PEELUKlI', 'es', ''],
      ['Andrews 21', 've', ''],
      ['chicolinas', 'co', 'Seleccionado mayor'],
      ['nandorocola1891', 'uy', ''],
      ['hernancho_1', 'pa', 'Sub 21'],
      ['yariel56_8', 'pa', ''],
      ['Mr Germansinho', 'pa', 'Sub 21'],
      ['Muzan_Kibutsuji07', 'mx', ''],
    ]
    let rayoIndex = 0
    for (const [name, countryCode, title] of rayoRoster) {
      await insertClanMember(name, 'rayo', countryCode, title, rayoIndex)
      rayoIndex += 1
    }

    // Exiliados: roster real (18 integrantes)
    const exiliadosRoster: Array<[string, string, string]> = [
      ['EXI Tecatito Morgado', 'mx', ''],
      ['alejandro 22_11', 'mx', 'Sub 21'],
      ['laury ruiz', 'ar', ''],
      ['tomi castro_4', 'ar', 'Ex sub 21'],
      ['suazoperez', 'mx', 'Selección mayor'],
      ['Reinaldo F.', 've', 'Sub 21'],
      ['Mr Zayas', 'cu', 'Seleccionador'],
      ['OscarWaldo', 'bo', 'Seleccionado mayor'],
      ['Rober Jiménez 16', 'mx', 'Sub 21'],
      ['phathox', 'mx', 'Sub 21'],
      ['oscarjgm 1414', 'co', 'Seleccionado mayor'],
      ['MickeSeki', 'pe', 'Seleccionado mayor'],
      ['Mathiss_07', 'co', 'Seleccionado mayor'],
      ['Alex Makhachev', 'co', 'Seleccionado mayor'],
      ['tirillas', 'es', 'Ex seleccionado mayor'],
      ['EXI Santos 11', 'cu', 'Seleccionado mayor'],
      ['eldelanterodelgine', 'es', 'Ex seleccionado mayor'],
      ['yari06', 'pa', 'Seleccionado mayor'],
    ]
    let exIndex = 0
    for (const [name, countryCode, title] of exiliadosRoster) {
      await insertClanMember(name, 'exiliados', countryCode, title, exIndex)
      exIndex += 1
    }

    console.log('Miembros de clanes por defecto insertados (Rayo/Exiliados con roster real)')
  }

  const eventCount = (await db.execute('SELECT COUNT(*) as count FROM game_events')).rows[0] as unknown as {
    count: number
  }
  if (eventCount.count === 0) {
    const insertEvent = (
      monthLabel: string,
      dateLabel: string,
      title: string,
      description: string,
      color: string,
      sortOrder: number
    ) =>
      db.execute({
        sql: `INSERT INTO game_events (month_label, date_label, title, description, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        args: [monthLabel, dateLabel, title, description, color, sortOrder],
      })

    const MONTH = 'Septiembre 2026'
    const septemberEvents: Array<[string, string, string, string]> = [
      [
        '02 de septiembre',
        'Entrenador Súper Rápido',
        'Tiempos de entrenamiento más cortos: 2h con entrenadores normales y 1h con Entrenador Universal.',
        'purple',
      ],
      [
        '03 de septiembre',
        'Evento "All Out"',
        'Mayor progreso de entrenamiento al recoger resultados de cada entrenamiento y partido amistoso. Ojeador más rápido (2h en vez de 16h). Hasta 6 jugadores en la lista de transferencias. Mejoras del estadio: 2h. Entrenadores más rápidos: 4h normales y 3h el Universal.',
        'blue',
      ],
      [
        '05-06 de septiembre',
        'Talentos en Entrenamiento',
        'Aún más progreso al recoger resultados para jugadores jóvenes (hasta 24 años). Entrenamientos más rápidos: 2h normales y 1h30 el Entrenador Universal.',
        'green',
      ],
      [
        '09 de septiembre',
        'Ojeador Extraordinario',
        'Ojeador: 2h en vez de 16h. Los jugadores encontrados por el ojeador serán más baratos.',
        'amber',
      ],
      [
        '12-13 de septiembre',
        'Golden Oldies x Legends',
        'Mayor progreso de entrenamiento para jugadores veteranos al recoger resultados. Entrenamientos más rápidos: 2h normales y 1h30 el Universal. Se añadirán jugadores Leyenda a la lista de transferencias.',
        'red',
      ],
      [
        '16 de septiembre',
        'Instalaciones de Primera',
        'Menor tiempo para mejorar el estadio: 4h. Entrenamientos: 4h normales y 3h el Entrenador Universal.',
        'teal',
      ],
      [
        '19-20 de septiembre',
        'Amistosos Intensos',
        'Progreso de entrenamiento adicional con cada partido amistoso.',
        'purple',
      ],
      [
        '23 de septiembre',
        'Ojeador de Gangas',
        'Los jugadores encontrados por el ojeador serán más baratos. Ojeador más rápido: 2h en vez de 16h.',
        'amber',
      ],
      [
        '26 de septiembre',
        'Evento "All Out"',
        'Mayor progreso de entrenamiento al recoger resultados de cada entrenamiento y partido amistoso. Ojeador más rápido (2h en vez de 16h). Hasta 6 jugadores en la lista de transferencias. Mejoras del estadio: 2h. Entrenadores más rápidos: 4h normales y 3h el Universal.',
        'blue',
      ],
      [
        '26-27 de septiembre',
        'Leyendas',
        'Se añadirán jugadores Leyenda a la lista de transferencias.',
        'green',
      ],
      [
        '30 de septiembre',
        'Entrenamiento Extremo',
        'Progreso de entrenamiento extremo al recoger resultados de cada entrenamiento y partido amistoso. Entrenamientos más rápidos: 3h normales y 2h el Entrenador Universal.',
        'red',
      ],
    ]

    let evIndex = 0
    for (const [dateLabel, title, description, color] of septemberEvents) {
      await insertEvent(MONTH, dateLabel, title, description, color, evIndex)
      evIndex += 1
    }

    console.log('Eventos del juego (Septiembre 2026) insertados por defecto')
  }

  await syncRosterAccounts(db)
  await linkRosterMemberIds(db)
  await applyCaptainCorrections(db)
}

export const ROSTER_DEFAULT_PASSWORD = 'exiliados123'

export function slugifyUsername(name: string): string {
  // NFD separa cada letra acentuada en letra base + marca de acento; el
  // filtro final [^a-z0-9] descarta esa marca junto con espacios/símbolos.
  const latinized = name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

  if (latinized) return latinized

  // Nombres sin ningún carácter latino/dígito (ej. completamente en japonés
  // o coreano, como "お父ちゃん") quedarían vacíos con el filtro de arriba,
  // lo que impedía crear o guardar la cuenta. En ese caso se conserva
  // cualquier letra o número del idioma que sea (\p{L}/\p{N} cubren
  // cualquier alfabeto), quitando solo espacios y símbolos.
  return name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

// Crea una cuenta de acceso (rol member, contraseña por defecto) para cada
// integrante del roster de Rayo/Exiliados que todavía no tenga una. Es
// idempotente: se ejecuta en cada arranque y solo crea lo que falte, sin
// tocar cuentas existentes (evita duplicar, ej. 'chicolinas' ya es capitán).
async function syncRosterAccounts(db: Client) {
  const roster = (await db.execute(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados')`))
    .rows as unknown as Array<{ name: string; clan: string }>

  const existingUsernames = new Set(
    ((await db.execute('SELECT LOWER(username) as u FROM members')).rows as unknown as Array<{ u: string }>).map(
      (r) => r.u
    )
  )

  const passwordHash = hashPassword(ROSTER_DEFAULT_PASSWORD)

  let created = 0
  for (const member of roster) {
    const username = slugifyUsername(member.name)
    if (!username || existingUsernames.has(username)) continue
    await db.execute({
      sql: `INSERT INTO members (username, password, role, full_name, clan, has_password) VALUES (?, ?, 'member', ?, ?, 0)`,
      args: [username, passwordHash, member.name, member.clan],
    })
    existingUsernames.add(username)
    created += 1
  }

  if (created > 0) {
    console.log(`Cuentas de acceso generadas para el roster: ${created} (inician sesión solo con su usuario y crean su contraseña la primera vez)`)
  }
}

// Vincula clan_members.member_id con su cuenta de members ya existente. Cubre
// tanto las cuentas recién creadas arriba como las que ya existían antes de
// que existiera esta columna. Idempotente: solo completa los que falten.
async function linkRosterMemberIds(db: Client) {
  const unlinked = (
    await db.execute(`SELECT id, name FROM clan_members WHERE member_id IS NULL AND clan IN ('rayo', 'exiliados')`)
  ).rows as unknown as Array<{ id: number; name: string }>

  for (const row of unlinked) {
    const username = slugifyUsername(row.name)
    if (!username) continue
    const member = (await db.execute({ sql: `SELECT id FROM members WHERE username = ?`, args: [username] }))
      .rows[0] as unknown as { id: number } | undefined
    if (member) {
      await db.execute({ sql: `UPDATE clan_members SET member_id = ? WHERE id = ?`, args: [member.id, row.id] })
    }
  }
}

const CAPTAIN_PASSWORD = 'capis123'
// Nombres EXACTOS del roster (tabla clan_members) que deben ser capitanes del
// sitio. 'chicolinas' ya es capitán desde el seed original, no hace falta acá.
const CAPTAIN_ROSTER_NAMES = ['suazoperez', 'Pepe Loera', 'EXI César_24_5变', 'tomi castro_4']
// Cuentas placeholder del seed original que quedaron duplicadas una vez que
// las cuentas reales (arriba) se promovieron a capitán.
const OBSOLETE_CAPTAIN_USERNAMES = ['exi', 'tomas', 'cesar', 'pepe']

// Promueve a capitán las cuentas reales del roster, borra los placeholders
// viejos que duplicaban a esas mismas personas, y pasa a "sin contraseña" a
// cualquier cuenta de miembro que siga con la contraseña compartida por
// defecto (para que la reclamen ellos mismos la primera vez que inicien
// sesión). Idempotente: seguro de correr en cada arranque.
async function applyCaptainCorrections(db: Client) {
  const captainHash = hashPassword(CAPTAIN_PASSWORD)
  for (const rosterName of CAPTAIN_ROSTER_NAMES) {
    const username = slugifyUsername(rosterName)
    await db.execute({
      sql: `UPDATE members SET role = 'captain', password = ?, has_password = 1 WHERE username = ?`,
      args: [captainHash, username],
    })
  }

  // Las sesiones tienen FK a members: hay que borrarlas antes que la cuenta.
  for (const username of OBSOLETE_CAPTAIN_USERNAMES) {
    await db.execute({
      sql: `DELETE FROM sessions WHERE user_id IN (SELECT id FROM members WHERE username = ?)`,
      args: [username],
    })
    await db.execute({ sql: `DELETE FROM members WHERE username = ?`, args: [username] })
  }

  const rosterDefaultHash = hashPassword(ROSTER_DEFAULT_PASSWORD)
  await db.execute({
    sql: `UPDATE members SET password = '', has_password = 0 WHERE role = 'member' AND password = ?`,
    args: [rosterDefaultHash],
  })
}

const FLAG_MAP: Record<string, string> = {
  mx: '🇲🇽',
  ve: '🇻🇪',
  co: '🇨🇴',
  us: '🇺🇸',
  es: '🇪🇸',
  ar: '🇦🇷',
  cl: '🇨🇱',
  pe: '🇵🇪',
  br: '🇧🇷',
  ec: '🇪🇨',
  bo: '🇧🇴',
  cu: '🇨🇺',
  pa: '🇵🇦',
  uy: '🇺🇾',
}

export function getCountryFlag(countryCode: string): string {
  return FLAG_MAP[countryCode.toLowerCase()] || '🌍'
}
