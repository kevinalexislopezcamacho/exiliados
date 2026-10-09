"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Trophy } from "lucide-react"
import { clanLabel } from "@/lib/clans"
import { ManagerProfilePopup } from "@/components/manager-profile-popup"

interface GeneralEntry {
  name: string
  clan: string | null
  flag: string
  pj: number | null
  pts: number | null
  efectividad: number | null
  valorActual: number | null
  eficiencia: number | null
  compras: number | null
  meta: { met: boolean } | null
  score: number
}

function scoreColor(score: number) {
  if (score >= 65) return 'text-green-500'
  if (score <= 35) return 'text-destructive'
  return 'text-foreground'
}

const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export function GeneralRankingPanel() {
  const [entries, setEntries] = useState<GeneralEntry[] | null>(null)
  const [period, setPeriod] = useState<'all' | 'month'>('all')
  const currentMonthLabel = MONTH_NAMES[new Date().getMonth()]

  useEffect(() => {
    let active = true
    setEntries(null)
    const qs = period === 'month' ? '?period=month' : ''
    fetch(`/api/rankings/general${qs}`)
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setEntries(result.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [period])

  const top = entries?.slice(0, 10) ?? []

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg text-primary">Ranking General</h3>
        </div>
        <div className="flex rounded-md border border-border overflow-hidden">
          {[
            { key: 'all' as const, label: 'Histórico' },
            { key: 'month' as const, label: 'Este mes' },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                period === opt.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Rayo + Exiliados combinados — puntaje compuesto: 40% efectividad de liga, 25% eficiencia de armado, 20% valor
        de equipo, 15% meta cumplida
        {period === 'month' && ` · solo batallas con fecha de inicio en ${currentMonthLabel}`}
      </p>

      {entries === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border/50 rounded-lg">
          {period === 'month'
            ? `Ningún reporte de batalla tiene fecha de inicio en ${currentMonthLabel} todavía. Editá un reporte para agregarle la fecha.`
            : 'Sube reportes de jornadas o de armado para ver el ranking general'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr className="text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium">#</th>
                <th className="px-3 py-2 text-left font-medium">Manager</th>
                <th className="px-3 py-2 text-left font-medium">Clan</th>
                <th className="px-3 py-2 text-center font-medium">Puntaje</th>
                <th className="px-3 py-2 text-center font-medium">Efect.</th>
                <th className="px-3 py-2 text-center font-medium">PTS</th>
                <th className="px-3 py-2 text-center font-medium">Valor</th>
                <th className="px-3 py-2 text-center font-medium">Eficiencia</th>
                <th className="px-3 py-2 text-center font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {top.map((entry, i) => (
                <tr key={entry.name} className="border-b border-border/50">
                  <td className="px-3 py-2 font-bold text-primary">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">
                    {entry.clan ? (
                      <ManagerProfilePopup clan={entry.clan} name={entry.name}>
                        <button className="hover:text-primary hover:underline text-left">
                          {entry.flag} {entry.name}
                        </button>
                      </ManagerProfilePopup>
                    ) : (
                      <>
                        {entry.flag} {entry.name}
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.clan ? clanLabel(entry.clan) : '—'}</td>
                  <td className={`px-3 py-2 text-center font-bold ${scoreColor(entry.score)}`}>{entry.score}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.efectividad !== null ? `${Math.round(entry.efectividad * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">{entry.pts ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{entry.valorActual !== null ? `${Math.round(entry.valorActual)}M` : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {entry.eficiencia !== null ? `${Math.round(entry.eficiencia * 100)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {entry.meta ? (
                      <span className={entry.meta.met ? 'text-green-500 font-medium' : 'text-destructive font-medium'}>
                        {entry.meta.met ? 'SI' : 'NO'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
