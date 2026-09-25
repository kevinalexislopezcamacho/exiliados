"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, FileSpreadsheet, Coins, ChevronRight } from "lucide-react"

export function MemberReportsAccessCard({ clan }: { clan: string }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    fetch("/api/report-access/me")
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setUnlocked(!!result.data.enabled)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [clan])

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center gap-2 mb-1">
        {unlocked ? <Unlock className="w-5 h-5 text-green-500" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
        <h3 className="font-bold text-lg text-primary">Reportes de Batalla y Armado</h3>
      </div>

      {unlocked === null ? (
        <p className="text-sm text-muted-foreground mt-2">Cargando...</p>
      ) : !unlocked ? (
        <p className="text-sm text-muted-foreground mt-2">
          🔒 Bloqueado por tu capitán. Todavía no tienes acceso a los reportes de jornadas ni de armado.
        </p>
      ) : (
        <>
          <p className="text-sm text-green-500 mt-2 mb-4">🔓 Desbloqueado — tu capitán te dio acceso.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link href="/dashboard/battles">
              <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
                <span className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Reportes de Jornadas
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/dashboard/squads">
              <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
                <span className="flex items-center gap-2">
                  <Coins className="w-4 h-4" /> Reportes de Armado
                </span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </Card>
  )
}
