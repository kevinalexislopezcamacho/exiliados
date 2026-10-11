"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight, Flame, Gamepad2 } from "lucide-react"

interface Summary {
  finishedToday: number
  dailyStreak: number
  games: { available: boolean }[]
}

export function MinigamesEntryCard() {
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/minigames")
      .then((r) => r.json())
      .then((r) => {
        if (active && r.success) setSummary(r.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const total = summary ? summary.games.filter((g) => g.available).length : 0
  const allDone = !!summary && total > 0 && summary.finishedToday >= total

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-primary">Minijuegos</h3>
            <p className="text-sm text-muted-foreground">
              {!summary
                ? "Cargando..."
                : allDone
                  ? "Ya jugaste todos los retos de hoy"
                  : `${summary.finishedToday}/${total} retos de hoy terminados`}
            </p>
          </div>
        </div>
        {summary && summary.dailyStreak > 0 && (
          <span className="flex items-center gap-1 text-sm font-bold text-amber-500" title="Días seguidos jugando">
            <Flame className="w-4 h-4" /> {summary.dailyStreak}
          </span>
        )}
      </div>

      <Link href="/dashboard/minijuegos" className="mt-4 block">
        <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
          {allDone ? "Ver minijuegos" : "Jugar los retos de hoy"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </Card>
  )
}
