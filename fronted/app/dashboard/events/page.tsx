'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Calendar, Edit2, ImageUp, Loader2, Plus, Trash, X } from 'lucide-react'

// Reduce la foto antes de subirla (Vercel limita el tamaño de la petición).
async function shrinkImage(file: File, maxWidth = 1400): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxWidth / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85))
}

interface GameEvent {
  id: number
  monthLabel: string
  dateLabel: string
  title: string
  description: string
  color: string
}

const COLOR_CLASSES: Record<string, string> = {
  purple: 'border-l-purple-500',
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500',
  teal: 'border-l-teal-500',
  primary: 'border-l-primary',
}

const COLOR_OPTIONS = ['primary', 'purple', 'blue', 'green', 'amber', 'red', 'teal']

const emptyForm = { monthLabel: '', dateLabel: '', title: '', description: '', color: 'primary' }

export default function GameEventsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [events, setEvents] = useState<GameEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [banner, setBanner] = useState<{ monthLabel: string; imageUrl: string } | null>(null)
  const [aiAvailable, setAiAvailable] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  const fetchBanner = () => {
    fetch('/api/events/banner')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setBanner(result.data)
          setAiAvailable(!!result.aiAvailable)
        }
      })
      .catch(() => {})
  }

  // Sube la foto del mes (reemplaza la anterior) y, si la lectura automática está
  // activada, deja los eventos nuevos y borra los viejos.
  const handleImage = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setNotice('')
    if (!confirm('Se reemplazará la imagen anterior y, si es posible, los eventos viejos se borrarán y quedarán los de la nueva imagen. ¿Seguir?')) {
      if (fileInput.current) fileInput.current.value = ''
      return
    }
    setUploading(true)
    try {
      const blob = await shrinkImage(file)
      const body = new FormData()
      body.append('image', blob, 'calendario.jpg')
      const up = await (await fetch('/api/events/image', { method: 'POST', body })).json()
      if (!up.success) throw new Error(up.error || 'No se pudo subir la imagen')
      fetchBanner()

      const imp = await (await fetch('/api/events/import-image', { method: 'POST' })).json()
      if (imp.success) {
        setNotice(`Listo: se cargaron ${imp.data.count} eventos de ${imp.data.monthLabel} y se borraron los anteriores.`)
        fetchEvents()
      } else {
        setNotice(`La imagen se guardó, pero los eventos no se actualizaron solos: ${imp.error}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo la imagen')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const fetchEvents = () => {
    setLoadingEvents(true)
    fetch('/api/events')
      .then((res) => res.json())
      .then((result) => {
        if (result.success) setEvents(result.data)
      })
      .catch(() => setError('Error cargando los eventos'))
      .finally(() => setLoadingEvents(false))
  }

  useEffect(() => {
    if (user) {
      fetchEvents()
      fetchBanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const isCaptain = user?.role === 'captain'

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.monthLabel || !form.dateLabel || !form.title) {
      setError('Mes, fecha y título son requeridos')
      return
    }

    try {
      const url = editingId ? `/api/events/${editingId}` : '/api/events'
      const method = editingId ? 'PUT' : 'POST'
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      resetForm()
      setShowForm(false)
      fetchEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando el evento')
    }
  }

  const handleEdit = (event: GameEvent) => {
    setForm({
      monthLabel: event.monthLabel,
      dateLabel: event.dateLabel,
      title: event.title,
      description: event.description,
      color: event.color,
    })
    setEditingId(event.id)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este evento?')) return
    try {
      const response = await fetch(`/api/events/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setEvents((prev) => prev.filter((ev) => ev.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando el evento')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const grouped = events.reduce<Record<string, GameEvent[]>>((acc, ev) => {
    acc[ev.monthLabel] = acc[ev.monthLabel] ?? []
    acc[ev.monthLabel].push(ev)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary">Eventos del Juego</h1>
              <p className="text-sm text-muted-foreground">Calendario mensual de eventos de OSM</p>
            </div>
          </div>

          {isCaptain && (
            <div className="flex flex-wrap gap-2">
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
              <Button variant="outline" className="gap-2" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageUp className="w-4 h-4" />}
                {uploading ? 'Subiendo...' : 'Subir imagen del mes'}
              </Button>
              <Button
                onClick={() => {
                  resetForm()
                  setShowForm((s) => !s)
                }}
                className="gap-2"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancelar' : 'Nuevo evento'}
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6 max-w-3xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {notice && (
          <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-sm">{notice}</div>
        )}

        {isCaptain && !aiAvailable && (
          <p className="text-xs text-muted-foreground">
            Nota: la lectura automática de la imagen aún no está activada en el servidor, así que al subir la foto solo se guarda y se muestra; los eventos se cargan aparte.
          </p>
        )}

        {banner?.imageUrl && (
          <a href={banner.imageUrl} target="_blank" rel="noreferrer" className="block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.imageUrl}
              alt={`Calendario oficial de eventos ${banner.monthLabel}`}
              className="w-full max-w-md mx-auto rounded-xl border border-border/50 shadow-lg"
            />
            <p className="text-center text-xs text-muted-foreground mt-2">Toca la imagen para verla completa</p>
          </a>
        )}

        {isCaptain && showForm && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 text-primary">{editingId ? 'Editar evento' : 'Nuevo evento'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Mes</label>
                  <Input
                    value={form.monthLabel}
                    onChange={(e) => setForm({ ...form, monthLabel: e.target.value })}
                    placeholder="Ej. Octubre 2026"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Fecha</label>
                  <Input
                    value={form.dateLabel}
                    onChange={(e) => setForm({ ...form, dateLabel: e.target.value })}
                    placeholder="Ej. 05-06 de octubre"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Título</label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ej. Evento All Out" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background text-sm min-h-24"
                  placeholder="Detalles del evento"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <select
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  {COLOR_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <Button type="submit">{editingId ? 'Guardar cambios' : 'Crear evento'}</Button>
            </form>
          </Card>
        )}

        {loadingEvents ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Calendar className="w-8 h-8" />
            <p>Todavía no hay eventos cargados.</p>
          </Card>
        ) : (
          Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-sm tracking-widest uppercase text-muted-foreground mb-3">{month}</h2>
              <div className="space-y-3">
                {monthEvents.map((event) => (
                  <Card
                    key={event.id}
                    className={`p-4 border-l-4 ${COLOR_CLASSES[event.color] ?? COLOR_CLASSES.primary}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-primary uppercase tracking-wide">{event.dateLabel}</p>
                        <h3 className="font-bold text-lg mt-0.5">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{event.description}</p>
                        )}
                      </div>
                      {isCaptain && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEdit(event)} className="p-1.5 hover:bg-muted rounded" title="Editar">
                            <Edit2 className="w-4 h-4 text-primary" />
                          </button>
                          <button onClick={() => handleDelete(event.id)} className="p-1.5 hover:bg-destructive/10 rounded" title="Eliminar">
                            <Trash className="w-4 h-4 text-destructive" />
                          </button>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  )
}
