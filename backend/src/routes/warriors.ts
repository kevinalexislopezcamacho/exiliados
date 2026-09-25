import { Router } from 'express'
import { getCountryFlag, getDatabase } from '../db'

const router = Router()

// GET /api/warriors - Obtener lista de guerreros/líderes del clan
router.get('/', async (_req, res) => {
  try {
    const db = getDatabase()
    const warriors = (
      await db.execute(`
      SELECT id, name, role, rank, nationality, country_code as countryCode, initial, image_url as imageUrl
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
    }>

    const warriorsWithFlags = warriors.map((warrior) => ({
      ...warrior,
      flag: getCountryFlag(warrior.countryCode),
    }))

    res.json({ success: true, data: warriorsWithFlags, count: warriorsWithFlags.length })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching warriors' })
  }
})

export default router
