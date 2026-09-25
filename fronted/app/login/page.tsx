'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login, setPassword: createPassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(username, password)
      if (result.needsPasswordSetup) {
        setNeedsPasswordSetup(true)
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword.length < 4) {
      setError('La contraseña debe tener al menos 4 caracteres')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)
    try {
      await createPassword(username, newPassword)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <Link
        href="/"
        className="fixed top-6 left-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <Card className="w-full max-w-md border-primary/20 shadow-2xl">
        <div className="p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary mb-2">EXILIADOS</h1>
            <p className="text-muted-foreground">Acceso al Portal del Clan</p>
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-6 text-sm text-destructive">
              {error}
            </div>
          )}

          {needsPasswordSetup ? (
            <>
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-6 text-sm text-primary">
                ¡Hola, {username}! Es tu primera vez por aquí — crea tu contraseña para poder entrar.
              </div>

              <form onSubmit={handleCreatePassword} className="space-y-4">
                <div>
                  <label htmlFor="new-password" className="block text-sm font-medium mb-2">
                    Nueva contraseña
                  </label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="Elige una contraseña"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={loading}
                    className="border-border/50"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
                    Confirmar contraseña
                  </label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className="border-border/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !newPassword || !confirmPassword}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
                  size="lg"
                >
                  {loading ? 'Creando...' : 'Crear contraseña y entrar'}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setNeedsPasswordSetup(false)
                    setError('')
                  }}
                  className="w-full text-xs text-muted-foreground hover:text-primary"
                >
                  ← Volver
                </button>
              </form>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium mb-2">
                    Usuario
                  </label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Tu nick"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loading}
                    className="border-border/50"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2">
                    Contraseña
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="border-border/50"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !username}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2"
                  size="lg"
                >
                  {loading ? 'Iniciando sesión...' : 'Ingresar'}
                </Button>
              </form>

              <div className="mt-8 pt-6 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-3 font-semibold">CÓMO ENTRAR:</p>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="bg-card/50 p-2 rounded">
                    <p className="font-medium">Integrante:</p>
                    <p>Usuario: tu nombre del juego (sin espacios ni acentos)</p>
                    <p>La primera vez, deja la contraseña vacía y créala cuando te lo pida</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
