'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Check, Pencil, Plus, Trash2, X } from 'lucide-react'

type Category = 'futbol' | 'osm' | 'competencias'

interface Question {
  id: number
  category: Category
  question: string
  options: string[]
  correctIndex: number
  explanation: string
  createdBy: string | null
}

interface Draft {
  id: number | null
  category: Category
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'futbol', label: 'Fútbol' },
  { id: 'osm', label: 'OSM' },
  { id: 'competencias', label: 'Competencias' },
]

const emptyDraft = (category: Category): Draft => ({
  id: null,
  category,
  question: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  explanation: '',
})

export default function TriviaQuestionsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [category, setCategory] = useState<Category>('competencias')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!user) router.push('/login')
    else if (user.role !== 'captain') router.push('/dashboard/minijuegos')
  }, [user, loading, router])

  useEffect(() => {
    if (!user || user.role !== 'captain') return
    setQuestions(null)
    fetch(`/api/minigames/questions?category=${category}`)
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setQuestions(r.data)
        else setError(r.error || 'No se pudieron cargar las preguntas')
      })
      .catch(() => setError('Error cargando las preguntas'))
  }, [user, category])

  const save = async () => {
    if (!draft) return
    setSaving(true)
    setError('')
    // Las opciones vacías del final no cuentan (se permiten 2 a 4).
    const filled = draft.options.map((o) => o.trim())
    const options = filled.filter((o) => o)
    const correctText = filled[draft.correctIndex]
    const correctIndex = correctText ? options.indexOf(correctText) : -1
    try {
      const res = await fetch(draft.id ? `/api/minigames/questions/${draft.id}` : '/api/minigames/questions', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: draft.category,
          question: draft.question,
          options,
          correctIndex,
          explanation: draft.explanation,
        }),
      })
      const r = await res.json()
      if (!r.success) {
        setError(r.error || 'No se pudo guardar la pregunta')
        return
      }
      const saved = r.data as Question
      setQuestions((qs) => {
        if (!qs) return qs
        const rest = qs.filter((q) => q.id !== saved.id)
        return saved.category === category ? [saved, ...rest] : rest
      })
      setDraft(null)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (q: Question) => {
    if (!confirm(`¿Borrar la pregunta "${q.question}"?`)) return
    setError('')
    try {
      const r = await (await fetch(`/api/minigames/questions/${q.id}`, { method: 'DELETE' })).json()
      if (!r.success) setError(r.error || 'No se pudo borrar')
      else setQuestions((qs) => qs?.filter((x) => x.id !== q.id) ?? qs)
    } catch {
      setError('Error de conexión')
    }
  }

  if (loading || !user || user.role !== 'captain') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard/minijuegos">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-primary">Preguntas de trivia</h1>
              <p className="text-sm text-muted-foreground">Cada día se eligen 5 al azar de cada categoría</p>
            </div>
          </div>
          {!draft && (
            <Button className="gap-2" onClick={() => setDraft(emptyDraft(category))}>
              <Plus className="w-4 h-4" /> Nueva
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6 max-w-3xl">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Button
              key={c.id}
              variant={category === c.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </Button>
          ))}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">{error}</div>
        )}

        {draft && (
          <Card className="p-6 space-y-4 border-primary/40">
            <h2 className="font-bold text-primary">{draft.id ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  size="sm"
                  variant={draft.category === c.id ? 'default' : 'outline'}
                  onClick={() => setDraft({ ...draft, category: c.id })}
                >
                  {c.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Pregunta (ej: ¿Qué clan ganó la última BHP?)"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Opciones (2 a 4). Tocá el círculo de la correcta.</p>
              {draft.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, correctIndex: i })}
                    className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center ${
                      draft.correctIndex === i ? 'border-green-500 bg-green-500 text-white' : 'border-border'
                    }`}
                    aria-label={`Marcar opción ${i + 1} como correcta`}
                  >
                    {draft.correctIndex === i && <Check className="w-4 h-4" />}
                  </button>
                  <Input
                    placeholder={`Opción ${i + 1}${i >= 2 ? ' (opcional)' : ''}`}
                    value={opt}
                    onChange={(e) => {
                      const options = [...draft.options]
                      options[i] = e.target.value
                      setDraft({ ...draft, options })
                    }}
                  />
                </div>
              ))}
            </div>
            <Input
              placeholder="Explicación (opcional, se muestra al responder)"
              value={draft.explanation}
              onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </Card>
        )}

        {!questions ? (
          <div className="h-40 rounded-lg bg-card/50 border border-border/50 animate-pulse" />
        ) : questions.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Todavía no hay preguntas en esta categoría.
            {category === 'competencias' && ' Cargá preguntas sobre BHP, CN, LBH, WCC y demás torneos para activar el juego.'}
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{questions.length} preguntas</p>
            {questions.map((q) => (
              <Card key={q.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{q.question}</p>
                    <ul className="text-sm space-y-0.5">
                      {q.options.map((o, i) => (
                        <li key={i} className={`flex items-center gap-1.5 ${i === q.correctIndex ? 'text-green-500' : 'text-muted-foreground'}`}>
                          {i === q.correctIndex ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5 opacity-40" />}
                          {o}
                        </li>
                      ))}
                    </ul>
                    {q.explanation && <p className="text-xs text-muted-foreground italic">{q.explanation}</p>}
                    {q.createdBy && <p className="text-[11px] text-muted-foreground">Por {q.createdBy}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDraft({
                          id: q.id,
                          category: q.category,
                          question: q.question,
                          options: [...q.options, '', '', ''].slice(0, 4),
                          correctIndex: q.correctIndex,
                          explanation: q.explanation,
                        })
                      }
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(q)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
