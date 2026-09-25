'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Trophy, Wifi, WifiOff } from 'lucide-react'
import { clanLabel } from '@/lib/clans'

const POLL_INTERVAL_MS = 10000

interface RankingEntry {
  name: string
  flag: string
  pj: number
  v: number
  e: number
  d: number
  gf: number
  gc: number
  dif: number
  pts: number
  valorActual: number | null
  eficiencia: number | null
  meta: { met: boolean } | null
  score: number
}

function scoreColor(score: number) {
  if (score >= 65) return 'text-green-500'
  if (score <= 35) return 'text-destructive'
  return 'text-primary'
}

type RankingsData = Record<'rayo' | 'exiliados', RankingEntry[]>

const RANKED_CLANS: Array<'rayo' | 'exiliados'> = ['rayo', 'exiliados']
const COLLAPSED_COUNT = 5

export function RankingsPanel() {
  const [rankings, setRankings] = useState<RankingsData | null>(null)
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false

    const fetchRankings = async () => {
      try {
        const res = await fetch('/api/rankings')
        const result = await res.json()
        if (cancelled) return
        if (result.success) {
          setRankings(result.data)
          setConnected(true)
        } else {
          setConnected(false)
        }
      } catch {
        if (!cancelled) setConnected(false)
      }
    }

    fetchRankings()
    const interval = setInterval(fetchRankings, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg text-primary">Ranking de Puntos</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {connected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-primary" /> Actualiza cada 10s
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" /> Sin conexión
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-4 mb-6">
        Puntaje compuesto (efectividad, eficiencia de armado, valor de equipo y meta), calculado automáticamente.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {RANKED_CLANS.map((clan) => {
          const entries = rankings?.[clan] ?? []
          const isExpanded = expanded[clan] ?? false
          const visibleEntries = isExpanded ? entries : entries.slice(0, COLLAPSED_COUNT)
          const hiddenCount = entries.length - COLLAPSED_COUNT

          return (
            <div key={clan}>
              <h4 className="text-sm tracking-widest uppercase text-muted-foreground mb-3">
                {clanLabel(clan)}
              </h4>

              {rankings === null ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
                  ))}
                </div>
              ) : entries.length > 0 ? (
                <div className="space-y-2">
                  {visibleEntries.map((entry, index) => (
                    <div
                      key={entry.name}
                      className="flex items-center gap-3 rounded-lg bg-card/50 border border-border/50 px-3 py-2"
                    >
                      <span className="w-6 text-center text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {entry.flag} {entry.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.v}V - {entry.e}E - {entry.d}D · {entry.gf}-{entry.gc} · {entry.pts} pts
                          {entry.valorActual !== null && ` · ${Math.round(entry.valorActual)}M`}
                          {entry.eficiencia !== null && ` · Efic. ${Math.round(entry.eficiencia * 100)}%`}
                          {entry.meta && (
                            <>
                              {' · meta '}
                              <span className={entry.meta.met ? 'text-green-500 font-medium' : 'text-destructive font-medium'}>
                                {entry.meta.met ? 'SI' : 'NO'}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className={`shrink-0 text-sm font-bold ${scoreColor(entry.score)}`}>{entry.score}</span>
                    </div>
                  ))}

                  {hiddenCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded((prev) => ({ ...prev, [clan]: !isExpanded }))}
                      className="w-full gap-1.5 text-xs text-muted-foreground hover:text-primary"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-3.5 h-3.5" /> Ver menos
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3.5 h-3.5" /> Ver {hiddenCount} más
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-lg">
                  Sin datos todavía — sube un reporte de batalla de {clanLabel(clan)}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
