"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface Kpis {
  activeMembers: number
  reportsCount: number
  matchesAnalyzed: number
  totalWins: number
  efectividad: number
  topManagers: { rayo: RankingEntry | null; exiliados: RankingEntry | null }
}

interface CommunityData {
  exiliados: Array<{ id: number }>
  rayo: Array<{ id: number }>
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

        // El top manager se muestra de AMBOS clanes siempre, sin importar de
        // cuál sea capitán quien está mirando (antes solo veía el de su clan).
        const rayoRanking: RankingEntry[] | undefined = rankings.success ? rankings.data?.rayo : undefined
        const exiliadosRanking: RankingEntry[] | undefined = rankings.success ? rankings.data?.exiliados : undefined

        setKpis({
          activeMembers,
          reportsCount: clanReports.length,
          matchesAnalyzed,
          totalWins,
          efectividad,
          topManagers: {
            rayo: rayoRanking && rayoRanking.length > 0 ? rayoRanking[0] : null,
            exiliados: exiliadosRanking && exiliadosRanking.length > 0 ? exiliadosRanking[0] : null,
          },
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
        <p className="text-sm text-muted-foreground mb-3">Mejor Manager (por puntos)</p>
        <div className="space-y-3">
          {([
            { label: 'Exiliados', entry: kpis?.topManagers.exiliados ?? null },
            { label: 'Rayo', entry: kpis?.topManagers.rayo ?? null },
          ] as const).map(({ label, entry }) => (
            <div key={label} className={label !== 'Rayo' ? 'pb-3 border-b border-border/50' : ''}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
              {entry ? (
                <>
                  <p className="text-lg font-bold text-primary truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.pts} pts · {entry.v}V-{entry.e}E-{entry.d}D
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">{kpis ? 'Sin reportes todavía' : 'Cargando...'}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
