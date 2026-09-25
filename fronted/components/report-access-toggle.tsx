"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { ShieldCheck, ChevronRight, Users } from "lucide-react"
import { clanLabel } from "@/lib/clans"

const CLANS: Array<"rayo" | "exiliados"> = ["rayo", "exiliados"]

interface MemberAccessRow {
  id: number
  enabled: boolean
}

export function ReportAccessToggle() {
  const [counts, setCounts] = useState<Record<string, { total: number; enabled: number }> | null>(null)

  useEffect(() => {
    let active = true
    Promise.all(
      CLANS.map((clan) =>
        fetch(`/api/report-access/${clan}`)
          .then((res) => res.json())
          .then((result) => [clan, result.success ? (result.data as MemberAccessRow[]) : []] as const)
      )
    ).then((entries) => {
      if (!active) return
      const next: Record<string, { total: number; enabled: number }> = {}
      for (const [clan, rows] of entries) {
        next[clan] = { total: rows.length, enabled: rows.filter((r) => r.enabled).length }
      }
      setCounts(next)
    })
    return () => {
      active = false
    }
  }, [])

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-lg text-primary">Acceso de Integrantes a Reportes</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Control exclusivo de chicolinas: elige un clan para habilitar o bloquear, integrante por integrante, quién
        puede ver el reporte de jornadas (análisis táctico incluido) y el de armado desde su perfil.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CLANS.map((clan) => {
          const c = counts?.[clan]
          return (
            <Link key={clan} href={`/dashboard/report-access/${clan}`}>
              <div className="flex items-center justify-between gap-3 rounded-lg bg-card/50 border border-border/50 px-4 py-3 hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{clanLabel(clan)}</p>
                    <p className="text-xs text-muted-foreground">
                      {c ? `${c.enabled}/${c.total} habilitados` : "Cargando..."}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
