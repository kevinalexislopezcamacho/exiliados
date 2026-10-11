'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, ChevronRight, ExternalLink, Search, UserSearch } from 'lucide-react'

export default function MinigamesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">Minijuegos</h1>
            <p className="text-sm text-muted-foreground">Un reto nuevo cada día · cuidá tu racha</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
                <UserSearch className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-primary">Adivina el integrante</h3>
                <p className="text-sm text-muted-foreground">
                  Hay un integrante secreto de Rayo o Exiliados. Tenés 6 intentos: cada intento te da pistas de clan,
                  nacionalidad, selección, rango, puntos y valor de equipo.
                </p>
              </div>
            </div>
            <Link href="/dashboard/minijuegos/adivina-integrante" className="mt-auto">
              <Button className="w-full justify-between">
                Jugar
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </Card>

          <Card className="p-6 border-border/50 flex flex-col">
            <div className="flex items-start gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary">
                <Search className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-primary">Ojeador (OSM Helper)</h3>
                <p className="text-sm text-muted-foreground">
                  Buscá jugadores de todas las ligas ojeables por posición, edad, rating, nacionalidad y liga.
                </p>
              </div>
            </div>
            <a href="https://osmhelper.com/scout/" target="_blank" rel="noopener noreferrer" className="mt-auto">
              <Button variant="outline" className="w-full justify-between border-primary/40 hover:bg-primary/10">
                Abrir ojeador
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">Más minijuegos próximamente.</p>
      </main>
    </div>
  )
}
