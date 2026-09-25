'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { clanLabel } from '@/lib/clans'
import { ArrowLeft, Trash } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AccessDeniedDialog } from '@/components/access-denied-dialog'
import { BattleMatchForm, type MatchSubmission } from '@/components/battle-match-form'

interface ManagerStats {
  manager: string
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

interface JornadaStats {
  jornada: number
  v: number
  e: number
  d: number
}

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
  managers: ManagerStats[]
  jornadas: JornadaStats[]
  topScorer: ManagerStats | null
  bestManager: ManagerStats | null
  worstManager: ManagerStats | null
}

interface Match {
  jornada: number
  condicion: string
  manager: string
  rival: string
  golLocal: number | null
  golVisita: number | null
  resultado: string
  resultadoLetra: string
  tirosLocal: number | null
  tirosVisita: number | null
  posesionLocal: number | null
  posesionVisita: number | null
  gf: number | null
  gc: number | null
  pts: number | null
  dif: number | null
  conclusiones: string
  detalle: Record<string, string | number>
}

interface BattleReportDetail {
  id: number
  clan: string
  title: string
  opponent: string
  fileName: string
  sheetName: string
  uploadedBy: string | null
  createdAt: string
  status: string
  summary: BattleSummary
  matches: Match[]
  submissions?: MatchSubmission[]
}

function resultBadgeClass(letra: string) {
  if (letra === 'V') return 'bg-green-500/15 text-green-500'
  if (letra === 'D') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

function detalleValue(detalle: Record<string, string | number>, key: string): string {
  const value = detalle[key]
  return value === undefined || value === '' ? '—' : String(value)
}

export default function BattleReportDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [report, setReport] = useState<BattleReportDetail | null>(null)
  const [loadingReport, setLoadingReport] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  const isCaptain = user?.role === 'captain'

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  const fetchReport = () => {
    if (!id) return
    setLoadingReport(true)
    fetch(`/api/battle-reports/${id}`)
      .then(async (res) => {
        const result = await res.json()
        if (res.status === 403) {
          setLocked(true)
          return
        }
        if (result.success) setReport(result.data)
        else setError(result.error || 'No se pudo cargar el reporte')
      })
      .catch(() => setError('Error cargando el reporte'))
      .finally(() => setLoadingReport(false))
  }

  useEffect(() => {
    if (!user || !id) return
    fetchReport()
  }, [user, id])

  const handleDelete = async () => {
    if (!report || !confirm('¿Eliminar este reporte de batalla? Esta acción no se puede deshacer.')) return
    const response = await fetch(`/api/battle-reports/${report.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) router.push('/dashboard/battles')
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
            <Link href="/dashboard/battles">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary truncate">{report?.title ?? 'Reporte de Batalla'}</h1>
              {report && (
                <p className="text-sm text-muted-foreground">
                  Clan {clanLabel(report.clan)} vs {report.opponent || '—'}
                </p>
              )}
            </div>
          </div>

          {report && isCaptain && (
            <Button onClick={handleDelete} variant="outline" className="gap-2 border-destructive/40 hover:bg-destructive/10 text-destructive">
              <Trash className="w-4 h-4" /> Eliminar
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6">
        <AccessDeniedDialog
          open={locked}
          message="Tu capitán todavía no habilitó el acceso a los reportes de jornadas para tu clan."
        />

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {loadingReport || !report ? (
          locked ? null : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
          )
        ) : report.status === 'draft' ? (
          <>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">Esta batalla está en progreso</p>
              <p className="text-muted-foreground mt-1">
                Todavía no se subió el Excel oficial. Cada quien puede reportar aquí su propio partido; cuando el
                capitán suba el archivo, esos datos se reemplazan automáticamente por lo que traiga el Excel.
              </p>
            </div>

            <BattleMatchForm reportId={report.id} submissions={report.submissions ?? []} onChanged={fetchReport} />

            <Card className="overflow-hidden">
              <div className="p-6 pb-0">
                <h3 className="font-bold text-lg text-primary">
                  Lo que ya reportaron ({(report.submissions ?? []).length})
                </h3>
              </div>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Manager</th>
                      <th className="px-4 py-3 text-left font-medium">J</th>
                      <th className="px-4 py-3 text-left font-medium">Cond.</th>
                      <th className="px-4 py-3 text-left font-medium">Rival</th>
                      <th className="px-4 py-3 text-center font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.submissions ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          Todavía nadie ha reportado un partido.
                        </td>
                      </tr>
                    ) : (
                      (report.submissions ?? []).map((s) => (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{s.manager}</td>
                          <td className="px-4 py-3">{s.jornada ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.condicion}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.rival || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            {s.golLocal ?? '—'}-{s.golVisita ?? '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold">{report.summary.pj}</p>
                <p className="text-xs text-muted-foreground">Partidos</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-green-500">{report.summary.v}</p>
                <p className="text-xs text-muted-foreground">Victorias</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold">{report.summary.e}</p>
                <p className="text-xs text-muted-foreground">Empates</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-destructive">{report.summary.d}</p>
                <p className="text-xs text-muted-foreground">Derrotas</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold">{report.summary.gf}-{report.summary.gc}</p>
                <p className="text-xs text-muted-foreground">Goles (DIF {report.summary.dif >= 0 ? '+' : ''}{report.summary.dif})</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{Math.round(report.summary.efectividad * 100)}%</p>
                <p className="text-xs text-muted-foreground">Efectividad ({report.summary.pts} PTS)</p>
              </Card>
            </div>

            {(report.summary.bestManager || report.summary.topScorer) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.summary.bestManager && (
                  <Card className="p-4 border-primary/30">
                    <p className="text-xs text-muted-foreground mb-1">Mejor manager</p>
                    <p className="font-bold text-primary">{report.summary.bestManager.manager}</p>
                    <p className="text-sm text-muted-foreground">
                      {report.summary.bestManager.pts} PTS · {report.summary.bestManager.v}V {report.summary.bestManager.e}E {report.summary.bestManager.d}D
                    </p>
                  </Card>
                )}
                {report.summary.topScorer && (
                  <Card className="p-4 border-primary/30">
                    <p className="text-xs text-muted-foreground mb-1">Más goleador</p>
                    <p className="font-bold text-primary">{report.summary.topScorer.manager}</p>
                    <p className="text-sm text-muted-foreground">{report.summary.topScorer.gf} goles a favor</p>
                  </Card>
                )}
              </div>
            )}

            {/* Progresión por jornada */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4 text-primary">Resultados por Jornada</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.summary.jornadas}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="jornada" tickFormatter={(j) => `J${j}`} fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip
                      labelFormatter={(j) => `Jornada ${j}`}
                      contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8 }}
                    />
                    <Legend />
                    <Bar dataKey="v" name="Victorias" stackId="r" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="e" name="Empates" stackId="r" fill="#a1a1aa" />
                    <Bar dataKey="d" name="Derrotas" stackId="r" fill="var(--destructive)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Ranking de managers */}
            <Card className="overflow-hidden">
              <div className="p-6 pb-0">
                <h3 className="font-bold text-lg text-primary">Ranking de Managers</h3>
              </div>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Manager</th>
                      <th className="px-4 py-3 text-center font-medium">PJ</th>
                      <th className="px-4 py-3 text-center font-medium">V</th>
                      <th className="px-4 py-3 text-center font-medium">E</th>
                      <th className="px-4 py-3 text-center font-medium">D</th>
                      <th className="px-4 py-3 text-center font-medium">GF</th>
                      <th className="px-4 py-3 text-center font-medium">GC</th>
                      <th className="px-4 py-3 text-center font-medium">DIF</th>
                      <th className="px-4 py-3 text-center font-medium">PTS</th>
                      <th className="px-4 py-3 text-center font-medium">Efect.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.managers.map((m, i) => (
                      <tr key={m.manager} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">
                          {i === 0 && <span className="mr-1">🏆</span>}
                          {m.manager}
                        </td>
                        <td className="px-4 py-3 text-center">{m.pj}</td>
                        <td className="px-4 py-3 text-center text-green-500">{m.v}</td>
                        <td className="px-4 py-3 text-center">{m.e}</td>
                        <td className="px-4 py-3 text-center text-destructive">{m.d}</td>
                        <td className="px-4 py-3 text-center">{m.gf}</td>
                        <td className="px-4 py-3 text-center">{m.gc}</td>
                        <td className="px-4 py-3 text-center">{m.dif >= 0 ? `+${m.dif}` : m.dif}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{m.pts}</td>
                        <td className="px-4 py-3 text-center">{Math.round(m.efectividad * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Detalle de todos los partidos */}
            <Card className="overflow-hidden">
              <div className="p-6 pb-0">
                <h3 className="font-bold text-lg text-primary">Detalle de los {report.matches.length} Partidos</h3>
              </div>
              <div className="overflow-x-auto mt-4 max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">J</th>
                      <th className="px-4 py-3 text-left font-medium">Cond.</th>
                      <th className="px-4 py-3 text-left font-medium">Manager</th>
                      <th className="px-4 py-3 text-left font-medium">Rival</th>
                      <th className="px-4 py-3 text-center font-medium">Resultado</th>
                      <th className="px-4 py-3 text-center font-medium">Alineación (Nuestra / Rival)</th>
                      <th className="px-4 py-3 text-center font-medium">Estilo (Nuestro / Rival)</th>
                      <th className="px-4 py-3 text-center font-medium">Líneas (Def / Med / Del)</th>
                      <th className="px-4 py-3 text-center font-medium">Presión</th>
                      <th className="px-4 py-3 text-center font-medium">Estilo %</th>
                      <th className="px-4 py-3 text-center font-medium">Velocidad</th>
                      <th className="px-4 py-3 text-center font-medium">Campus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.matches.map((m, i) => (
                      <tr key={i} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3">{m.jornada}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.condicion}</td>
                        <td className="px-4 py-3 font-medium">{m.manager}</td>
                        <td className="px-4 py-3 text-muted-foreground">{m.rival}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${resultBadgeClass(m.resultadoLetra)}`}>
                            {m.resultado} ({m.resultadoLetra})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                          <span className="font-medium">{detalleValue(m.detalle, 'TÁCTICAS__NUESTRA')}</span>
                          <span className="text-muted-foreground"> vs </span>
                          <span className="text-muted-foreground">{detalleValue(m.detalle, 'TÁCTICAS__RIVAL')}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs whitespace-nowrap">
                          <span className="font-medium">{detalleValue(m.detalle, 'ESTILO__NUESTRO')}</span>
                          <span className="text-muted-foreground"> vs </span>
                          <span className="text-muted-foreground">{detalleValue(m.detalle, 'ESTILO__RIVAL')}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground whitespace-nowrap">
                          {detalleValue(m.detalle, 'DEFENSAS')} / {detalleValue(m.detalle, 'MEDIOS')} / {detalleValue(m.detalle, 'DELANTEROS')}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {detalleValue(m.detalle, 'PRESIÓN')}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {detalleValue(m.detalle, 'ESTILO')}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {detalleValue(m.detalle, 'VELOCIDAD')}
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-muted-foreground">
                          {detalleValue(m.detalle, 'CAMPUS')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
