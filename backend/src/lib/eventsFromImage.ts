// Lee con IA (Claude, visión) la imagen del calendario mensual de eventos de OSM
// y devuelve los eventos ya estructurados. Solo funciona si el servidor tiene
// ANTHROPIC_API_KEY; sin la clave, la imagen igual se guarda y se muestra.

export const EVENT_COLORS = ['purple', 'blue', 'green', 'amber', 'red', 'teal'] as const

export interface ParsedEvent {
  dateLabel: string
  title: string
  description: string
  color: string
}

export interface ParsedCalendar {
  monthLabel: string
  events: ParsedEvent[]
}

export class EventsImageError extends Error {
  constructor(message: string, public status = 400) {
    super(message)
  }
}

export const aiAvailable = () => !!process.env.ANTHROPIC_API_KEY

const PROMPT = `Esta imagen es el calendario mensual de eventos del juego Online Soccer Manager (OSM). Extrae TODOS los eventos de la imagen, en el mismo orden en que aparecen, sin inventar ni omitir ninguno.

Responde SOLO con un JSON válido (sin texto antes ni después, sin bloques de código) con esta forma:
{"monthLabel": "Noviembre 2026", "events": [{"dateLabel": "04 de noviembre", "title": "Estadio Relámpago", "description": "Primera viñeta.\\nSegunda viñeta.", "color": "purple"}]}

Reglas:
- monthLabel: mes y año del título de la imagen, con la primera letra en mayúscula (ej. "Noviembre 2026").
- dateLabel: la fecha como aparece, en formato "04 de noviembre" o "07-08 de noviembre" (día con dos dígitos).
- title: el nombre del evento tal cual, con mayúsculas y minúsculas normales (no todo en mayúsculas).
- description: cada viñeta del evento como una línea, separadas por \\n, sin el símbolo de viñeta, copiando el texto exacto (cifras y horas incluidas).
- color: el color del recuadro de la fecha, uno de: purple, blue, green, amber, red, teal. Si no coincide ninguno, elige el más parecido.
- No incluyas la nota al pie ("Este calendario está sujeto a cambios").`

function clean(s: unknown, max: number) {
  return typeof s === 'string' ? s.replace(/\r/g, '').trim().slice(0, max) : ''
}

export function parseCalendarJson(text: string): ParsedCalendar {
  const body = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) throw new EventsImageError('La IA no devolvió datos legibles', 502)
  let raw: any
  try {
    raw = JSON.parse(body.slice(start, end + 1))
  } catch {
    throw new EventsImageError('La IA devolvió un JSON inválido', 502)
  }
  const monthLabel = clean(raw?.monthLabel, 40)
  const list = Array.isArray(raw?.events) ? raw.events : []
  const events: ParsedEvent[] = []
  list.forEach((e: any, i: number) => {
    const title = clean(e?.title, 120)
    const dateLabel = clean(e?.dateLabel, 60)
    if (!title || !dateLabel) return
    const color = EVENT_COLORS.includes(e?.color) ? e.color : EVENT_COLORS[i % EVENT_COLORS.length]
    events.push({ dateLabel, title, description: clean(e?.description, 1200), color })
  })
  if (!monthLabel) throw new EventsImageError('No se pudo leer el mes de la imagen', 422)
  if (events.length === 0) throw new EventsImageError('No se encontraron eventos en la imagen', 422)
  return { monthLabel, events }
}

export async function extractEventsFromImage(imageBase64: string, mediaType: string): Promise<ParsedCalendar> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new EventsImageError('La lectura automática no está activada (falta ANTHROPIC_API_KEY en el servidor).', 503)
  const base = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '')
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5'

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  let res: Response
  try {
    res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    })
  } catch (error: any) {
    throw new EventsImageError(error?.name === 'AbortError' ? 'La IA tardó demasiado en responder' : 'No se pudo contactar a la IA', 504)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new EventsImageError(`La IA respondió con error (${res.status})`, 502)
  const data: any = await res.json()
  const text = Array.isArray(data?.content) ? data.content.filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('') : ''
  return parseCalendarJson(text)
}
