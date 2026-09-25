"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface RecentMatch {
  jornada: number
  rival: string
  resultado: string
  resultadoLetra: string
  reportId: number
  reportTitle: string
}

interface MemberStatsData {
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  efectividad: number
  recentMatches: RecentMatch[]
}

function resultBadgeClass(letra: string) {
  if (letra === 'V') return 'bg-green-500/15 text-green-500'
  if (letra === 'D') return 'bg-destructive/15 text-destructive'
  return 'bg-muted text-muted-foreground'
}

export function MemberStats() {
  const [stats, setStats] = useState<MemberStatsData | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/battle-reports/me")
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setStats(result.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <>
      <Card className="p-6 border-primary/20 hover:border-primary/50 transition-colors">
        <h3 className="font-bold text-lg mb-4 text-primary">Mis Estadísticas</h3>
        {!stats ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : stats.pj === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no apareces en ningún reporte de batalla subido por tu clan.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-2xl font-bold text-green-500">{stats.v}</p>
                <p className="text-[10px] text-muted-foreground">Victorias</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.e}</p>
                <p className="text-[10px] text-muted-foreground">Empates</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{stats.d}</p>
                <p className="text-[10px] text-muted-foreground">Derrotas</p>
              </div>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-border/30">
              <span className="text-muted-foreground">Goles (a favor - en contra)</span>
              <span className="font-medium">{stats.gf} - {stats.gc}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Puntos</span>
              <span className="font-bold text-primary">{stats.pts}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Efectividad</span>
              <span className="font-medium">{Math.round(stats.efectividad * 100)}%</span>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 border-primary/20 hover:border-primary/50 transition-colors md:col-span-2">
        <h3 className="font-bold text-lg mb-4 text-primary">Mis Últimos Partidos</h3>
        {!stats ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : stats.recentMatches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aquí verás tus partidos en cuanto tu capitán suba un reporte de batalla donde aparezcas.
          </p>
        ) : (
          <div className="space-y-2">
            {stats.recentMatches.map((m, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border border-border/30 rounded p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">Jornada {m.jornada} vs {m.rival}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.reportTitle}</p>
                </div>
                <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${resultBadgeClass(m.resultadoLetra)}`}>
                  {m.resultado} ({m.resultadoLetra})
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}
