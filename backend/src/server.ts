import 'dotenv/config'
import { app } from './app'
import { initializeDatabase } from './db'

const PORT = Number(process.env.PORT) || 4001

async function main() {
  await initializeDatabase()
  app.listen(PORT, () => {
    console.log(`Backend EXILIADOS corriendo en http://localhost:${PORT}`)
  })
}

main().catch((error) => {
  console.error('Error arrancando el backend:', error)
  process.exit(1)
})
