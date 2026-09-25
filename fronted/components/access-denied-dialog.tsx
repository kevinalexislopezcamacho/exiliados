'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ShieldAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AccessDeniedDialogProps {
  open: boolean
  message?: string
}

export function AccessDeniedDialog({ open, message }: AccessDeniedDialogProps) {
  const router = useRouter()

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md text-center">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <DialogTitle className="text-xl">Ups, no tienes acceso a este tipo de contenido</DialogTitle>
          <DialogDescription>
            {message ?? 'Tu capitán todavía no habilitó el acceso a estos reportes para tu clan.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={() => router.push('/dashboard')}>Volver al dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
