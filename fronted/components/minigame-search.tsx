'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'

function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

// Buscador con autocompletado sobre una lista fija de opciones (jugadores o
// clubes). Solo se puede elegir algo de la lista.
export function MinigameSearch({
  options,
  exclude = [],
  placeholder,
  disabled,
  onPick,
}: {
  options: string[]
  exclude?: string[]
  placeholder: string
  disabled?: boolean
  onPick: (option: string) => void
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const q = normalize(query.trim())
    if (q.length < 2) return []
    return options.filter((o) => !exclude.includes(o) && normalize(o).includes(q)).slice(0, 8)
  }, [query, options, exclude])

  const pick = (option: string) => {
    setQuery('')
    onPick(option)
  }

  return (
    <div className="relative">
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length > 0) {
            e.preventDefault()
            pick(matches[0])
          }
        }}
        autoComplete="off"
      />
      {matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-primary/10"
            >
              {m}
            </button>
          ))}
        </div>
      )}
      {query.trim().length >= 2 && matches.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">No está en la lista.</p>
      )}
    </div>
  )
}
