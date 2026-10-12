import { Router } from 'express'
import { getCountryFlag, getDatabase, slugifyUsername } from '../db'

const router = Router()

// GET /api/warriors - Obtener lista de guerreros/líderes del clan
router.get('/', async (_req, res) => {
  try {
    const db = getDatabase()
    const warriors = (
      await db.execute(`
      SELECT id, name, role, rank, nationality, country_code as countryCode, initial, image_url as imageUrl,
             card_url as cardUrl
      FROM warriors
      ORDER BY id ASC
    `)
    ).rows as unknown as Array<{
      id: number
      name: string
      role: string
      rank: string
      nationality: string
      countryCode: string
      initial: string
      imageUrl: string
      cardUrl: string
    }>

    // Clan de cada guerrero según el roster, para poder abrir su perfil
    // (notas) al hacer clic.
    const roster = (await db.execute(`SELECT name, clan FROM clan_members WHERE clan IN ('rayo', 'exiliados')`))
      .rows as unknown as Array<{ name: string; clan: string }>
    const clanBySlug = new Map(roster.map((r) => [slugifyUsername(r.name), r.clan]))

    const warriorsWithFlags = warriors.map((warrior) => ({
      ...warrior,
      flag: getCountryFlag(warrior.countryCode),
      clan: clanBySlug.get(slugifyUsername(warrior.name)) ?? null,
    }))

    res.json({ success: true, data: warriorsWithFlags, count: warriorsWithFlags.length })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching warriors' })
  }
})

export default router
