import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { initializeDatabase } from './db'
import authRouter from './routes/auth'
import battleReportsRouter from './routes/battleReports'
import clanMembersRouter from './routes/clanMembers'
import communityRouter from './routes/community'
import eventsRouter from './routes/events'
import membersRouter from './routes/members'
import rankingsRouter from './routes/rankings'
import reportAccessRouter from './routes/reportAccess'
import squadReportsRouter from './routes/squadReports'
import statsRouter from './routes/stats'
import warriorsRouter from './routes/warriors'

const PORT = Number(process.env.PORT) || 4001
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'

initializeDatabase()

const app = express()

app.use(cors({ origin: FRONTEND_URL, credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/battle-reports', battleReportsRouter)
app.use('/api/clan-members', clanMembersRouter)
app.use('/api/community', communityRouter)
app.use('/api/events', eventsRouter)
app.use('/api/members', membersRouter)
app.use('/api/rankings', rankingsRouter)
app.use('/api/report-access', reportAccessRouter)
app.use('/api/squad-reports', squadReportsRouter)
app.use('/api/stats', statsRouter)
app.use('/api/warriors', warriorsRouter)

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' })
})

app.listen(PORT, () => {
  console.log(`Backend EXILIADOS corriendo en http://localhost:${PORT}`)
})
