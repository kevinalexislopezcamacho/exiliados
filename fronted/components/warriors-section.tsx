"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

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
  // Carta "Conociendo al jugador": se muestra completa, sin recortar.
  cardUrl: string
  clan: string | null
}

type NotesState =
  | { status: "loading" }
  | { status: "ok"; notes: string }
  | { status: "login" }
  | { status: "none" }

// Ventana al hacer clic en un guerrero: la carta completa (o la foto si
// todavía no tiene carta) y abajo las notas. Las notas solo se ven con
// sesión iniciada, igual que en el resto del sitio.
function WarriorDialog({ warrior, onClose }: { warrior: Warrior | null; onClose: () => void }) {
  const [notes, setNotes] = useState<NotesState>({ status: "loading" })

  useEffect(() => {
    if (!warrior) return
    if (!warrior.clan) {
      setNotes({ status: "none" })
      return
    }
    setNotes({ status: "loading" })
    let active = true
    fetch(`/api/clan-members/profile?clan=${warrior.clan}&name=${encodeURIComponent(warrior.name)}`)
      .then(async (res) => {
        if (!active) return
        if (res.status === 401) return setNotes({ status: "login" })
        const result = await res.json()
        setNotes(result.success ? { status: "ok", notes: result.data.notes ?? "" } : { status: "none" })
      })
      .catch(() => active && setNotes({ status: "none" }))
    return () => {
      active = false
    }
  }, [warrior])

  return (
    <Dialog open={!!warrior} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto p-4 gap-4">
        {warrior && (
          <>
            <DialogTitle className="sr-only">{warrior.name}</DialogTitle>
            {warrior.cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={warrior.cardUrl} alt={`Carta de ${warrior.name}`} className="w-full h-auto rounded-md" />
            ) : (
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-md bg-gradient-to-b from-card to-secondary">
                {warrior.imageUrl ? (
                  <Image src={warrior.imageUrl} alt={warrior.name} fill className="object-cover object-top" />
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center text-[160px] font-bold text-border/30">
                    {warrior.initial}
                  </span>
                )}
                <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-background to-transparent">
                  <p className="text-primary text-xs tracking-[0.3em] uppercase">{warrior.role}</p>
                  <p className="text-xl font-bold">
                    {warrior.name} <span title={warrior.nationality}>{warrior.flag}</span>
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-md border border-border bg-card/60 p-4">
              <h3 className="text-sm font-bold text-primary tracking-widest uppercase mb-2">Notas</h3>
              {notes.status === "loading" && <div className="h-10 rounded bg-muted/40 animate-pulse" />}
              {notes.status === "ok" && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes.notes || "Sin notas todavía."}</p>
              )}
              {notes.status === "login" && (
                <p className="text-sm text-muted-foreground">Iniciá sesión para ver las notas de los integrantes.</p>
              )}
              {notes.status === "none" && <p className="text-sm text-muted-foreground">Sin notas todavía.</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function WarriorsSection() {
  const [warriors, setWarriors] = useState<Warrior[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Warrior | null>(null)

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
                <button
                  type="button"
                  onClick={() => setSelected(warrior)}
                  className="relative block w-full text-left aspect-[3/4] bg-gradient-to-b from-card to-secondary rounded-lg overflow-hidden border border-border hover:border-primary/50 transition-all duration-500 cursor-pointer"
                  aria-label={`Ver a ${warrior.name}`}
                >
                  {warrior.cardUrl ? (
                    // La carta ya trae nombre, país y rol: se muestra entera,
                    // sin recortar y sin texto encima.
                    <Image
                      src={warrior.cardUrl}
                      alt={`Carta de ${warrior.name}`}
                      fill
                      className="object-contain bg-black group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  ) : (
                    <>
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
                    </>
                  )}

                  {/* Hover accent */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                </button>
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No warriors found
            </div>
          )}
        </div>
      </div>

      <WarriorDialog warrior={selected} onClose={() => setSelected(null)} />
    </section>
  )
}
