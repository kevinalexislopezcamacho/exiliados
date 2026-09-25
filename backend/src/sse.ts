import { Response } from 'express'

const clients = new Set<Response>()

export function addClient(res: Response) {
  clients.add(res)
}

export function removeClient(res: Response) {
  clients.delete(res)
}

export function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of clients) {
    client.write(payload)
  }
}
