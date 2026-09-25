'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { clanLabel } from '@/lib/clans'
import { ExternalResources } from '@/components/external-resources'
import dynamic from 'next/dynamic'

// Load component client-side to avoid build-time export mismatches
const MembersManagement = dynamic(() => import('@/components/members-management'), { ssr: false })
const RankingsPanel = dynamic(() => import('@/components/rankings-panel').then((m) => m.RankingsPanel), { ssr: false })
const ClanRoster = dynamic(() => import('@/components/clan-roster').then((m) => m.ClanRoster), { ssr: false })
const RosterManagement = dynamic(() => import('@/components/roster-management').then((m) => m.RosterManagement), { ssr: false })
const BattleReportsEntryCard = dynamic(
  () => import('@/components/battle-reports-entry-card').then((m) => m.BattleReportsEntryCard),
  { ssr: false }
)
const CaptainKpis = dynamic(() => import('@/components/captain-kpis').then((m) => m.CaptainKpis), { ssr: false })
const MemberStats = dynamic(() => import('@/components/member-stats').then((m) => m.MemberStats), { ssr: false })
const SquadReportsEntryCard = dynamic(
  () => import('@/components/squad-reports-entry-card').then((m) => m.SquadReportsEntryCard),
  { ssr: false }
)
const SquadRankingsPanel = dynamic(
  () => import('@/components/squad-rankings-panel').then((m) => m.SquadRankingsPanel),
  { ssr: false }
)
const GeneralRankingPanel = dynamic(
  () => import('@/components/general-ranking-panel').then((m) => m.GeneralRankingPanel),
  { ssr: false }
)
const GameEventsEntryCard = dynamic(
  () => import('@/components/game-events-entry-card').then((m) => m.GameEventsEntryCard),
  { ssr: false }
)
const RecentReportsCard = dynamic(
  () => import('@/components/recent-reports-card').then((m) => m.RecentReportsCard),
  { ssr: false }
)
const ReportAccessToggle = dynamic(
  () => import('@/components/report-access-toggle').then((m) => m.ReportAccessToggle),
  { ssr: false }
)
const MemberReportsAccessCard = dynamic(
  () => import('@/components/member-reports-access-card').then((m) => m.MemberReportsAccessCard),
  { ssr: false }
)

export default function DashboardPage() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">EXILIADOS</h1>
            <p className="text-sm text-muted-foreground">
              Dashboard del Clan
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end sm:gap-4">
            <div className="text-right">
              <p className="font-medium text-foreground">{user.full_name}</p>
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <span className="capitalize">{user.role === 'captain' ? 'Capitán' : 'Miembro'}</span>
                <Badge variant="outline" className="border-primary/40 text-primary">
                  Clan {clanLabel(user.clan)}
                </Badge>
              </div>
            </div>

            <Button
              onClick={handleLogout}
              variant="outline"
              className="border-primary/50 hover:bg-destructive/10"
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {user.role === 'captain' ? (
          <CaptainDashboard user={user} />
        ) : (
          <MemberDashboard user={user} />
        )}
      </main>
    </div>
  )
}

function MemberDashboard({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Bienvenido, {user.full_name}</h2>
        <p className="text-muted-foreground">
          Eres parte del clan <span className="text-primary font-medium">{clanLabel(user.clan)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card: Perfil */}
        <Card className="p-6 border-primary/20 hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-lg mb-4 text-primary">Mi Perfil</h3>
          <div className="space-y-2">
            <p className="text-sm"><span className="text-muted-foreground">Nick:</span> {user.username}</p>
            <p className="text-sm"><span className="text-muted-foreground">Nombre:</span> {user.full_name}</p>
            <p className="text-sm"><span className="text-muted-foreground">Rol:</span> Miembro</p>
            <p className="text-sm"><span className="text-muted-foreground">Clan:</span> {clanLabel(user.clan)}</p>
          </div>
        </Card>

        {/* Card: Notificaciones */}
        <Card className="p-6 border-primary/20 hover:border-primary/50 transition-colors">
          <h3 className="font-bold text-lg mb-4 text-primary">Notificaciones</h3>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">No hay nuevas notificaciones</p>
          </div>
        </Card>

        {/* Mis Estadísticas + Mis Últimos Partidos: reales, de los reportes de batalla */}
        <MemberStats />
      </div>

      {/* Reportes de jornadas/armado, si el capitán habilitó el acceso */}
      <MemberReportsAccessCard clan={user.clan} />

      {/* Roster completo del clan */}
      <ClanRoster clan={user.clan} />

      <GameEventsEntryCard />

      <ExternalResources />
    </div>
  )
}

function CaptainDashboard({ user }: { user: any }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-primary mb-2">Panel de Capitán</h2>
        <p className="text-muted-foreground">
          Bienvenido, {user.full_name} · Clan <span className="text-primary font-medium">{clanLabel(user.clan)}</span>
        </p>
      </div>

      <CaptainKpis clan={user.clan} />

      <ExternalResources />

      <GameEventsEntryCard />

      {/* Reportes de Batalla / Armado (módulos aparte) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <BattleReportsEntryCard />
        <SquadReportsEntryCard />
      </div>

      {/* Ranking de puntos (solo capitanes) */}
      <RankingsPanel />

      {/* Top valor de equipo (armado) */}
      <SquadRankingsPanel />

      {/* Ranking general: Rayo + Exiliados combinados */}
      <GeneralRankingPanel />

      {/* Roster completo del clan: aquí el capitán puede editar/agregar/borrar
          integrantes y, si es de Rayo, ascenderlos a Exiliados */}
      <RosterManagement clan={user.clan} isSuperAdmin={user.username === 'chicolinas'} />

      {/* Management Sections */}
      <MembersManagement />

      {/* Solo chicolinas puede prender/apagar el acceso de integrantes */}
      {user.username === 'chicolinas' && <ReportAccessToggle />}

      {/* Reportes */}
      <RecentReportsCard clan={user.clan} />
    </div>
  )
}
