"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/context"
import { useRouter } from "next/navigation"

const navLinks = [
  { label: "Inicio", href: "#" },
  { label: "Nosotros", href: "#about" },
  { label: "Guerreros", href: "#warriors" },
  { label: "Comunidad", href: "#community" },
  { label: "Únete", href: "#join" },
]

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleLogout = async () => {
    await logout()
    router.push("/login")
  }

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled ? "bg-background/90 backdrop-blur-md border-b border-border/50" : ""
        }`}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-20">
            <a href="#" className="flex items-center gap-3 group">
              <div className="relative w-10 h-10">
                <Image
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-RjITvkthV0aHCZMYbAA5rTzv6cSLMY.png"
                  alt="EXILIADOS"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-[family-name:var(--font-display)] text-2xl text-foreground hidden sm:block group-hover:text-primary transition-colors">
                EXILIADOS
              </span>
            </a>

            <div className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-primary transition-colors text-sm tracking-widest uppercase relative group"
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className="px-4 py-2 text-primary border border-primary rounded hover:bg-primary/10 transition-colors text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Ingresar
                </Link>
              )}
            </div>

            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-foreground hover:text-primary transition-colors"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </motion.nav>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-40 bg-background/98 backdrop-blur-md md:hidden pt-24"
          >
            <div className="container mx-auto px-4">
              <div className="flex flex-col items-center gap-8 py-12">
                {navLinks.map((link, index) => (
                  <motion.a
                    key={link.label}
                    href={link.href}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={() => setIsMenuOpen(false)}
                    className="font-[family-name:var(--font-display)] text-4xl text-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </motion.a>
                ))}
                <div className="flex flex-col gap-3 w-full max-w-xs mt-8">
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        onClick={() => setIsMenuOpen(false)}
                        className="px-4 py-3 text-primary border border-primary rounded hover:bg-primary/10 transition-colors text-sm font-medium text-center"
                      >
                        Dashboard
                      </Link>
                      <button
                        onClick={async () => {
                          await handleLogout()
                          setIsMenuOpen(false)
                        }}
                        className="px-4 py-3 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium"
                      >
                        Salir
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setIsMenuOpen(false)}
                      className="px-4 py-3 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors text-sm font-medium text-center"
                    >
                      Ingresar
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
