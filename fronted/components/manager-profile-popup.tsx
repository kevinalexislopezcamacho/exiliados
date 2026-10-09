'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { clanLabel } from '@/lib/clans'
import { useAuth } from '@/lib/auth/context'

interface ManagerStats {
  pj: number | null
  pts: number | null
  efectividad: number | null
  valorActual: number | null
  eficiencia: number | null
  meta: { met: boolean } | null
  score: number
}

interface ManagerProfile {
  id: number
  name: string
  clan: string
  countryCode: string
  title: string
  username: string | null
  role: string | null
  notes: string
  stats: ManagerStats | null
}

export function ManagerProfilePopup({
  clan,
  name,
  children,
}: {
  clan: string
  name: string
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [profile, setProfile] = useState<ManagerProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isCaptain = user?.role === 'captain'

  const fetchProfile = () => {
    setLoading(true)
    setError('')
    fetch(`/api/clan-members/profile?clan=${encodeURIComponent(clan)}&name=${encodeURIComponent(name)}`)
      .then(async (res) => {
        const result = await res.json()
        if (result.success) {
          setProfile(result.data)
          setNotesDraft(result.data.notes ?? '')
        } else {
          setError(result.error || 'No se pudo cargar el perfil')
        }
      })
      .catch(() => setError('Error cargando el perfil'))
      .finally(() => setLoading(false))
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setEditingNotes(false)
      setProfile(null)
      fetchProfile()
    }
  }

  const handleSaveNotes = async () => {
    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/clan-members/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clan, name, notes: notesDraft }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setProfile((prev) => (prev ? { ...prev, notes: result.data.notes } : prev))
      setEditingNotes(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando las notas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
        </DialogHeader>

        {loading || !profile ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{error || 'Cargando...'}</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="border-primary/40 text-primary">
                Clan {clanLabel(profile.clan)}
              </Badge>
              {profile.role === 'captain' && (
                <Badge className="bg-primary/15 text-primary border-primary/30">Capitán</Badge>
              )}
              {profile.title && <Badge variant="outline">{profile.title}</Badge>}
            </div>

            {profile.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}

            {profile.stats ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Puntaje compuesto</p>
                  <p className="text-lg font-bold text-primary">{Math.round(profile.stats.score)}</p>
                </div>
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Partidos / PTS</p>
                  <p className="text-lg font-bold">
                    {profile.stats.pj ?? '—'} / {profile.stats.pts ?? '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Efectividad</p>
                  <p className="text-lg font-bold">
                    {profile.stats.efectividad !== null ? `${Math.round(profile.stats.efectividad * 100)}%` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Valor de equipo</p>
                  <p className="text-lg font-bold">
                    {profile.stats.valorActual !== null ? `${Math.round(profile.stats.valorActual)}M` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Eficiencia armado</p>
                  <p className="text-lg font-bold">
                    {profile.stats.eficiencia !== null ? `${Math.round(profile.stats.eficiencia * 100)}%` : '—'}
                  </p>
                </div>
                <div className="rounded-lg bg-card/50 border border-border/50 p-3">
                  <p className="text-xs text-muted-foreground">Meta cumplida</p>
                  <p className="text-lg font-bold">{profile.stats.meta ? (profile.stats.meta.met ? 'Sí' : 'No') : '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Todavía no tiene reportes para calcular estadísticas.</p>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">Notas</p>
                {isCaptain && !editingNotes && (
                  <button onClick={() => setEditingNotes(true)} className="text-xs text-primary hover:underline">
                    {profile.notes ? 'Editar' : 'Agregar'}
                  </button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <textarea
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    className="w-full text-sm rounded-md border border-border bg-background p-2"
                    placeholder="Escribí algo sobre este integrante..."
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes} disabled={saving}>
                      {saving ? 'Guardando...' : 'Guardar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingNotes(false)
                        setNotesDraft(profile.notes)
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.notes || 'Sin notas todavía.'}</p>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
