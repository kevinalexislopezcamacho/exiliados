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
import { ArrowLeft, Coins, Plus, Trash, Upload, X } from 'lucide-react'
import { AccessDeniedDialog } from '@/components/access-denied-dialog'

interface SquadSummary {
  equipos: number
  valorTotal: number
  valorPromedio: number
  eficienciaPromedio: number
  bestValue: { usuario: string; valorActual: number | null } | null
  bestEfficiency: { usuario: string; eficiencia: number | null } | null
}

interface SquadReport {
  id: number
  clan: string
  title: string
  fileName: string
  uploadedBy: string | null
  createdAt: string
  summary: SquadSummary
}

export default function SquadReportsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [reports, setReports] = useState<SquadReport[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [locked, setLocked] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [clan, setClan] = useState('exiliados')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const isCaptain = user?.role === 'captain'

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const fetchReports = () => {
    setLoadingReports(true)
    fetch('/api/squad-reports')
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
      form.append('file', file)

      const response = await fetch('/api/squad-reports', { method: 'POST', body: form })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setShowForm(false)
      setTitle('')
      setFile(null)
      fetchReports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error subiendo el archivo')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este reporte de armado? Esta acción no se puede deshacer.')) return
    try {
      const response = await fetch(`/api/squad-reports/${id}`, { method: 'DELETE' })
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
              <h1 className="text-2xl font-bold text-primary">Reportes de Armado</h1>
              <p className="text-sm text-muted-foreground">
                Sube el .xlsx de valor de equipo (hoja "Equipos") y analiza compras, ventas y eficiencia
              </p>
            </div>
          </div>

          {isCaptain && (
            <Button onClick={() => setShowForm((s) => !s)} className="gap-2">
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Cancelar' : 'Subir reporte'}
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {isCaptain && showForm && (
          <Card className="p-6">
            <h3 className="font-bold text-lg mb-4 text-primary">Subir archivo .xlsx</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Archivo (.xlsx con hoja "Equipos")</label>
                <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
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
                <label className="block text-sm font-medium mb-2">Título (usa el mismo nombre que el reporte de jornadas de esta batalla, para cruzar la meta)</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. REX VS UPP" />
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
            message="Tu capitán todavía no habilitó el acceso a los reportes de armado para tu clan."
          />
        ) : reports.length === 0 ? (
          <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Coins className="w-8 h-8" />
            <p>Aún no hay reportes de armado. Sube el primer archivo .xlsx.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <Card key={report.id} className="p-5 border-primary/20 hover:border-primary/50 transition-colors flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    Clan {clanLabel(report.clan)}
                  </Badge>
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
                  {report.summary.equipos} equipos · {new Date(report.createdAt).toLocaleDateString()}
                </p>

                <div className="grid grid-cols-2 gap-2 text-center text-sm mb-4">
                  <div>
                    <p className="font-bold text-primary">{Math.round(report.summary.valorPromedio)}M</p>
                    <p className="text-[10px] text-muted-foreground">Valor prom.</p>
                  </div>
                  <div>
                    <p className="font-bold text-primary">{Math.round(report.summary.eficienciaPromedio * 100)}%</p>
                    <p className="text-[10px] text-muted-foreground">Eficiencia prom.</p>
                  </div>
                </div>

                <Link href={`/dashboard/squads/${report.id}`} className="mt-auto">
                  <Button variant="outline" className="w-full border-primary/40 hover:bg-primary/10">
                    Ver análisis completo
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
