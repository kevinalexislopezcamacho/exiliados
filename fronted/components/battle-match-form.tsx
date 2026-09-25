'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Trash, Pencil, Check, X } from 'lucide-react'

// Mismas opciones que los desplegables del Excel.
const ESTILO_OPTIONS = ['Contra', 'Pases', 'Bandas', 'Tiros', 'N/A']
const LINEA_OPTIONS = ['Atrás', 'Apoyar Def', 'Permanecer', 'Apoyo Med', 'Atacar']

export interface MatchSubmission {
  id: number
  memberId: number
  manager: string
  jornada: number | null
  condicion: string
  rival: string
  golLocal: number | null
  golVisita: number | null
  tirosLocal: number | null
  tirosVisita: number | null
  posesionLocal: number | null
  posesionVisita: number | null
  presion: number | null
  tacticaNuestra: string
  tacticaRival: string
  estiloNuestro: string
  estiloRival: string
  estiloPct: number | null
  velocidad: number | null
  defensas: string
  medios: string
  delanteros: string
  campus: boolean | null
  conclusiones: string
}

interface FormState {
  jornada: string
  condicion: string
  rival: string
  golLocal: string
  golVisita: string
  tirosLocal: string
  tirosVisita: string
  posesionLocal: string
  posesionVisita: string
  presion: string
  tacticaNuestra: string
  tacticaRival: string
  estiloNuestro: string
  estiloRival: string
  estiloPct: string
  velocidad: string
  defensas: string
  medios: string
  delanteros: string
  campus: string // '', 'si', 'no'
  conclusiones: string
}

const EMPTY_FORM: FormState = {
  jornada: '',
  condicion: 'Local',
  rival: '',
  golLocal: '',
  golVisita: '',
  tirosLocal: '',
  tirosVisita: '',
  posesionLocal: '',
  posesionVisita: '',
  presion: '',
  tacticaNuestra: '',
  tacticaRival: '',
  estiloNuestro: '',
  estiloRival: '',
  estiloPct: '',
  velocidad: '',
  defensas: '',
  medios: '',
  delanteros: '',
  campus: '',
  conclusiones: '',
}

function submissionToForm(s: MatchSubmission): FormState {
  return {
    jornada: s.jornada?.toString() ?? '',
    condicion: s.condicion || 'Local',
    rival: s.rival ?? '',
    golLocal: s.golLocal?.toString() ?? '',
    golVisita: s.golVisita?.toString() ?? '',
    tirosLocal: s.tirosLocal?.toString() ?? '',
    tirosVisita: s.tirosVisita?.toString() ?? '',
    posesionLocal: s.posesionLocal?.toString() ?? '',
    posesionVisita: s.posesionVisita?.toString() ?? '',
    presion: s.presion?.toString() ?? '',
    tacticaNuestra: s.tacticaNuestra ?? '',
    tacticaRival: s.tacticaRival ?? '',
    estiloNuestro: s.estiloNuestro ?? '',
    estiloRival: s.estiloRival ?? '',
    estiloPct: s.estiloPct?.toString() ?? '',
    velocidad: s.velocidad?.toString() ?? '',
    defensas: s.defensas ?? '',
    medios: s.medios ?? '',
    delanteros: s.delanteros ?? '',
    campus: s.campus === null ? '' : s.campus ? 'si' : 'no',
    conclusiones: s.conclusiones ?? '',
  }
}

function toBody(f: FormState) {
  return {
    jornada: f.jornada,
    condicion: f.condicion,
    rival: f.rival.trim(),
    golLocal: f.golLocal,
    golVisita: f.golVisita,
    tirosLocal: f.tirosLocal,
    tirosVisita: f.tirosVisita,
    posesionLocal: f.posesionLocal,
    posesionVisita: f.posesionVisita,
    presion: f.presion,
    tacticaNuestra: f.tacticaNuestra.trim(),
    tacticaRival: f.tacticaRival.trim(),
    estiloNuestro: f.estiloNuestro,
    estiloRival: f.estiloRival,
    estiloPct: f.estiloPct,
    velocidad: f.velocidad,
    defensas: f.defensas,
    medios: f.medios,
    delanteros: f.delanteros,
    campus: f.campus === '' ? '' : f.campus === 'si',
    conclusiones: f.conclusiones.trim(),
  }
}

function resultLetter(f: FormState): { label: string; className: string } | null {
  const gl = Number(f.golLocal)
  const gv = Number(f.golVisita)
  if (f.golLocal === '' || f.golVisita === '' || Number.isNaN(gl) || Number.isNaN(gv)) return null
  const gf = f.condicion === 'Visita' ? gv : gl
  const gc = f.condicion === 'Visita' ? gl : gv
  if (gf > gc) return { label: 'Vas ganando', className: 'text-green-500' }
  if (gf < gc) return { label: 'Vas perdiendo', className: 'text-destructive' }
  return { label: 'Vas empatando', className: 'text-muted-foreground' }
}

function MatchFields({
  form,
  onChange,
}: {
  form: FormState
  onChange: (next: FormState) => void
}) {
  const outcome = resultLetter(form)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Jornada</label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.jornada}
            onChange={(e) => onChange({ ...form, jornada: e.target.value })}
            placeholder="1-10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Condición</label>
          <select
            value={form.condicion}
            onChange={(e) => onChange({ ...form, condicion: e.target.value })}
            className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm"
          >
            <option value="Local">Local</option>
            <option value="Visita">Visita</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Rival (manager contrario)</label>
        <Input value={form.rival} onChange={(e) => onChange({ ...form, rival: e.target.value })} placeholder="Nombre del rival" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Goles equipo Local</label>
          <Input
            type="number"
            min={0}
            value={form.golLocal}
            onChange={(e) => onChange({ ...form, golLocal: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Goles equipo Visita</label>
          <Input
            type="number"
            min={0}
            value={form.golVisita}
            onChange={(e) => onChange({ ...form, golVisita: e.target.value })}
          />
        </div>
      </div>
      {outcome && <p className={`text-xs font-medium ${outcome.className}`}>{outcome.label}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Tiros Local (opcional)</label>
          <Input
            type="number"
            min={0}
            value={form.tirosLocal}
            onChange={(e) => onChange({ ...form, tirosLocal: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Tiros Visita (opcional)</label>
          <Input
            type="number"
            min={0}
            value={form.tirosVisita}
            onChange={(e) => onChange({ ...form, tirosVisita: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Posesión Local % (opcional)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.posesionLocal}
            onChange={(e) => onChange({ ...form, posesionLocal: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Posesión Visita % (opcional)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={form.posesionVisita}
            onChange={(e) => onChange({ ...form, posesionVisita: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1">Conclusiones (opcional)</label>
        <Input
          value={form.conclusiones}
          onChange={(e) => onChange({ ...form, conclusiones: e.target.value })}
          placeholder="Ej. rival jugó muy defensivo"
        />
      </div>

      <p className="text-xs font-semibold text-primary pt-1">Datos tácticos</p>

      <div className="space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Alineación nuestra</label>
              <Input
                value={form.tacticaNuestra}
                onChange={(e) => onChange({ ...form, tacticaNuestra: e.target.value })}
                placeholder="Ej. 4-3-3"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Alineación rival</label>
              <Input
                value={form.tacticaRival}
                onChange={(e) => onChange({ ...form, tacticaRival: e.target.value })}
                placeholder="Ej. 4-4-2"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Estilo</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Nuestro</label>
                <select
                  value={form.estiloNuestro}
                  onChange={(e) => onChange({ ...form, estiloNuestro: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">Sin especificar</option>
                  {ESTILO_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Rival</label>
                <select
                  value={form.estiloRival}
                  onChange={(e) => onChange({ ...form, estiloRival: e.target.value })}
                  className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm"
                >
                  <option value="">Sin especificar</option>
                  {ESTILO_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Líneas</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Defensas</label>
                <select
                  value={form.defensas}
                  onChange={(e) => onChange({ ...form, defensas: e.target.value })}
                  className="w-full h-9 px-2 border border-border rounded-md bg-background text-xs"
                >
                  <option value="">—</option>
                  {LINEA_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Medios</label>
                <select
                  value={form.medios}
                  onChange={(e) => onChange({ ...form, medios: e.target.value })}
                  className="w-full h-9 px-2 border border-border rounded-md bg-background text-xs"
                >
                  <option value="">—</option>
                  {LINEA_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Delanteros</label>
                <select
                  value={form.delanteros}
                  onChange={(e) => onChange({ ...form, delanteros: e.target.value })}
                  className="w-full h-9 px-2 border border-border rounded-md bg-background text-xs"
                >
                  <option value="">—</option>
                  {LINEA_OPTIONS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Porcentajes</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Presión %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.presion}
                  onChange={(e) => onChange({ ...form, presion: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Estilo %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.estiloPct}
                  onChange={(e) => onChange({ ...form, estiloPct: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Velocidad %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.velocidad}
                  onChange={(e) => onChange({ ...form, velocidad: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">¿Usaste Campus?</label>
            <select
              value={form.campus}
              onChange={(e) => onChange({ ...form, campus: e.target.value })}
              className="w-full h-9 px-3 border border-border rounded-md bg-background text-sm max-w-[200px]"
            >
              <option value="">Sin especificar</option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
      </div>
    </div>
  )
}

export function BattleMatchForm({
  reportId,
  submissions,
  onChanged,
}: {
  reportId: number
  submissions: MatchSubmission[]
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [newForm, setNewForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM)

  const mine = submissions.filter((s) => s.memberId === user?.id)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!newForm.rival.trim() || newForm.golLocal === '' || newForm.golVisita === '') {
      setError('Completa al menos rival y los goles')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/battle-reports/${reportId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toBody(newForm)),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setNewForm(EMPTY_FORM)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando tu partido')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (s: MatchSubmission) => {
    setEditingId(s.id)
    setEditForm(submissionToForm(s))
  }

  const handleSaveEdit = async (id: number) => {
    setError('')
    setSaving(true)
    try {
      const response = await fetch(`/api/battle-reports/${reportId}/submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toBody(editForm)),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setEditingId(null)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando tu partido')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Borrar este partido?')) return
    setError('')
    try {
      const response = await fetch(`/api/battle-reports/${reportId}/submissions/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error borrando tu partido')
    }
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="font-bold text-lg text-primary">Mis partidos</h3>
        <p className="text-sm text-muted-foreground">
          Reporta aquí tu partido de esta batalla, igual que lo pondrías en la hoja de Excel. Si jugaste más de una
          jornada, agrega cada una por separado.
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
      )}

      {mine.length > 0 && (
        <div className="space-y-3">
          {mine.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="border border-primary/30 rounded-lg p-4 space-y-3">
                <MatchFields form={editForm} onChange={setEditForm} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveEdit(s.id)} disabled={saving} className="gap-1">
                    <Check className="w-4 h-4" /> Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="gap-1">
                    <X className="w-4 h-4" /> Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <div key={s.id} className="flex items-center justify-between gap-3 border border-border rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    J{s.jornada ?? '—'} · {s.condicion} vs {s.rival || '—'} · {s.golLocal ?? '—'}-{s.golVisita ?? '—'}
                  </p>
                  {s.conclusiones && <p className="text-xs text-muted-foreground truncate">{s.conclusiones}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 hover:bg-primary/10 rounded" title="Editar">
                    <Pencil className="w-4 h-4 text-primary" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 hover:bg-destructive/10 rounded" title="Borrar">
                    <Trash className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <form onSubmit={handleAdd} className="space-y-3 border-t border-border pt-4">
        <MatchFields form={newForm} onChange={setNewForm} />
        <Button type="submit" disabled={saving} className="gap-2">
          <Plus className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Agregar partido'}
        </Button>
      </form>
    </Card>
  )
}
