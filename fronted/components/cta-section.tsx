"use client"

import { motion } from "framer-motion"
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CtaSection() {
  return (
    <section className="relative py-32 overflow-hidden">
      {/* Background with red glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-primary/10" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/20 rounded-full blur-[150px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          {/* Japanese text decoration */}
          <div className="mb-8">
            <span className="text-primary/60 text-4xl md:text-6xl tracking-[0.5em]">
              参加する
            </span>
          </div>
          
          <h2 className="font-[family-name:var(--font-display)] text-5xl md:text-7xl lg:text-8xl mb-6 text-foreground">
            ¿TIENES LO QUE
            <br />
            <span className="text-primary">SE NECESITA?</span>
          </h2>
          
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
            Buscamos jugadores que no temen a los desafíos. Guerreros con hambre de victoria 
            y lealtad inquebrantable. Si estás listo para ser parte de la élite, este es tu momento.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              className="group bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg font-[family-name:var(--font-display)] tracking-wider"
            >
              ÚNETE AHORA
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="group border-border hover:border-primary text-foreground hover:text-primary px-8 py-6 text-lg font-[family-name:var(--font-display)] tracking-wider"
            >
              <MessageCircle className="mr-2 w-5 h-5" />
              CONTÁCTANOS
            </Button>
          </div>
          
          {/* Requirements */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 text-center"
          >
            {[
              { label: "Nivel Mínimo", value: "70+" },
              { label: "Actividad", value: "Diaria" },
              { label: "Comunicación", value: "Discord" },
              { label: "Actitud", value: "Ganadora" },
            ].map((req, index) => (
              <div key={index} className="p-4">
                <span className="block text-primary font-[family-name:var(--font-display)] text-2xl md:text-3xl mb-1">
                  {req.value}
                </span>
                <span className="text-muted-foreground text-xs tracking-widest uppercase">
                  {req.label}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
