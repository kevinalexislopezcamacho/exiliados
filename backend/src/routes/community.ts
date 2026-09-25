import { Router } from 'express'
import { getCountryFlag, getDatabase } from '../db'

const router = Router()

const CLANS = ['exiliados', 'rayo'] as const

// GET /api/community - Miembros del clan agrupados por sub-clan (Exiliados / Rayo)
router.get('/', async (_req, res) => {
  try {
    const db = getDatabase()
    const rows = (
      await db.execute(`
      SELECT id, name, clan, country_code as countryCode, title
      FROM clan_members
      ORDER BY clan ASC, sort_order ASC
    `)
    ).rows as unknown as Array<{ id: number; name: string; clan: string; countryCode: string; title: string }>

    const data: Record<string, Array<{ id: number; name: string; flag: string; title: string }>> = {
      exiliados: [],
      rayo: [],
    }

    for (const row of rows) {
      if (!CLANS.includes(row.clan as (typeof CLANS)[number])) continue
      data[row.clan].push({
        id: row.id,
        name: row.name,
        flag: row.countryCode ? getCountryFlag(row.countryCode) : '',
        title: row.title ?? '',
      })
    }

    res.json({
      success: true,
      data,
      count: rows.length,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Error fetching community members' })
  }
})

export default router
