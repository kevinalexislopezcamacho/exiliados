"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"

interface Warrior {
  id: number
  name: string
  role: string
  rank: string
  nationality: string
  countryCode: string
  flag: string
  initial: string
  imageUrl: string
}

export function WarriorsSection() {
  const [warriors, setWarriors] = useState<Warrior[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWarriors = async () => {
      try {
        const response = await fetch("/api/warriors")
        const result = await response.json()
        if (result.success) {
          setWarriors(result.data)
        }
      } catch (error) {
        console.error("Error fetching warriors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchWarriors()
  }, [])

  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[40vw] font-[family-name:var(--font-display)] text-foreground select-none">
          武
        </div>
      </div>
      
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <span className="text-primary text-sm tracking-[0.4em] uppercase mb-4 block">
            El Comando
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-5xl md:text-7xl">
            NUESTROS
            <br />
            <span className="text-primary">GUERREROS</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {loading ? (
            // Skeleton loading state
            Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="aspect-[3/4] bg-gradient-to-b from-card to-secondary rounded-lg border border-border animate-pulse"
              />
            ))
          ) : warriors.length > 0 ? (
            warriors.map((warrior, index) => (
              <motion.div
                key={warrior.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group relative"
              >
                <div className="relative aspect-[3/4] bg-gradient-to-b from-card to-secondary rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-500">
                  {/* Foto del manager, o la inicial como respaldo si no hay foto */}
                  {warrior.imageUrl ? (
                    <Image
                      src={warrior.imageUrl}
                      alt={warrior.name}
                      fill
                      className="object-cover object-top scale-125 group-hover:scale-[1.35] transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-[180px] font-bold text-border/20 select-none group-hover:text-primary/10 transition-colors duration-500">
                        {warrior.initial}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-6 bg-gradient-to-t from-background via-background/80 to-transparent">
                    <div className="flex items-center gap-3 mb-2">
                      {warrior.rank && (
                        <span className="text-primary text-xs tracking-[0.3em] uppercase">
                          {warrior.rank}
                        </span>
                      )}
                      <span
                        className="text-2xl leading-none"
                        title={warrior.nationality}
                        aria-label={warrior.nationality}
                      >
                        {warrior.flag}
                      </span>
                    </div>
                    <h3 className="font-[family-name:var(--font-display)] text-3xl text-foreground mb-1">
                      {warrior.role}
                    </h3>
                    <p className="text-foreground font-medium">
                      {warrior.name}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {warrior.nationality}
                    </p>
                  </div>
                  
                  {/* Hover accent */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                </div>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No warriors found
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
