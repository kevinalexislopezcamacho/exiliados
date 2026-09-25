'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, X, Edit2, Trash } from 'lucide-react'

interface Member {
  id: number
  username: string
  full_name: string
  role: 'member' | 'captain'
  created_at: string
}

export function MembersManagement() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    password: '',
    role: 'captain'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchMembers()
  }, [])

  const fetchMembers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/members')
      const result = await response.json()
      if (result.success) {
        setMembers(result.data)
      }
    } catch (err) {
      setError('Error cargando miembros')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.username || !formData.role) {
      setError('Usuario y rol requeridos')
      return
    }

    if (!editingId && !formData.password) {
      setError('Contraseña requerida para nuevo miembro')
      return
    }

    try {
      const url = editingId ? `/api/members/${editingId}` : '/api/members'
      const method = editingId ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error)
      }

      setSuccess(editingId ? 'Miembro actualizado' : 'Miembro creado')
      resetForm()
      fetchMembers()
      setTimeout(() => setShowForm(false), 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando miembro')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este miembro?')) return

    try {
      const response = await fetch(`/api/members/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!result.success) throw new Error(result.error)

      setSuccess('Miembro eliminado')
      fetchMembers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando miembro')
    }
  }

  const handleEdit = (member: Member) => {
    setEditingId(member.id)
    setFormData({
      username: member.username,
      full_name: member.full_name,
      password: '',
      role: member.role
    })
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({ username: '', full_name: '', password: '', role: 'captain' })
    setEditingId(null)
    setError('')
    setSuccess('')
  }

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <div className="inline-block">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-primary">Gestión de Capitanes</h3>
        <Button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="bg-primary hover:bg-primary/90 gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Capitán
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-primary text-sm">
          {success}
        </div>
      )}

      {showForm && (
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Usuario</label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Nombre Completo</label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Contraseña</label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder={editingId ? '(dejar en blanco para no cambiar)' : '(requerida)'}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                {editingId ? 'Actualizar' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm()
                  setShowForm(false)
                }}
                className="px-4 py-2 border border-border rounded hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left font-medium">Usuario</th>
                <th className="px-6 py-3 text-left font-medium">Nombre</th>
                <th className="px-6 py-3 text-left font-medium">Rol</th>
                <th className="px-6 py-3 text-left font-medium">Creado</th>
                <th className="px-6 py-3 text-left font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-border hover:bg-muted/50">
                  <td className="px-6 py-3">{member.username}</td>
                  <td className="px-6 py-3">{member.full_name}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${member.role === 'captain' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {member.role === 'captain' ? 'Capitán' : 'Miembro'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-muted-foreground">
                    {new Date(member.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3 flex gap-2">
                    <button
                      onClick={() => handleEdit(member)}
                      className="p-1 hover:bg-muted rounded"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4 text-primary" />
                    </button>
                    <button
                      onClick={() => handleDelete(member.id)}
                      className="p-1 hover:bg-muted rounded"
                      title="Eliminar"
                    >
                      <Trash className="w-4 h-4 text-destructive" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// Export default for interop
export default MembersManagement
