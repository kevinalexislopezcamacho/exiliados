'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { clanLabel, CLAN_LABELS } from '@/lib/clans'
import { ArrowLeft, FileSpreadsheet, Plus, Target, Trash, Upload, X } from 'lucide-react'
import { AccessDeniedDialog } from '@/components/access-denied-dialog'

interface BattleSummary {
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
}

interface BattleReport {
  id: number
  clan: string
  title: string
  opponent: string
  fileName: string
  uploadedBy: string | null
  createdAt: string
  status: string
  summary: BattleSummary
}

export default function BattleReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [reports, setReports] = useState<BattleReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [locked, setLocked] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [clan, setClan] = useState('exiliados')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [targetReportId, setTargetReportId] = useState('')

  const [showDraftForm, setShowDraftForm] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftOpponent, setDraftOpponent] = useState('')
  const [creatingDraft, setCreatingDraft] = useState(false)

  const isCaptain = user?.role === 'captain'
  const drafts = reports.filter((r) => r.status === 'draft' && r.clan === clan)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const fetchReports = () => {
    setLoadingReports(true)
    fetch('/api/battle-reports')
      .then(async (res) => {
        const result = await res.json()
        if (res.status === 403) {
          setLocked(true)
          return
        }
        setLocked(false)
        if (result.success) setReports(result.data)
      })
      .catch(() => setError('Error cargando los reportes'))
      .finally(() => setLoadingReports(false))
  }

  useEffect(() => {
    if (user) fetchReports()
  }, [user])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!file) {
      setError('Selecciona un archivo .xlsx')
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('clan', clan)
      if (title.trim()) form.append('title', title.trim())
      if (targetReportId) form.append('reportId', targetReportId)
      form.append('file', file)

      const response = await fetch('/api/battle-reports', { method: 'POST', body: form })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setShowForm(false)
      setTitle('')
      setFile(null)
      setTargetReportId('')
      fetchReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo el archivo')
    } finally {
      setUploading(false)
    }
  }

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!draftTitle.trim()) {
      setError('Ponle un título a la batalla')
      return
    }

    setCreatingDraft(true)
    try {
      const response = await fetch('/api/battle-reports/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clan, title: draftTitle.trim(), opponent: draftOpponent.trim() }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      router.push(`/dashboard/battles/${result.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando la batalla')
    } finally {
      setCreatingDraft(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este reporte de batalla? Esta acción no se puede deshacer.')) return
    try {
      const response = await fetch(`/api/battle-reports/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)
      setReports((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando el reporte')
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

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
              <h1 className="text-2xl font-bold text-primary">Reportes de Batalla</h1>
              <p className="text-sm text-muted-foreground">Sube, analiza y elimina los registros de las 10 jornadas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!locked && (
              <Link href="/dashboard/battles/tactics">
                <Button variant="outline" className="gap-2 border-primary/40 hover:bg-primary/10">
                  <Target className="w-4 h-4" /> Análisis táctico
                </Button>
              </Link>
            )}
            {isCaptain && (
              <Button
                onClick={() => {
                  setShowDraftForm((s) => !s)
                  setShowForm(false)
                }}
                variant="outline"
                className="gap-2 border-primary/40 hover:bg-primary/10"
              >
                {showDraftForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showDraftForm ? 'Cancelar' : 'Nueva batalla en blanco'}
              </Button>
            )}
            {isCaptain && (
              <Button
                onClick={() => {
                  setShowForm((s) => !s)
                  setShowDraftForm(false)
                }}
                className="gap-2"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancelar' : 'Subir reporte'}
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {isCaptain && showDraftForm && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-1 text-primary">Nueva batalla en blanco</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Se crea sin Excel todavía: cada integrante puede ir reportando su propio partido desde la página
              mientras se junta el archivo oficial.
            </p>
            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Clan</label>
                <select
                  value={clan}
                  onChange={(e) => setClan(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  {Object.entries(CLAN_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Título</label>
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Ej. EXI vs REV" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Rival (opcional)</label>
                <Input value={draftOpponent} onChange={(e) => setDraftOpponent(e.target.value)} placeholder="Ej. REV" />
              </div>
              <Button type="submit" disabled={creatingDraft} className="gap-2">
                <Plus className="w-4 h-4" />
                {creatingDraft ? 'Creando...' : 'Crear batalla'}
              </Button>
            </form>
          </Card>
        )}

        {isCaptain && showForm && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 text-primary">Subir archivo .xlsx</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Archivo (.xlsx)</label>
                <Input
                  type="file"
                  accept=".xlsx"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Clan</label>
                <select
                  value={clan}
                  onChange={(e) => {
                    setClan(e.target.value)
                    setTargetReportId('')
                  }}
                  className="w-full px-3 py-2 border border-border rounded-md bg-background"
                >
                  {Object.entries(CLAN_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              {drafts.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">¿Es el Excel de una batalla en progreso?</label>
                  <select
                    value={targetReportId}
                    onChange={(e) => setTargetReportId(e.target.value)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                  >
                    <option value="">No, crear una batalla nueva</option>
                    {drafts.map((d) => (
                      <option key={d.id} value={d.id}>
                        Actualizar "{d.title}"
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Título (opcional)</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. EXI vs REV"
                />
              </div>
              <Button type="submit" disabled={uploading} className="gap-2">
                <Upload className="w-4 h-4" />
                {uploading ? 'Analizando...' : 'Subir y analizar'}
              </Button>
            </form>
          </Card>
        )}

        {loadingReports ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : locked ? (
          <AccessDeniedDialog
            open
            message="Tu capitán todavía no habilitó el acceso a los reportes de jornadas para tu clan."
          />
        ) : reports.length === 0 ? (
          <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <FileSpreadsheet className="w-8 h-8" />
            <p>Aún no hay reportes de batalla. Sube el primer archivo .xlsx.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => {
              const isDraft = report.status === 'draft'
              return (
              <Card key={report.id} className="p-5 border-primary/20 hover:border-primary/50 transition-colors flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      Clan {clanLabel(report.clan)}
                    </Badge>
                    {isDraft && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                        En progreso
                      </Badge>
                    )}
                  </div>
                  {isCaptain && (
                    <button
                      onClick={() => handleDelete(report.id)}
                      className="p-1 hover:bg-destructive/10 rounded"
                      title="Eliminar reporte"
                    >
                      <Trash className="w-4 h-4 text-destructive" />
                    </button>
                  )}
                </div>

                <h3 className="font-bold text-lg mb-1">{report.title}</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  vs {report.opponent || '—'} · {new Date(report.createdAt).toLocaleDateString()}
                </p>

                {isDraft ? (
                  <p className="text-sm text-muted-foreground mb-4 flex-1">
                    Todavía no tiene Excel oficial. Entra a reportar tu partido mientras se junta.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
                    <div>
                      <p className="font-bold text-green-500">{report.summary.v}</p>
                      <p className="text-[10px] text-muted-foreground">V</p>
                    </div>
                    <div>
                      <p className="font-bold">{report.summary.e}</p>
                      <p className="text-[10px] text-muted-foreground">E</p>
                    </div>
                    <div>
                      <p className="font-bold text-destructive">{report.summary.d}</p>
                      <p className="text-[10px] text-muted-foreground">D</p>
                    </div>
                    <div>
                      <p className="font-bold">{report.summary.pts}</p>
                      <p className="text-[10px] text-muted-foreground">PTS</p>
                    </div>
                  </div>
                )}

                <Link href={`/dashboard/battles/${report.id}`} className="mt-auto">
                  <Button variant="outline" className="w-full border-primary/40 hover:bg-primary/10">
                    {isDraft ? 'Reportar mi partido' : 'Ver análisis completo'}
                  </Button>
                </Link>
              </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
