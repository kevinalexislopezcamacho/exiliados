"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Coins } from "lucide-react"
import { clanLabel } from "@/lib/clans"

interface SquadRankingEntry {
  usuario: string
  valorActual: number | null
  eficiencia: number | null
  compras: number | null
  ventas: number | null
}

type SquadRankingsData = Record<'rayo' | 'exiliados', SquadRankingEntry[]>

const CLANS: Array<'rayo' | 'exiliados'> = ['rayo', 'exiliados']
const TOP = 10

export function SquadRankingsPanel() {
  const [data, setData] = useState<SquadRankingsData | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/rankings/squads")
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setData(result.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Coins className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg text-primary">Top Valor de Equipo</h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CLANS.map((clan) => {
          const entries = (data?.[clan] ?? []).slice(0, TOP)
          return (
            <div key={clan}>
              <h4 className="text-sm tracking-widest uppercase text-muted-foreground mb-3">{clanLabel(clan)}</h4>
              {data === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
                  ))}
                </div>
              ) : entries.length > 0 ? (
                <div className="space-y-2">
                  {entries.map((entry, index) => (
                    <div
                      key={entry.usuario}
                      className="flex items-center gap-3 rounded-lg bg-card/50 border border-border/50 px-3 py-2"
                    >
                      <span className="w-6 text-center text-sm font-bold text-primary">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{entry.usuario}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.valorActual !== null ? `${Math.round(entry.valorActual)}M` : '—'} · Eficiencia{' '}
                          {entry.eficiencia !== null ? `${Math.round(entry.eficiencia * 100)}%` : '—'} · {entry.compras ?? 0} compras /{' '}
                          {entry.ventas ?? 0} ventas
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-lg">
                  Sube un reporte de armado de {clanLabel(clan)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
