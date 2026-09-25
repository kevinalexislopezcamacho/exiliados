import Database from 'better-sqlite3'
import path from 'path'
import crypto from 'crypto'

// DB_PATH permite apuntar a un volumen persistente (ej. en Railway) en vez del
// archivo local junto al código, que en un contenedor se pierde en cada deploy.
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data.db')

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

export function getDatabase(): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  return db
}

export function initializeDatabase() {
  const db = getDatabase()

  db.exec(`
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

  const memberColumns = db.prepare(`PRAGMA table_info(members)`).all() as Array<{ name: string }>
  if (!memberColumns.some((col) => col.name === 'has_password')) {
    db.exec(`ALTER TABLE members ADD COLUMN has_password INTEGER NOT NULL DEFAULT 1`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES members(id)
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS warriors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      rank TEXT NOT NULL,
      nationality TEXT NOT NULL,
      country_code TEXT NOT NULL,
      initial TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      icon TEXT NOT NULL,
      delay REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clan_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      clan TEXT NOT NULL,
      country_code TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    )
  `)

  const clanMemberColumns = db.prepare(`PRAGMA table_info(clan_members)`).all() as Array<{ name: string }>
  if (!clanMemberColumns.some((col) => col.name === 'title')) {
    db.exec(`ALTER TABLE clan_members ADD COLUMN title TEXT NOT NULL DEFAULT ''`)
  }
  if (!clanMemberColumns.some((col) => col.name === 'member_id')) {
    db.exec(`ALTER TABLE clan_members ADD COLUMN member_id INTEGER REFERENCES members(id)`)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS battle_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clan_member_id INTEGER NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('win', 'loss')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (clan_member_id) REFERENCES clan_members(id)
    )
  `)

  db.exec(`
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

  const battleReportColumns = db.prepare(`PRAGMA table_info(battle_reports)`).all() as Array<{ name: string }>
  if (!battleReportColumns.some((col) => col.name === 'slots_json')) {
    db.exec(`ALTER TABLE battle_reports ADD COLUMN slots_json TEXT NOT NULL DEFAULT '{}'`)
  }

  db.exec(`
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

  db.exec(`
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS member_report_access (
      member_id INTEGER PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (member_id) REFERENCES members(id)
    )
  `)

  const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get() as { count: number }
  if (memberCount.count === 0) {
    const insertMember = db.prepare(`
      INSERT INTO members (username, password, role, full_name, clan)
      VALUES (?, ?, ?, ?, ?)
    `)

    insertMember.run('rodo', hashPassword('exiliados123'), 'member', 'Rodo', 'rayo')
    insertMember.run('rojas', hashPassword('exiliados123'), 'member', 'Rojas', 'rayo')

    insertMember.run('exi', hashPassword('capis123'), 'captain', 'Exi Suaro Perez', 'exiliados')
    insertMember.run('chicolinas', hashPassword('capis123'), 'captain', 'Chicolinas', 'exiliados')
    insertMember.run('tomas', hashPassword('capis123'), 'captain', 'Tomás', 'exiliados')
    insertMember.run('cesar', hashPassword('capis123'), 'captain', 'Cesar', 'exiliados')
    insertMember.run('pepe', hashPassword('capis123'), 'captain', 'Pepe', 'exiliados')

    console.log('Miembros por defecto insertados')
  }

  const warriorCount = db.prepare('SELECT COUNT(*) as count FROM warriors').get() as { count: number }
  if (warriorCount.count === 0) {
    const insertWarrior = db.prepare(`
      INSERT INTO warriors (name, role, rank, nationality, country_code, initial)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    insertWarrior.run('Exi Suaro Perez', 'LÍDER', 'Campeón BHP', 'México', 'mx', 'E')
    insertWarrior.run('Chicolinas', 'CAPITÁN', 'Campeón BHP', 'México', 'mx', 'C')
    insertWarrior.run('Tomás', 'CAPITÁN', 'Campeón BHP', 'Argentina', 'ar', 'T')
    insertWarrior.run('Cesar', 'CAPITÁN', 'Campeón MH', 'Colombia', 'co', 'C')
    insertWarrior.run('Pepe', 'CAPITÁN', 'Campeón', 'México', 'mx', 'P')

    console.log('Guerreros por defecto insertados')
  }

  const statsCount = db.prepare('SELECT COUNT(*) as count FROM stats').get() as { count: number }
  if (statsCount.count === 0) {
    const insertStat = db.prepare(`
      INSERT INTO stats (value, label, icon, delay, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)

    insertStat.run('150+', 'Victorias', 'Trophy', 0, 0)
    insertStat.run('25', 'Guerreros', 'Users', 0.1, 1)
    insertStat.run('98%', 'Precisión', 'Target', 0.2, 2)
    insertStat.run('TOP 10', 'Ranking', 'Flame', 0.3, 3)

    console.log('Estadísticas por defecto insertadas')
  }

  const clanMemberCount = db.prepare('SELECT COUNT(*) as count FROM clan_members').get() as { count: number }
  if (clanMemberCount.count === 0) {
    const insertClanMember = db.prepare(`
      INSERT INTO clan_members (name, clan, country_code, title, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `)

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
    rayoRoster.forEach(([name, countryCode, title], index) => {
      insertClanMember.run(name, 'rayo', countryCode, title, index)
    })

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
    exiliadosRoster.forEach(([name, countryCode, title], index) => {
      insertClanMember.run(name, 'exiliados', countryCode, title, index)
    })

    // Chispa: roster de ejemplo, reemplazar con los nombres reales
    // desde la tabla `clan_members` cuando se tengan.
    for (let i = 1; i <= 4; i++) {
      insertClanMember.run(`Miembro Chispa ${i}`, 'chispa', '', '', i - 1)
    }

    console.log('Miembros de clanes por defecto insertados (Rayo/Exiliados con roster real, Chispa es placeholder)')
  }

  const eventCount = db.prepare('SELECT COUNT(*) as count FROM game_events').get() as { count: number }
  if (eventCount.count === 0) {
    const insertEvent = db.prepare(`
      INSERT INTO game_events (month_label, date_label, title, description, color, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

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

    septemberEvents.forEach(([dateLabel, title, description, color], index) => {
      insertEvent.run(MONTH, dateLabel, title, description, color, index)
    })

    console.log('Eventos del juego (Septiembre 2026) insertados por defecto')
  }

  syncRosterAccounts(db)
  linkRosterMemberIds(db)
  applyCaptainCorrections(db)

  db.close()
}

export const ROSTER_DEFAULT_PASSWORD = 'exiliados123'

export function slugifyUsername(name: string): string {
  // NFD separa cada letra acentuada en letra base + marca de acento; el
  // filtro final [^a-z0-9] descarta esa marca junto con espacios/símbolos.
  return name
    .normalize('NFD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Crea una cuenta de acceso (rol member, contraseña por defecto) para cada
// integrante del roster de Rayo/Exiliados que todavía no tenga una. Es
// idempotente: se ejecuta en cada arranque y solo crea lo que falte, sin
// tocar cuentas existentes (evita duplicar, ej. 'chicolinas' ya es capitán).
function syncRosterAccounts(db: Database.Database) {
  const roster = db
    .prepare(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados')`)
    .all() as Array<{ name: string; clan: string }>

  const existingUsernames = new Set(
    (db.prepare('SELECT LOWER(username) as u FROM members').all() as Array<{ u: string }>).map((r) => r.u)
  )

  const insertMember = db.prepare(`
    INSERT INTO members (username, password, role, full_name, clan, has_password)
    VALUES (?, ?, 'member', ?, ?, 0)
  `)
  const passwordHash = hashPassword(ROSTER_DEFAULT_PASSWORD)

  let created = 0
  for (const member of roster) {
    const username = slugifyUsername(member.name)
    if (!username || existingUsernames.has(username)) continue
    insertMember.run(username, passwordHash, member.name, member.clan)
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
function linkRosterMemberIds(db: Database.Database) {
  const unlinked = db
    .prepare(`SELECT id, name FROM clan_members WHERE member_id IS NULL AND clan IN ('rayo', 'exiliados')`)
    .all() as Array<{ id: number; name: string }>

  const findMember = db.prepare(`SELECT id FROM members WHERE username = ?`)
  const link = db.prepare(`UPDATE clan_members SET member_id = ? WHERE id = ?`)

  for (const row of unlinked) {
    const username = slugifyUsername(row.name)
    if (!username) continue
    const member = findMember.get(username) as { id: number } | undefined
    if (member) link.run(member.id, row.id)
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
function applyCaptainCorrections(db: Database.Database) {
  const captainHash = hashPassword(CAPTAIN_PASSWORD)
  const promote = db.prepare(`UPDATE members SET role = 'captain', password = ?, has_password = 1 WHERE username = ?`)
  for (const rosterName of CAPTAIN_ROSTER_NAMES) {
    const username = slugifyUsername(rosterName)
    promote.run(captainHash, username)
  }

  // Las sesiones tienen FK a members: hay que borrarlas antes que la cuenta.
  const deleteSessionsFor = db.prepare(`DELETE FROM sessions WHERE user_id IN (SELECT id FROM members WHERE username = ?)`)
  const deleteObsolete = db.prepare(`DELETE FROM members WHERE username = ?`)
  for (const username of OBSOLETE_CAPTAIN_USERNAMES) {
    deleteSessionsFor.run(username)
    deleteObsolete.run(username)
  }

  const rosterDefaultHash = hashPassword(ROSTER_DEFAULT_PASSWORD)
  db.prepare(
    `UPDATE members SET password = '', has_password = 0 WHERE role = 'member' AND password = ?`
  ).run(rosterDefaultHash)
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
