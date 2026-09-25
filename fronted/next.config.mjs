import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4001'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hay dos lockfiles (package-lock.json en la raíz del monorepo y
  // pnpm-lock.yaml aquí) y Turbopack infería mal el workspace root como la
  // raíz del monorepo. Ahí no está instalado "next", así que al compilar
  // páginas que usan next/dynamic (como /dashboard) hacía panic con
  // "Next.js package not found" y entraba en loop de recarga.
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
