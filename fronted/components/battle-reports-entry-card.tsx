"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, ChevronRight } from "lucide-react"

export function BattleReportsEntryCard() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/battle-reports")
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setCount(result.data.length)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-transparent border-primary/30">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-primary">Reportes de Batalla</h3>
            <p className="text-sm text-muted-foreground">
              {count === null ? "Cargando..." : `${count} ${count === 1 ? "reporte analizado" : "reportes analizados"}`}
            </p>
          </div>
        </div>
      </div>

      <Link href="/dashboard/battles" className="mt-4 block">
        <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
          Ver reportes y estadísticas
          <ChevronRight className="w-4 h-4" />
        </Button>
      </Link>
    </Card>
  )
}
