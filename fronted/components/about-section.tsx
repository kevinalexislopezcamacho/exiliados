"use client"

import { motion } from "framer-motion"
import { Sword, Shield, Crown } from "lucide-react"

const values = [
  {
    icon: Sword,
    title: "Agresividad Táctica",
    description: "Atacamos con precisión. Cada jugada está calculada para dominar el campo y destruir a nuestros rivales.",
  },
  {
    icon: Shield,
    title: "Defensa Impenetrable", 
    description: "Como samurais, protegemos nuestra línea con honor. Ningún enemigo pasa sin enfrentar resistencia.",
  },
  {
    icon: Crown,
    title: "Mentalidad Ganadora",
    description: "No jugamos para participar. Jugamos para conquistar. La victoria es nuestro único destino.",
  },
]

export function AboutSection() {
  return (
    <section id="about" className="relative py-32">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="text-primary text-sm tracking-[0.4em] uppercase mb-4 block">
            Nuestra Filosofía
          </span>
          <h2 className="font-[family-name:var(--font-display)] text-5xl md:text-7xl mb-6">
            EL CÓDIGO DEL
            <br />
            <span className="text-primary">GUERRERO</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
            En EXILIADOS no solo jugamos OSM. Vivimos una filosofía de disciplina, 
            estrategia y hermandad que nos convierte en invencibles.
          </p>
        </motion.div>

        {/* Values grid - asymmetric layout */}
        <div className="grid md:grid-cols-3 gap-6 md:gap-8">
          {values.map((value, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15, duration: 0.5 }}
              className={`group relative ${index === 1 ? 'md:-mt-8' : ''}`}
            >
              <div className="relative p-8 bg-card border border-border rounded-lg overflow-hidden h-full hover:border-primary/50 transition-colors duration-300">
                {/* Accent line */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-primary/50 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                
                <div className="relative z-10">
                  <div className="mb-6 inline-flex p-4 rounded-lg bg-primary/10">
                    <value.icon className="w-8 h-8 text-primary" />
                  </div>
                  
                  <h3 className="font-[family-name:var(--font-display)] text-2xl md:text-3xl mb-4 text-foreground">
                    {value.title}
                  </h3>
                  
                  <p className="text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
                
                {/* Background number */}
                <span className="absolute -bottom-4 -right-4 font-[family-name:var(--font-display)] text-[150px] text-border/30 leading-none select-none">
                  {index + 1}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
