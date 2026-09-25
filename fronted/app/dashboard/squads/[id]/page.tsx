'use client'

import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { clanLabel } from '@/lib/clans'
import { ArrowLeft, Trash } from 'lucide-react'
import { AccessDeniedDialog } from '@/components/access-denied-dialog'

interface SquadTeam {
  equipo: string
  grupo: string
  usuario: string
  valorInicial: number | null
  valorActual: number | null
  vendido: number | null
  gastado: number | null
  disponible: number | null
  progreso: number | null
  factorVenta: number | null
  factorCompra: number | null
  eficiencia: number | null
  ventas: number | null
  compras: number | null
  meta: number | null
}

interface SquadSummary {
  equipos: number
  valorTotal: number
  valorPromedio: number
  eficienciaPromedio: number
  bestValue: SquadTeam | null
  bestEfficiency: SquadTeam | null
}

interface SquadReportDetail {
  id: number
  clan: string
  title: string
  fileName: string
  sheetName: string
  uploadedBy: string | null
  createdAt: string
  summary: SquadSummary
  teams: SquadTeam[]
}

function fmt(n: number | null, suffix = '') {
  if (n === null || n === undefined) return '—'
  return `${Math.round(n)}${suffix}`
}

function pct(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `${Math.round(n * 100)}%`
}

export default function SquadReportDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [report, setReport] = useState<SquadReportDetail | null>(null)
  const [loadingReport, setLoadingReport] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)

  const isCaptain = user?.role === 'captain'

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !id) return
    setLoadingReport(true)
    fetch(`/api/squad-reports/${id}`)
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
  }, [user, id])

  const handleDelete = async () => {
    if (!report || !confirm('¿Eliminar este reporte de armado? Esta acción no se puede deshacer.')) return
    const response = await fetch(`/api/squad-reports/${report.id}`, { method: 'DELETE' })
    const result = await response.json()
    if (result.success) router.push('/dashboard/squads')
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
            <Link href="/dashboard/squads">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary truncate">{report?.title ?? 'Reporte de Armado'}</h1>
              {report && <p className="text-sm text-muted-foreground">Clan {clanLabel(report.clan)}</p>}
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
          message="Tu capitán todavía no habilitó el acceso a los reportes de armado para tu clan."
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
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold">{report.summary.equipos}</p>
                <p className="text-xs text-muted-foreground">Equipos</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{fmt(report.summary.valorTotal, 'M')}</p>
                <p className="text-xs text-muted-foreground">Valor total</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold">{fmt(report.summary.valorPromedio, 'M')}</p>
                <p className="text-xs text-muted-foreground">Valor promedio</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{pct(report.summary.eficienciaPromedio)}</p>
                <p className="text-xs text-muted-foreground">Eficiencia promedio</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.summary.bestValue && (
                <Card className="p-4 border-primary/30">
                  <p className="text-xs text-muted-foreground mb-1">Mejor valor de equipo</p>
                  <p className="font-bold text-primary">{report.summary.bestValue.usuario}</p>
                  <p className="text-sm text-muted-foreground">{fmt(report.summary.bestValue.valorActual, 'M')}</p>
                </Card>
              )}
              {report.summary.bestEfficiency && (
                <Card className="p-4 border-primary/30">
                  <p className="text-xs text-muted-foreground mb-1">Más eficaz</p>
                  <p className="font-bold text-primary">{report.summary.bestEfficiency.usuario}</p>
                  <p className="text-sm text-muted-foreground">{pct(report.summary.bestEfficiency.eficiencia)} de eficiencia</p>
                </Card>
              )}
            </div>

            <Card className="overflow-hidden">
              <div className="p-6 pb-0">
                <h3 className="font-bold text-lg text-primary">Detalle por Equipo</h3>
              </div>
              <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Equipo</th>
                      <th className="px-4 py-3 text-left font-medium">Usuario</th>
                      <th className="px-4 py-3 text-center font-medium">Meta</th>
                      <th className="px-4 py-3 text-center font-medium">Valor Inicial</th>
                      <th className="px-4 py-3 text-center font-medium">Valor Actual</th>
                      <th className="px-4 py-3 text-center font-medium">Vendido</th>
                      <th className="px-4 py-3 text-center font-medium">Gastado</th>
                      <th className="px-4 py-3 text-center font-medium">Disponible</th>
                      <th className="px-4 py-3 text-center font-medium">Compras</th>
                      <th className="px-4 py-3 text-center font-medium">Ventas</th>
                      <th className="px-4 py-3 text-center font-medium">Eficiencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.teams.map((t, i) => (
                      <tr key={i} className="border-b border-border hover:bg-muted/50">
                        <td className="px-4 py-3 text-muted-foreground">{t.equipo}</td>
                        <td className="px-4 py-3 font-medium">{t.usuario}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{t.meta ?? '—'}</td>
                        <td className="px-4 py-3 text-center">{fmt(t.valorInicial, 'M')}</td>
                        <td className="px-4 py-3 text-center font-bold text-primary">{fmt(t.valorActual, 'M')}</td>
                        <td className="px-4 py-3 text-center">{fmt(t.vendido, 'M')}</td>
                        <td className="px-4 py-3 text-center">{fmt(t.gastado, 'M')}</td>
                        <td className="px-4 py-3 text-center">{fmt(t.disponible, 'M')}</td>
                        <td className="px-4 py-3 text-center">{t.compras ?? '—'}</td>
                        <td className="px-4 py-3 text-center">{t.ventas ?? '—'}</td>
                        <td className="px-4 py-3 text-center">{pct(t.eficiencia)}</td>
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
