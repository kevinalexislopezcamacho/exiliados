"use client"

import Image from "next/image"

export function Footer() {
  return (
    <footer className="relative py-16 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo and tagline */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-RjITvkthV0aHCZMYbAA5rTzv6cSLMY.png"
                alt="EXILIADOS"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-foreground">
                EXILIADOS
              </h3>
              <p className="text-muted-foreground text-sm">
                Sin Miedo a la Competencia
              </p>
            </div>
          </div>
          
          {/* Social links */}
          <div className="flex items-center gap-6">
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors text-sm tracking-widest uppercase"
            >
              Discord
            </a>
            <span className="text-border">|</span>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors text-sm tracking-widest uppercase"
            >
              Instagram
            </a>
            <span className="text-border">|</span>
            <a 
              href="#" 
              className="text-muted-foreground hover:text-primary transition-colors text-sm tracking-widest uppercase"
            >
              Twitter
            </a>
          </div>
        </div>
        
        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4 text-muted-foreground text-sm">
          <p>© 2026 EXILIADOS. Todos los derechos reservados.</p>
          <p className="text-primary/60">強い • 敢勇 • 無敵</p>
        </div>
      </div>
    </footer>
  )
}
