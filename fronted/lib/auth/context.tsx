'use client'

import { createContext, useContext, useState, useEffect } from 'react'

interface User {
  id: number
  username: string
  role: 'member' | 'captain'
  full_name: string
  clan: string | null
  token: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ needsPasswordSetup?: boolean }>
  setPassword: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay sesión guardada
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const login = async (username: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    const result = await response.json()

    if (result.needsPasswordSetup) {
      return { needsPasswordSetup: true }
    }

    if (!result.success) {
      throw new Error(result.error || 'Error en login')
    }

    setUser(result.data)
    localStorage.setItem('user', JSON.stringify(result.data))
    return {}
  }

  const setPassword = async (username: string, password: string) => {
    const response = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || 'Error creando la contraseña')
    }

    setUser(result.data)
    localStorage.setItem('user', JSON.stringify(result.data))
  }

  const logout = async () => {
    const token = user?.token
    
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
    }

    setUser(null)
    localStorage.removeItem('user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, setPassword, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
