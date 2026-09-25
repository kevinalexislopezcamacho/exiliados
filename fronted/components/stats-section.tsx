"use client"

import { motion } from "framer-motion"
import { Trophy, Users, Target, Flame } from "lucide-react"
import { useEffect, useState } from "react"

interface Stat {
  value: string
  label: string
  icon: string
  delay: number
}

const iconMap: Record<string, any> = {
  Trophy,
  Users,
  Target,
  Flame,
}

export function StatsSection() {
  const [stats, setStats] = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats")
        const result = await response.json()
        if (result.success) {
          setStats(result.data)
        }
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <section className="relative py-20 overflow-hidden">
      {/* Diagonal stripe background */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
      
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50 border border-border/50 animate-pulse h-32"
              />
            ))
          ) : (
            stats.map((stat, index) => {
              const IconComponent = iconMap[stat.icon]
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: stat.delay, duration: 0.5 }}
                  className="relative group"
                >
                  <div className="flex flex-col items-center text-center p-6 rounded-lg bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300">
                    <div className="mb-4 p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      {IconComponent ? (
                        <IconComponent className="w-8 h-8 text-primary" />
                      ) : (
                        <div className="w-8 h-8" />
                      )}
                    </div>
                    <span className="font-[family-name:var(--font-display)] text-4xl md:text-5xl text-foreground mb-2">
                      {stat.value}
                    </span>
                    <span className="text-muted-foreground text-sm tracking-widest uppercase">
                      {stat.label}
                    </span>
                  </div>
                  
                  {/* Corner accent */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </section>
  )
}
