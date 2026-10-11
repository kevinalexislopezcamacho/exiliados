'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Trophy } from 'lucide-react'

interface LeaderboardEntry {
  name: string
  played: number
  wins: number
  currentStreak: number
  maxStreak: number
}

export interface MinigameStatsData {
  kind: 'guess-member' | 'quiz' | 'wordle'
  played: number
  wins: number
  losses: number
  winRate: number
  currentStreak: number
  maxStreak: number
  distribution: number[]
  leaderboard: LeaderboardEntry[]
}

// Estadísticas del jugador + ranking del clan para un minijuego. refreshKey
// se cambia desde afuera cuando termina una partida para recargarlas.
export function MinigameStats({ game, refreshKey }: { game: string; refreshKey: number }) {
  const [stats, setStats] = useState<MinigameStatsData | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/minigames/${game}/stats`)
      .then((r) => r.json())
      .then((r) => {
        if (active && r.success) setStats(r.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [game, refreshKey])

  if (!stats) return null

  const isQuiz = stats.kind === 'quiz'
  const maxDistribution = Math.max(1, ...stats.distribution)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-6">
        <h3 className="font-bold text-lg text-primary mb-4">Tus estadísticas</h3>
        <div className="grid grid-cols-3 gap-3 text-center mb-5">
          <div>
            <p className="text-2xl font-bold">{stats.played}</p>
            <p className="text-[11px] text-muted-foreground">Jugadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-500">{stats.wins}</p>
            <p className="text-[11px] text-muted-foreground">Ganadas</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{stats.losses}</p>
            <p className="text-[11px] text-muted-foreground">Perdidas</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{Math.round(stats.winRate * 100)}%</p>
            <p className="text-[11px] text-muted-foreground">% victorias</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-500">{stats.currentStreak}</p>
            <p className="text-[11px] text-muted-foreground">Racha actual</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.maxStreak}</p>
            <p className="text-[11px] text-muted-foreground">Mejor racha</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {isQuiz ? 'Respuestas correctas por partida' : 'Intentos para acertar'}
        </p>
        <div className="space-y-1">
          {stats.distribution.map((count, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-3 text-muted-foreground">{isQuiz ? i : i + 1}</span>
              <div
                className="h-5 rounded bg-primary/70 text-primary-foreground flex items-center justify-end px-1.5 font-medium min-w-[1.5rem]"
                style={{ width: `${(count / maxDistribution) * 100}%` }}
              >
                {count}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="font-bold text-lg text-primary mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5" /> Ranking del clan
        </h3>
        {stats.leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía nadie terminó este reto. ¡Sé el primero!</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[11px] text-muted-foreground uppercase">
              <tr>
                <th className="text-left py-1">#</th>
                <th className="text-left py-1">Integrante</th>
                <th className="text-center py-1">Racha</th>
                <th className="text-center py-1">Ganadas</th>
                <th className="text-center py-1">Mejor</th>
              </tr>
            </thead>
            <tbody>
              {stats.leaderboard.map((e, i) => (
                <tr key={e.name} className="border-t border-border/50">
                  <td className="py-1.5 font-bold text-primary">{i + 1}</td>
                  <td className="py-1.5 truncate max-w-[10rem]">{e.name}</td>
                  <td className="py-1.5 text-center font-bold text-amber-500">🔥 {e.currentStreak}</td>
                  <td className="py-1.5 text-center">
                    {e.wins}/{e.played}
                  </td>
                  <td className="py-1.5 text-center text-muted-foreground">{e.maxStreak}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// Cuenta regresiva hasta el próximo reto (hh:mm:ss).
export function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!target) return ''
  const diff = Math.max(0, new Date(target).getTime() - now)
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
