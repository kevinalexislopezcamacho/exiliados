import type { IncomingMessage, ServerResponse } from 'http'
import { app } from '../src/app'
import { initializeDatabase } from '../src/db'

// En serverless (Vercel) cada "cold start" es una instancia nueva. Esta
// promesa se memoiza en el scope del módulo para que, mientras la instancia
// siga caliente, initializeDatabase() (que corre las migraciones) se ejecute
// una sola vez y no en cada request.
let ready: Promise<void> | null = null
function ensureReady(): Promise<void> {
  if (!ready) ready = initializeDatabase()
  return ready
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureReady()
  app(req, res)
}
