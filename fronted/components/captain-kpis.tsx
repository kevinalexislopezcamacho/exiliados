"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface Kpis {
  activeMembers: number
  reportsCount: number
  matchesAnalyzed: number
  totalWins: number
  efectividad: number
  topManager: RankingEntry | null
}

interface CommunityData {
  exiliados: Array<{ id: number }>
  rayo: Array<{ id: number }>
  chispa: Array<{ id: number }>
}

interface BattleReportListItem {
  clan: string
  summary: { pj: number; v: number }
}

interface RankingEntry {
  name: string
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  pts: number
}

export function CaptainKpis({ clan }: { clan: string }) {
  const [kpis, setKpis] = useState<Kpis | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch("/api/community").then((r) => r.json()),
      fetch("/api/battle-reports").then((r) => r.json()),
      fetch("/api/rankings").then((r) => r.json()),
    ])
      .then(([community, reports, rankings]) => {
        if (!active) return

        const roster: CommunityData | undefined = community.success ? community.data : undefined
        const activeMembers = roster?.[clan as keyof CommunityData]?.length ?? 0

        const clanReports: BattleReportListItem[] = reports.success
          ? reports.data.filter((r: BattleReportListItem) => r.clan === clan)
          : []
        const matchesAnalyzed = clanReports.reduce((sum, r) => sum + r.summary.pj, 0)
        const totalWins = clanReports.reduce((sum, r) => sum + r.summary.v, 0)
        const efectividad = matchesAnalyzed > 0 ? totalWins / matchesAnalyzed : 0

        const clanRanking: RankingEntry[] | undefined = rankings.success ? rankings.data?.[clan] : undefined
        const topManager = clanRanking && clanRanking.length > 0 ? clanRanking[0] : null

        setKpis({
          activeMembers,
          reportsCount: clanReports.length,
          matchesAnalyzed,
          totalWins,
          efectividad,
          topManager,
        })
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [clan])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
        <p className="text-sm text-muted-foreground mb-2">Miembros del Roster</p>
        <p className="text-4xl font-bold text-primary">{kpis ? kpis.activeMembers : '—'}</p>
        <p className="text-xs text-muted-foreground mt-2">Integrantes registrados</p>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
        <p className="text-sm text-muted-foreground mb-2">Reportes de Batalla</p>
        <p className="text-4xl font-bold text-primary">{kpis ? kpis.reportsCount : '—'}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {kpis ? `${kpis.matchesAnalyzed} partidos analizados` : 'Cargando...'}
        </p>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
        <p className="text-sm text-muted-foreground mb-2">Victorias Totales</p>
        <p className="text-4xl font-bold text-primary">{kpis ? kpis.totalWins : '—'}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {kpis ? `Efectividad: ${Math.round(kpis.efectividad * 100)}%` : 'Cargando...'}
        </p>
      </Card>

      <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
        <p className="text-sm text-muted-foreground mb-2">Mejor Manager (por puntos)</p>
        {kpis?.topManager ? (
          <>
            <p className="text-2xl font-bold text-primary truncate">{kpis.topManager.name}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis.topManager.pts} pts · {kpis.topManager.v}V-{kpis.topManager.e}E-{kpis.topManager.d}D · {kpis.topManager.gf} GF
            </p>
            <span
              className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium ${
                kpis.topManager.v > kpis.topManager.d
                  ? 'bg-primary/15 text-primary'
                  : kpis.topManager.v < kpis.topManager.d
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {kpis.topManager.v > kpis.topManager.d
                ? 'Ganando su liga'
                : kpis.topManager.v < kpis.topManager.d
                  ? 'Perdiendo su liga'
                  : 'Liga pareja'}
            </span>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-primary">—</p>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis ? 'Sube un reporte de batalla' : 'Cargando...'}
            </p>
          </>
        )}
      </Card>
    </div>
  )
}
