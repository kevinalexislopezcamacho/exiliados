'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'

// Los invitados solo entran al Mundial y a los minijuegos (el backend igual
// les rechaza todo lo demás); cualquier otra página los manda al dashboard.
const GUEST_SECTIONS = ['/dashboard/torneo', '/dashboard/minijuegos']

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const blocked =
    user?.role === 'guest' &&
    pathname !== '/dashboard' &&
    !GUEST_SECTIONS.some((section) => pathname === section || pathname.startsWith(`${section}/`))

  useEffect(() => {
    if (blocked) router.replace('/dashboard')
  }, [blocked, router])

  if (blocked) return null
  return <>{children}</>
}
