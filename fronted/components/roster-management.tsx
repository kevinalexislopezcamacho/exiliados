'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { clanLabel } from '@/lib/clans'
import { Plus, X, Edit2, Trash, ArrowUpCircle, ArrowDownCircle, Users } from 'lucide-react'

interface RosterMember {
  id: number
  name: string
  clan: string
  countryCode: string
  title: string
  username: string | null
  hasPassword: boolean
}

interface FormState {
  name: string
  username: string
  countryCode: string
  title: string
}

const EMPTY_FORM: FormState = { name: '', username: '', countryCode: '', title: '' }

const NATIONALITIES: Array<{ code: string; label: string }> = [
  { code: 'mx', label: 'México' },
  { code: 've', label: 'Venezuela' },
  { code: 'co', label: 'Colombia' },
  { code: 'us', label: 'Estados Unidos' },
  { code: 'es', label: 'España' },
  { code: 'ar', label: 'Argentina' },
  { code: 'cl', label: 'Chile' },
  { code: 'pe', label: 'Perú' },
  { code: 'br', label: 'Brasil' },
  { code: 'ec', label: 'Ecuador' },
  { code: 'bo', label: 'Bolivia' },
  { code: 'cu', label: 'Cuba' },
  { code: 'pa', label: 'Panamá' },
  { code: 'uy', label: 'Uruguay' },
]

const TITLE_SUGGESTIONS = [
  'Capitán',
  'Seleccionador',
  'Seleccionado mayor',
  'Ex seleccionado mayor',
  'Sub 21',
  'Ex sub 21',
]

export function RosterManagement({ clan, isSuperAdmin }: { clan: string; isSuperAdmin: boolean }) {
  const [activeClan, setActiveClan] = useState(clan)
  const [members, setMembers] = useState<RosterMember[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setActiveClan(clan)
  }, [clan])

  useEffect(() => {
    fetchMembers(activeClan)
  }, [activeClan])

  const fetchMembers = async (targetClan: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/clan-members?clan=${targetClan}`)
      const result = await response.json()
      if (result.success) setMembers(result.data)
      else setError(result.error || 'Error cargando el roster')
    } catch {
      setError('Error cargando el roster')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name.trim()) {
      setError('El nombre es obligatorio')
      return
    }

    try {
      const url = editingId ? `/api/clan-members/${editingId}` : '/api/clan-members'
      const method = editingId ? 'PUT' : 'POST'
      const body = editingId ? formData : { ...formData, clan: activeClan }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setSuccess(editingId ? 'Integrante actualizado' : 'Integrante agregado')
      resetForm()
      fetchMembers(activeClan)
      setTimeout(() => setShowForm(false), 800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando el integrante')
    }
  }

  const handleEdit = (member: RosterMember) => {
    setEditingId(member.id)
    setFormData({
      name: member.name,
      username: member.username ?? '',
      countryCode: member.countryCode ?? '',
      title: member.title ?? '',
    })
    setShowForm(true)
  }

  const handleDelete = async (member: RosterMember) => {
    if (!confirm(`¿Eliminar a "${member.name}" del roster? Esto también borra su cuenta de acceso.`)) return
    try {
      const response = await fetch(`/api/clan-members/${member.id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setSuccess('Integrante eliminado')
      fetchMembers(activeClan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando el integrante')
    }
  }

  const handlePromote = async (member: RosterMember) => {
    if (!confirm(`¿Ascender a "${member.name}" de Rayo a Exiliados?`)) return
    try {
      const response = await fetch(`/api/clan-members/${member.id}/promote`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setSuccess(`${member.name} ascendió a Exiliados`)
      fetchMembers(activeClan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error ascendiendo al integrante')
    }
  }

  const handleDemote = async (member: RosterMember) => {
    if (!confirm(`¿Descender a "${member.name}" de Exiliados a Rayo?`)) return
    try {
      const response = await fetch(`/api/clan-members/${member.id}/demote`, { method: 'POST' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setSuccess(`${member.name} descendió a Rayo`)
      fetchMembers(activeClan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error descendiendo al integrante')
    }
  }

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-lg text-primary">Roster · Clan {clanLabel(activeClan)}</h3>
          {!loading && <span className="text-sm text-muted-foreground">{members.length} integrantes</span>}
        </div>

        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <div className="flex rounded-md border border-border overflow-hidden">
              {(['rayo', 'exiliados'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    resetForm()
                    setShowForm(false)
                    setActiveClan(c)
                  }}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeClan === c ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                >
                  {clanLabel(c)}
                </button>
              ))}
            </div>
          )}
          <Button
            onClick={() => {
              resetForm()
              setShowForm(true)
            }}
            size="sm"
            className="bg-primary hover:bg-primary/90 gap-2"
          >
            <Plus className="w-4 h-4" /> Agregar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-primary text-sm mb-4">
          {success}
        </div>
      )}

      {showForm && (
        <Card className="p-4 mb-4 bg-card/60">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Nombre</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nombre en el juego"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Nombre de usuario</label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder={editingId ? '(dejar igual para no cambiar)' : '(por defecto: del nombre)'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Nacionalidad</label>
                <Select
                  value={formData.countryCode || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, countryCode: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin especificar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin especificar</SelectItem>
                    {NATIONALITIES.map((n) => (
                      <SelectItem key={n.code} value={n.code}>
                        {n.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-muted-foreground">Selección / rango</label>
                <Input
                  list="title-suggestions"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Seleccionado mayor"
                />
                <datalist id="title-suggestions">
                  {TITLE_SUGGESTIONS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 text-sm font-medium"
              >
                {editingId ? 'Guardar cambios' : 'Agregar al roster'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="px-4 py-2 border border-border rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-start gap-3 rounded-lg bg-card/50 border border-border/30 hover:border-primary/40 transition-colors px-3 py-2.5"
            >
              <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                {member.username && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{member.username} {member.hasPassword ? '' : '· sin contraseña aún'}
                  </p>
                )}
                {member.title && (
                  <Badge
                    variant="outline"
                    className="mt-1 text-[10px] px-1.5 py-0 border-primary/30 text-muted-foreground font-normal"
                  >
                    {member.title}
                  </Badge>
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                {activeClan === 'rayo' && (
                  <button
                    onClick={() => handlePromote(member)}
                    className="p-1 hover:bg-muted rounded"
                    title="Ascender a Exiliados"
                  >
                    <ArrowUpCircle className="w-4 h-4 text-primary" />
                  </button>
                )}
                {activeClan === 'exiliados' && (
                  <button
                    onClick={() => handleDemote(member)}
                    className="p-1 hover:bg-muted rounded"
                    title="Descender a Rayo"
                  >
                    <ArrowDownCircle className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
                <button onClick={() => handleEdit(member)} className="p-1 hover:bg-muted rounded" title="Editar">
                  <Edit2 className="w-4 h-4 text-primary" />
                </button>
                <button onClick={() => handleDelete(member)} className="p-1 hover:bg-muted rounded" title="Eliminar">
                  <Trash className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Users className="w-6 h-6" />
          <p className="text-sm">Aún no hay miembros registrados</p>
        </div>
      )}
    </Card>
  )
}

export default RosterManagement
