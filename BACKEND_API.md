# Backend API - EXILIADOS

Backend independiente construido con **Express + TypeScript**, con su propia base de datos **SQLite** (`better-sqlite3`). Vive en la carpeta `backend/` y corre en un proceso separado del frontend (Next.js).

El frontend nunca llama directo a este servidor desde el navegador: `fronted/next.config.mjs` define un `rewrite` que reenvía todo `/api/*` hacia `BACKEND_URL` (por defecto `http://localhost:4001`). Así el código del frontend sigue usando rutas relativas (`fetch('/api/warriors')`) y no hay problemas de CORS en desarrollo.

## Estructura

```
backend/
├── src/
│   ├── server.ts       # Punto de entrada (Express, CORS, cookies)
│   ├── db.ts            # Conexión SQLite, migraciones e inicialización con datos por defecto
│   ├── sse.ts            # Broadcast de Server-Sent Events (ranking en tiempo real)
│   ├── middleware/
│   │   └── auth.ts       # requireAuth / requireCaptain (basados en la cookie auth-token)
│   └── routes/
│       ├── auth.ts       # POST /api/auth/login, POST /api/auth/logout
│       ├── community.ts  # GET /api/community (roster público por clan)
│       ├── members.ts    # GET/POST /api/members, PUT/DELETE /api/members/:id
│       ├── rankings.ts   # GET/POST /api/rankings (solo capitanes) + SSE
│       ├── stats.ts      # GET /api/stats
│       └── warriors.ts   # GET /api/warriors
├── data.db              # Base de datos SQLite (se crea automáticamente)
├── .env.example         # PORT y FRONTEND_URL
└── package.json
```

## Ejecutar el backend

```bash
cd backend
npm install
npm run dev     # tsx watch, recarga en caliente
```

El servidor arranca en `http://localhost:4001` (configurable con `PORT` en un archivo `.env`). Al iniciar, `initializeDatabase()` crea las tablas si no existen y las llena con datos por defecto solo la primera vez.

## API Endpoints

### Autenticación

#### `POST /api/auth/login`
Body: `{ "username": string, "password": string }`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "username": "exi",
    "role": "captain",
    "full_name": "Exi Suaro Perez",
    "clan": "exiliados",
    "token": "..."
  }
}
```
También setea una cookie `auth-token` (httpOnly). El campo `clan` es el que el frontend usa para mostrar "Eres parte del clan X" al iniciar sesión y en el dashboard.

#### `POST /api/auth/logout`
Body: `{ "token": string }` → invalida la sesión y limpia la cookie.

### Miembros

#### `GET /api/members`
Lista todos los miembros (sin contraseñas).

#### `POST /api/members`
Body: `{ "username", "password", "full_name"?, "role": "member" | "captain" }` → crea un miembro (201).

#### `PUT /api/members/:id`
Body: `{ "username", "full_name", "role", "password"? }` → actualiza; si se envía `password`, también se rehashea.

#### `DELETE /api/members/:id`
Elimina el miembro y sus sesiones activas.

### Estadísticas

#### `GET /api/stats`
```json
{
  "success": true,
  "data": [
    { "value": "150+", "label": "Victorias", "icon": "Trophy", "delay": 0 }
  ],
  "count": 4
}
```

### Guerreros

#### `GET /api/warriors`
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Exi Suaro Perez",
      "role": "LÍDER",
      "rank": "Campeón BHP",
      "nationality": "México",
      "countryCode": "mx",
      "flag": "🇲🇽",
      "initial": "E"
    }
  ],
  "count": 4
}
```

### Comunidad (roster público por clan)

#### `GET /api/community`
```json
{
  "success": true,
  "data": {
    "exiliados": [],
    "rayo": [{ "id": 1, "name": "Rodo", "flag": "🇲🇽" }]
  },
  "count": 1
}
```
Alimenta la sección "Nuestros Clanes" del landing (tabs Exiliados/Rayo). No requiere sesión.

### Rankings de puntos (solo capitanes)

Protegido con `requireCaptain`: exige la cookie `auth-token` de una sesión con `role = 'captain'` (401 si no hay sesión, 403 si no es capitán).

#### `GET /api/rankings`
Devuelve el ranking de **Rayo** y **Exiliados**, ordenado por puntos (`wins - losses`) descendente:
```json
{
  "success": true,
  "data": {
    "rayo": [{ "id": 1, "name": "Rodo", "flag": "🇲🇽", "wins": 3, "losses": 1, "points": 2 }],
    "exiliados": []
  }
}
```

#### `GET /api/rankings/stream`
Server-Sent Events. Al conectar manda el estado actual (`event: rankings`) y luego un nuevo `event: rankings` cada vez que cualquier capitán registra un resultado — así el ranking se actualiza en tiempo real para todos los capitanes que lo tengan abierto, sin recargar.

#### `POST /api/rankings/:clanMemberId/result`
Body: `{ "result": "win" | "loss" }` → inserta el resultado, recalcula el ranking y lo transmite por el stream a todos los clientes conectados.

## Base de datos

SQLite vía `better-sqlite3`, archivo `backend/data.db` (se ignora en git). Tablas:

- `members` — cuentas de login (username, password hasheado con SHA-256, role, full_name, **clan**)
- `sessions` — tokens de sesión con expiración
- `warriors` — guerreros/líderes del clan (los 5 capitanes)
- `stats` — estadísticas mostradas en el home
- `clan_members` — roster público por clan (Exiliados/Rayo), separado de `members`
- `battle_results` — historial de victorias/derrotas por `clan_member_id`, de donde sale el ranking

### Usuarios por defecto (seed)

| Usuario | Contraseña | Rol | Clan |
|---|---|---|---|
| rodo, rojas | exiliados123 | member | rayo |
| exi, chicolinas, tomas, cesar, pepe | capis123 | captain | exiliados |

## Códigos de país soportados

```
mx - México (🇲🇽)
ve - Venezuela (🇻🇪)
co - Colombia (🇨🇴)
us - USA (🇺🇸)
es - España (🇪🇸)
ar - Argentina (🇦🇷)
cl - Chile (🇨🇱)
pe - Perú (🇵🇪)
br - Brasil (🇧🇷)
```

Para agregar más países, edita `FLAG_MAP` en `backend/src/db.ts`.

## Variables de entorno (`backend/.env`)

```
PORT=4001
FRONTEND_URL=http://localhost:3000
```

`FRONTEND_URL` se usa para configurar CORS (por si el backend se llama directo, sin pasar por el rewrite de Next.js).

## Errores comunes

1. **"Failed to fetch" / los datos no cargan** → Verifica que el backend esté corriendo (`npm run dev` en `backend/`) y en el puerto configurado en `BACKEND_URL`.
2. **CORS error** al llamar directo al backend desde otro origen → agrega ese origen a `FRONTEND_URL` o ajusta el CORS en `backend/src/server.ts`.

## Deployment

- **Backend**: cualquier host Node.js (Railway, Render, Fly.io, VPS). Build con `npm run build`, arranca con `npm start`.
- **Frontend**: Vercel, Netlify o self-hosted. Configura `BACKEND_URL` en las variables de entorno apuntando a la URL pública del backend.

## Next Steps

1. ✅ Backend Express independiente con SQLite
2. ✅ Frontend conectado vía rewrite (sin CORS en dev)
3. ✅ CRUD de miembros
4. ✅ Clan por usuario + ranking de puntos en tiempo real (solo capitanes)
5. ⏳ UI para editar el `clan` de un miembro y el roster de `clan_members` desde el dashboard (hoy solo se edita en el seed de `backend/src/db.ts`)
6. ⏳ Migrar a PostgreSQL para producción
7. ⏳ Hashing de contraseñas con salt (bcrypt/argon2) en vez de SHA-256 plano
8. ⏳ Paginación y filtros en `/api/members`
