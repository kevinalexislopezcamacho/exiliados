"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
}

const CLANS: { key: keyof CommunityData; label: string }[] = [
  { key: "exiliados", label: "Exiliados" },
  { key: "rayo", label: "Rayo" },
]

export function CommunitySection() {
  const [community, setCommunity] = useState<CommunityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCommunity = async () => {
      try {
        const response = await fetch("/api/community")
        const result = await response.json()
        if (result.success) {
          setCommunity(result.data)
        }
      } catch (error) {
        console.error("Error fetching community:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCommunity()
  }, [])

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-primary text-sm tracking-[0.4em] uppercase mb-4 block">
            La Comunidad
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-4xl md:text-6xl">
            NUESTROS <span className="text-primary">CLANES</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-4xl mx-auto"
        >
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-20 rounded-lg bg-card/50 border border-border/50 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="exiliados" className="items-center gap-8">
              <TabsList className="h-11 p-1 bg-card/60 border border-border/50">
                {CLANS.map((clan) => (
                  <TabsTrigger
                    key={clan.key}
                    value={clan.key}
                    className="px-6 text-sm tracking-widest uppercase"
                  >
                    {clan.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {CLANS.map((clan) => {
                const members = community?.[clan.key] ?? []
                return (
                  <TabsContent key={clan.key} value={clan.key} className="w-full">
                    {members.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {members.map((member, index) => (
                          <motion.div
                            key={member.id}
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.04, duration: 0.35 }}
                            className="flex items-center gap-3 rounded-lg bg-card/50 border border-border/50 hover:border-primary/40 transition-colors px-4 py-3"
                          >
                            <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary font-[family-name:var(--font-display)] text-lg">
                              {member.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {member.name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {member.flag && (
                                  <span className="text-xs" aria-hidden="true">
                                    {member.flag}
                                  </span>
                                )}
                                {member.title && (
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {member.title}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                        <Users className="w-6 h-6" />
                        <p className="text-sm">Aún no hay miembros registrados en {clan.label}</p>
                      </div>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </motion.div>
      </div>
    </section>
  )
}
