"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import { ChevronDown } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 2px,
            currentColor 2px,
            currentColor 3px
          )`,
          backgroundSize: '30px 30px'
        }} />
      </div>
      
      {/* Red glow effect behind logo */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px]" />
      
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="mb-8"
        >
          {/* Japanese characters decoration */}
          <div className="flex justify-center items-center gap-8 mb-6">
            <motion.span 
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-primary text-2xl md:text-4xl font-bold tracking-widest"
            >
              強い
            </motion.span>
            
            <div className="relative w-48 h-48 md:w-72 md:h-72 lg:w-96 lg:h-96">
              <Image
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-RjITvkthV0aHCZMYbAA5rTzv6cSLMY.png"
                alt="EXILIADOS Clan Logo - Samurai Warrior"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </div>
            
            <motion.span 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="text-primary text-2xl md:text-4xl font-bold tracking-widest"
            >
              敢勇
            </motion.span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="space-y-6"
        >
          <h1 className="font-[family-name:var(--font-display)] text-6xl md:text-8xl lg:text-9xl tracking-wider text-foreground">
            EXILIADOS
          </h1>
          
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-12 md:w-24 bg-gradient-to-r from-transparent to-primary" />
            <p className="text-lg md:text-2xl text-primary font-medium tracking-[0.3em] uppercase">
              Sin Miedo a la Competencia
            </p>
            <span className="h-px w-12 md:w-24 bg-gradient-to-l from-transparent to-primary" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4, duration: 0.6 }}
          className="mt-16"
        >
          <a 
            href="#about"
            className="inline-flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
          >
            <span className="text-sm tracking-widest uppercase">Descubre más</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="w-6 h-6" />
            </motion.div>
          </a>
        </motion.div>
      </div>

      {/* Decorative corner elements */}
      <div className="absolute top-8 left-8 w-16 h-16 border-l-2 border-t-2 border-primary/30" />
      <div className="absolute top-8 right-8 w-16 h-16 border-r-2 border-t-2 border-primary/30" />
      <div className="absolute bottom-8 left-8 w-16 h-16 border-l-2 border-b-2 border-primary/30" />
      <div className="absolute bottom-8 right-8 w-16 h-16 border-r-2 border-b-2 border-primary/30" />
    </section>
  )
}
