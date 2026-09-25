"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { clanLabel } from "@/lib/clans"
import { Users } from "lucide-react"

interface ClanMember {
  id: number
  name: string
  flag: string
  title: string
}

interface CommunityData {
  exiliados: ClanMember[]
  rayo: ClanMember[]
  chispa: ClanMember[]
}

const ROLE_ORDER = [
  "Capitán",
  "Seleccionador",
  "Seleccionado mayor",
  "Selección mayor",
  "Ex seleccionado mayor",
  "Sub 21",
  "Ex sub 21",
]

function roleWeight(title: string): number {
  if (!title) return ROLE_ORDER.length + 1
  const idx = ROLE_ORDER.findIndex((role) => title.includes(role))
  return idx === -1 ? ROLE_ORDER.length : idx
}

export function ClanRoster({ clan }: { clan: string }) {
  const [community, setCommunity] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch("/api/community")
      .then((res) => res.json())
      .then((result) => {
        if (active && result.success) setCommunity(result.data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const key = clan as keyof CommunityData
  const members = [...(community?.[key] ?? [])].sort((a, b) => {
    const diff = roleWeight(a.title) - roleWeight(b.title)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  return (
    <Card className="p-6 border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg text-primary">Roster · Clan {clanLabel(clan)}</h3>
        {!loading && <span className="text-sm text-muted-foreground">{members.length} integrantes</span>}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-16 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : members.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-3 rounded-lg bg-card/50 border border-border/30 hover:border-primary/40 transition-colors px-3 py-2.5"
            >
              <div className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                  <span className="truncate">{member.name}</span>
                  {member.flag && <span aria-hidden="true">{member.flag}</span>}
                </p>
                {member.title && (
                  <Badge
                    variant="outline"
                    className="mt-0.5 text-[10px] px-1.5 py-0 border-primary/30 text-muted-foreground font-normal"
                  >
                    {member.title}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
          <Users className="w-6 h-6" />
          <p className="text-sm">Aún no hay miembros registrados</p>
        </div>
      )}
    </Card>
  )
}
