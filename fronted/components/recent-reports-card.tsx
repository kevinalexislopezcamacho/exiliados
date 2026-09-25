"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"

interface BattleReportListItem {
  id: number
  clan: string
  title: string
  opponent: string
  createdAt: string
  summary: { pj: number; v: number; e: number; d: number; gf: number; gc: number }
}

interface RankingEntry {
  name: string
  v: number
}

interface Summary {
  lastReport: BattleReportListItem | null
  totalPj: number
  totalV: number
  topScorer: RankingEntry | null
}

export function RecentReportsCard({ clan }: { clan: string }) {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch("/api/battle-reports").then((r) => r.json()),
      fetch("/api/rankings").then((r) => r.json()),
    ])
      .then(([reports, rankings]) => {
        if (!active) return

        const clanReports: BattleReportListItem[] = reports.success
          ? reports.data
              .filter((r: BattleReportListItem) => r.clan === clan)
              .sort((a: BattleReportListItem, b: BattleReportListItem) => (a.createdAt < b.createdAt ? 1 : -1))
          : []

        const lastReport = clanReports[0] ?? null
        const totalPj = clanReports.reduce((sum, r) => sum + r.summary.pj, 0)
        const totalV = clanReports.reduce((sum, r) => sum + r.summary.v, 0)

        const clanRanking: RankingEntry[] = rankings.success ? rankings.data?.[clan] ?? [] : []
        const topScorer = clanRanking.length
          ? [...clanRanking].sort((a, b) => b.v - a.v)[0]
          : null

        setSummary({ lastReport, totalPj, totalV, topScorer })
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [clan])

  return (
    <Card className="p-6 border-primary/20">
      <h3 className="font-bold text-lg mb-4 text-primary">Reportes Recientes</h3>

      {!summary ? (
        <p className="text-sm text-muted-foreground">Cargando...</p>
      ) : !summary.lastReport ? (
        <p className="text-sm text-muted-foreground">Todavía no has subido ningún reporte de batalla.</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            ✓ Último reporte: <span className="text-foreground">{summary.lastReport.title}</span> —{" "}
            {summary.lastReport.summary.gf}-{summary.lastReport.summary.gc} (
            {summary.lastReport.summary.v}V-{summary.lastReport.summary.e}E-{summary.lastReport.summary.d}D)
          </p>
          <p className="text-sm text-muted-foreground">
            ✓ Tasa de Victoria: {summary.totalPj > 0 ? Math.round((summary.totalV / summary.totalPj) * 100) : 0}% (
            {summary.totalV}/{summary.totalPj} partidos)
          </p>
          <p className="text-sm text-muted-foreground">
            ✓ Manager con más victorias:{" "}
            {summary.topScorer ? `${summary.topScorer.name} (${summary.topScorer.v} victorias)` : "—"}
          </p>
        </div>
      )}
    </Card>
  )
}
