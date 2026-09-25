'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Calendar, Edit2, Plus, Trash, X } from 'lucide-react'

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

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

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
    if (user) fetchEvents()
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
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6 max-w-3xl">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
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
                          <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
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
