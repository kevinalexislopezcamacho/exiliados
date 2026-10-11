"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronRight, Flame, Gamepad2 } from "lucide-react"

export function MinigamesEntryCard() {
  const [finished, setFinished] = useState<boolean | null>(null)
  const [streak, setStreak] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([
      fetch("/api/minigames/adivina-integrante").then((r) => r.json()),
      fetch("/api/minigames/adivina-integrante/stats").then((r) => r.json()),
    ])
      .then(([state, stats]) => {
        if (!active) return
        if (state.success) setFinished(!!state.data.finished)
        if (stats.success) setStreak(stats.data.currentStreak)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

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
              {finished === null ? "Cargando..." : finished ? "Ya jugaste el reto de hoy" : "Hay un reto nuevo esperándote"}
            </p>
          </div>
        </div>
        {streak !== null && streak > 0 && (
          <span className="flex items-center gap-1 text-sm font-bold text-amber-500" title="Racha actual">
            <Flame className="w-4 h-4" /> {streak}
          </span>
        )}
      </div>

      <Link href="/dashboard/minijuegos" className="mt-4 block">
        <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
          {finished ? "Ver minijuegos" : "Jugar el reto de hoy"}
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </Card>
  )
}
