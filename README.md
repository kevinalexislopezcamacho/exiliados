# EXILIADOS - Plataforma del Clan

Bienvenido a EXILIADOS, una plataforma para gestionar y mostrar los líderes, estadísticas y comunidad del clan.

## 🚀 Stack Tecnológico

- **Frontend**: Next.js 16 (React + TypeScript)
- **Backend**: Express + TypeScript (API propia, separada del frontend)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Base de datos**: SQLite (better-sqlite3)
- **Animaciones**: Framer Motion

## 📁 Estructura del Proyecto

```
exiliados/
├── package.json                # Scripts raíz (levanta front + back juntos)
│
├── fronted/                    # Aplicación Next.js (UI)
│   ├── app/
│   │   ├── page.tsx           # Página principal
│   │   ├── login/             # Login
│   │   ├── dashboard/         # Dashboard (miembro/capitán)
│   │   ├── layout.tsx         # Layout
│   │   └── globals.css        # Estilos globales
│   │
│   ├── components/            # Componentes React
│   │   ├── hero-section.tsx
│   │   ├── stats-section.tsx
│   │   ├── warriors-section.tsx  # Líderes del clan con BANDERAS
│   │   ├── members-management.tsx
│   │   ├── about-section.tsx
│   │   ├── cta-section.tsx
│   │   ├── footer.tsx
│   │   ├── navigation.tsx
│   │   └── ui/                # Componentes UI (Shadcn/ui)
│   │
│   ├── lib/auth/context.tsx   # Contexto de sesión (cliente)
│   ├── next.config.mjs        # Rewrites de /api/* hacia el backend
│   ├── hooks/                 # React hooks personalizados
│   ├── styles/                # Estilos adicionales
│   ├── public/                # Archivos estáticos
│   └── package.json
│
├── backend/                    # API Express independiente
│   ├── src/
│   │   ├── server.ts          # Punto de entrada
│   │   ├── db.ts              # SQLite + inicialización + seed
│   │   └── routes/
│   │       ├── auth.ts        # login/logout
│   │       ├── members.ts     # CRUD de miembros
│   │       ├── stats.ts       # estadísticas
│   │       └── warriors.ts    # guerreros/líderes
│   ├── data.db                 # Base de datos (se crea al arrancar)
│   └── package.json
│
├── BACKEND_API.md              # Documentación del API
└── README.md                   # Este archivo
```

El frontend nunca habla directo con el backend desde el navegador: Next.js reescribe (`rewrites`) todas las peticiones a `/api/*` hacia `http://localhost:4001/api/*` (configurable con `BACKEND_URL`), así que en el código del frontend todo sigue llamándose con rutas relativas (`fetch('/api/warriors')`) sin problemas de CORS.

## 🎯 Características

### Páginas/Secciones

1. **Navigation** - Navegación principal con logo
2. **Hero Section** - Portada con logo y CTA
3. **Stats Section** - Estadísticas del clan (150+ victorias, 25 guerreros, etc.)
4. **About Section** - Información sobre el clan
5. **Warriors Section** - **Líderes con sus banderas de países** 🚀
6. **CTA Section** - Call-to-Action para unirse
7. **Footer** - Pie de página con enlaces

### API Endpoints

- `GET /api/warriors` - Lista de guerreros con banderas
- `GET /api/stats` - Estadísticas del clan
- `POST /api/auth/login` / `POST /api/auth/logout` - Autenticación
- `GET/POST /api/members`, `PUT/DELETE /api/members/:id` - Gestión de miembros

## 🏃 Inicio Rápido

### Requisitos

- Node.js 18+
- npm

### Instalación

```bash
# Desde la raíz del proyecto: instala frontend y backend
npm run install:all
```

### Ejecutar (frontend + backend juntos)

```bash
npm run dev
```

Esto levanta:
- Backend en [http://localhost:4001](http://localhost:4001)
- Frontend en [http://localhost:3000](http://localhost:3000)

También puedes correrlos por separado con `npm run dev:backend` y `npm run dev:frontend`, o entrando a cada carpeta (`cd backend && npm run dev`, `cd fronted && npm run dev`).

## 🌍 Banderas de Países

Las secciones de líderes ahora muestran **banderas emoji** para cada país:

| País | Flag | Code |
|------|------|------|
| México | 🇲🇽 | mx |
| Venezuela | 🇻🇪 | ve |
| Colombia | 🇨🇴 | co |
| USA | 🇺🇸 | us |
| España | 🇪🇸 | es |
| Argentina | 🇦🇷 | ar |
| Chile | 🇨🇱 | cl |
| Perú | 🇵🇪 | pe |
| Brasil | 🇧🇷 | br |

[Agregar más países](BACKEND_API.md#códigos-de-país-soportados)

## 📝 Agregar/Editar Datos

### Agregar un nuevo guerrero

Edita `fronted/lib/db/data.ts`:

```typescript
{
  id: 5,
  name: "Juan García",
  role: "CAPITÁN",
  rank: "Campeón",
  nationality: "España",
  countryCode: "es",
  initial: "J"
}
```

### Editar estadísticas

Edita `fronted/lib/db/data.ts`:

```typescript
{
  value: "200+",
  label: "Victorias",
  icon: "Trophy",
  delay: 0
}
```

## 🔧 Desarrollo

### Comandos disponibles

```bash
cd fronted

# Desarrollo
npm run dev          # Inicia servidor en http://localhost:3000

# Build
npm run build        # Compila para producción

# Production
npm start            # Ejecuta versión compilada

# Linting
npm run lint         # Verifica código
```

## 🌐 Deployment

### En Vercel (Recomendado)

1. Push tu código a GitHub
2. Conecta el repo en [vercel.com](https://vercel.com)
3. Deploy automático

### En tu servidor

```bash
# Build
npm run build

# Start
npm start

# Puerto default: 3000
```

## 📚 Documentación

- [API Backend](BACKEND_API.md) - Documentación completa del API
- [Next.js Docs](https://nextjs.org/docs)
- [Shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 🎨 Personalización

### Cambiar colores

Edita `fronted/app/globals.css` o `tailwind.config.ts`

### Cambiar fuentes

Edita `fronted/app/layout.tsx`

### Cambiar logo

Reemplaza la imagen en `fronted/components/hero-section.tsx`

## 🐛 Troubleshooting

### "API returns 404"
- Verifica que los archivos estén en `app/api/*/route.ts`
- Reinicia el servidor (`npm run dev`)

### "Banderas no se muestran"
- Verifica que `countryCode` sea válido en `lib/db/data.ts`
- Abre DevTools (F12) y revisa la consola

### "Estilos rotos"
- Ejecuta `npm install` nuevamente
- Limpia `.next/` y reinicia

## 📧 Soporte

Para reportar bugs o sugerencias, crea un issue en el repositorio.

---

**Estado**: ✅ En Producción  
**Última actualización**: 2026-04-14  
**Versión**: 1.0.0  

Hecho con 💪 para EXILIADOS
