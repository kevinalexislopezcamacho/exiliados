'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { clanLabel } from '@/lib/clans'
import { ArrowLeft, Target } from 'lucide-react'
import { AccessDeniedDialog } from '@/components/access-denied-dialog'

interface RecordStat {
  pj: number
  v: number
  e: number
  d: number
  efectividad: number
}

interface PressureStat extends RecordStat {
  band: string
  label: string
}

interface FormationStat extends RecordStat {
  formacion: string
}

interface FormationPressureStat extends RecordStat {
  formacion: string
  rivalFormacion: string
  band: string
  label: string
}

interface TacticalAnalysis {
  totalPartidosConDatos: number
  byPressure: PressureStat[]
  byFormation: FormationStat[]
  byFormationAndPressure: FormationPressureStat[]
}

function effColor(eff: number) {
  if (eff >= 0.55) return 'text-green-500'
  if (eff <= 0.35) return 'text-destructive'
  return 'text-foreground'
}

function verdict(eff: number) {
  if (eff >= 0.55) return { text: 'Efectiva', color: 'text-green-500' }
  if (eff <= 0.35) return { text: 'Floja', color: 'text-destructive' }
  return { text: 'Regular', color: 'text-foreground' }
}

export default function TacticalAnalysisPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [clan, setClan] = useState('exiliados')
  const [data, setData] = useState<TacticalAnalysis | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [formationFilter, setFormationFilter] = useState<Set<string>>(new Set())

  const toggleFormation = (formacion: string) => {
    setFormationFilter((prev) => {
      const next = new Set(prev)
      if (next.has(formacion)) next.delete(formacion)
      else next.add(formacion)
      return next
    })
  }

  const isSuperAdmin = user?.username === 'chicolinas'

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
    if (user?.clan) setClan(user.clan)
  }, [user, loading, router])

  useEffect(() => {
    if (!user || !clan) return
    setLoadingData(true)
    setFormationFilter(new Set())
    setLocked(false)
    fetch(`/api/battle-reports/tactics?clan=${clan}`)
      .then(async (res) => {
        const result = await res.json()
        if (res.status === 403) {
          setLocked(true)
          return
        }
        if (result.success) setData(result.data)
        else setError(result.error || 'No se pudo calcular el análisis')
      })
      .catch(() => setError('Error cargando el análisis táctico'))
      .finally(() => setLoadingData(false))
  }, [user, clan])

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
              <h1 className="text-2xl font-bold text-primary">Análisis Táctico</h1>
              <p className="text-sm text-muted-foreground">Efectividad por presión y alineación, cruzando todos tus reportes</p>
            </div>
          </div>

          {isSuperAdmin && (
            <select
              value={clan}
              onChange={(e) => setClan(e.target.value)}
              className="px-3 py-2 border border-border rounded-md bg-background text-sm"
            >
              <option value="exiliados">Exiliados</option>
              <option value="rayo">Rayo</option>
            </select>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6">
        <AccessDeniedDialog
          open={locked}
          message="Tu capitán todavía no habilitó el acceso al análisis táctico para tu clan."
        />

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {locked ? null : loadingData || !data ? (
          <div className="grid grid-cols-1 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-40 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
            ))}
          </div>
        ) : data.totalPartidosConDatos === 0 ? (
          <Card className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
            <Target className="w-8 h-8" />
            <p>Todavía no hay suficientes datos tácticos en los reportes de {clanLabel(clan)}.</p>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-1 text-primary">Efectividad por Presión</h3>
              <p className="text-xs text-muted-foreground mb-4">
                0-19 muy baja · 20-39 baja · 40-59 neutra · 60-79 alta · 80-100 muy alta
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Presión</th>
                      <th className="px-4 py-2 text-center font-medium">PJ</th>
                      <th className="px-4 py-2 text-center font-medium">V-E-D</th>
                      <th className="px-4 py-2 text-center font-medium">Efectividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byPressure.map((p) => (
                      <tr key={p.band} className="border-b border-border/50">
                        <td className="px-4 py-2 font-medium">{p.label}</td>
                        <td className="px-4 py-2 text-center">{p.pj}</td>
                        <td className="px-4 py-2 text-center text-muted-foreground">
                          {p.v}V-{p.e}E-{p.d}D
                        </td>
                        <td className={`px-4 py-2 text-center font-bold ${effColor(p.efectividad)}`}>
                          {Math.round(p.efectividad * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-lg mb-1 text-primary">Efectividad por Alineación</h3>
              <p className="text-xs text-muted-foreground mb-4">Ordenado por partidos jugados con esa formación</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Formación</th>
                      <th className="px-4 py-2 text-center font-medium">PJ</th>
                      <th className="px-4 py-2 text-center font-medium">V-E-D</th>
                      <th className="px-4 py-2 text-center font-medium">Efectividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byFormation.map((f) => (
                      <tr key={f.formacion} className="border-b border-border/50">
                        <td className="px-4 py-2 font-medium">{f.formacion}</td>
                        <td className="px-4 py-2 text-center">{f.pj}</td>
                        <td className="px-4 py-2 text-center text-muted-foreground">
                          {f.v}V-{f.e}E-{f.d}D
                        </td>
                        <td className={`px-4 py-2 text-center font-bold ${effColor(f.efectividad)}`}>
                          {Math.round(f.efectividad * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Formaciones con pocos partidos jugados (PJ bajo) son menos confiables — trátalas como pista, no como conclusión.
              </p>
            </Card>

            <Card className="p-6">
              <h3 className="font-bold text-lg mb-1 text-primary">Formación + Presión: ¿Qué combinación funciona?</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Cada formación jugada con cada nivel de presión, ordenado por partidos jugados
              </p>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                {data.byFormation.map((f) => {
                  const active = formationFilter.has(f.formacion)
                  return (
                    <button
                      key={f.formacion}
                      onClick={() => toggleFormation(f.formacion)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card/50 text-muted-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {f.formacion}
                    </button>
                  )
                })}
                {formationFilter.size > 0 && (
                  <button
                    onClick={() => setFormationFilter(new Set())}
                    className="px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-primary underline"
                  >
                    Limpiar filtro
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Formación</th>
                      <th className="px-4 py-2 text-left font-medium">Presión</th>
                      <th className="px-4 py-2 text-left font-medium">Vs. Formación Rival</th>
                      <th className="px-4 py-2 text-center font-medium">PJ</th>
                      <th className="px-4 py-2 text-center font-medium">V-E-D</th>
                      <th className="px-4 py-2 text-center font-medium">Efectividad</th>
                      <th className="px-4 py-2 text-center font-medium">Veredicto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byFormationAndPressure
                      .filter((fp) => formationFilter.size === 0 || formationFilter.has(fp.formacion))
                      .map((fp) => {
                      const v = verdict(fp.efectividad)
                      return (
                        <tr key={`${fp.formacion}::${fp.band}::${fp.rivalFormacion}`} className="border-b border-border/50">
                          <td className="px-4 py-2 font-medium">{fp.formacion}</td>
                          <td className="px-4 py-2 text-muted-foreground">{fp.label}</td>
                          <td className="px-4 py-2 text-muted-foreground">{fp.rivalFormacion || '—'}</td>
                          <td className="px-4 py-2 text-center">{fp.pj}</td>
                          <td className="px-4 py-2 text-center text-muted-foreground">
                            {fp.v}V-{fp.e}E-{fp.d}D
                          </td>
                          <td className={`px-4 py-2 text-center font-bold ${effColor(fp.efectividad)}`}>
                            {Math.round(fp.efectividad * 100)}%
                          </td>
                          <td className={`px-4 py-2 text-center font-medium ${v.color}`}>{v.text}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Combinaciones con pocos partidos (PJ bajo) son pista, no conclusión — mientras más reportes subas, más confiable se vuelve.
              </p>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
