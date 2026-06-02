# Backend de Ecopuntos

API REST para la app **Ecopuntos**. Convive con el frontend (React + Vite) en el mismo repositorio: el frontend está en la raíz y el backend en `backend/`.

> Stack: **Node.js + Express + SQLite** (`better-sqlite3`), autenticación con **JWT**, hash de contraseñas con **bcryptjs**. Comentarios y mensajes de error en español.

---

## Requisitos

- **Node.js ≥ 18** (`fetch` nativo, sin polyfills).
- **npm** (viene con Node).

> El frontend usa `pnpm`. El backend usa `npm` para que cada subproyecto sea independiente — puedes mezclar gestores en el mismo repo sin problema porque los `node_modules` viven en carpetas distintas.

---

## Instalación y arranque

```bash
cd backend
npm install
cp .env.example .env       # en Windows PowerShell: Copy-Item .env.example .env
npm run db:reset           # crea ecopuntos.db con esquema y seed
npm run dev                # nodemon en http://localhost:4000
```

Cuando arranca verás en consola:

```
[db] Conectado a SQLite en .../backend/ecopuntos.db
[ecopuntos-backend] Escuchando en http://localhost:4000
[ecopuntos-backend] CORS permitido para: http://localhost:5173
```

### Smoke test

Con el server corriendo, en otra terminal:

```bash
npm run test:smoke
```

Deberías ver `14 ok, 0 fallidos`.

### Scripts disponibles

| Script | Qué hace |
|---|---|
| `npm run dev` | Arranca con **nodemon** (recarga al editar). |
| `npm start` | Arranca en modo "producción" local (sin nodemon). |
| `npm run db:migrate` | Aplica el esquema (idempotente). |
| `npm run db:seed` | Inserta los ecopuntos iniciales. |
| `npm run db:reset` | Borra el `.db` y reaplica migrate + seed. **Destructivo.** |
| `npm run test:smoke` | Corre `scripts/smoke.js` contra el server local. |

---

## Variables de entorno (`.env`)

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto del servidor HTTP. |
| `CORS_ORIGIN` | `http://localhost:5173` | Origen permitido por CORS (el dev-server de Vite). |
| `DB_PATH` | `./ecopuntos.db` | Ruta del archivo SQLite. |
| `JWT_SECRET` | *(obligatorio)* | Cadena para firmar JWTs. En producción usa ≥ 32 bytes aleatorios. |
| `JWT_EXPIRES_IN` | `2h` | Duración del token (formato de `jsonwebtoken`: `15m`, `2h`, `7d`...). |

---

## Arquitectura (MVC)

```
backend/src/
├── app.js                 # Construye la app Express (no la arranca).
├── server.js              # Arranca el HTTP server. Maneja shutdown.
├── config.js              # Lee process.env con fail-fast.
├── db/
│   ├── connection.js      # Singleton de better-sqlite3 (WAL, FK on).
│   ├── migrate.js         # CREATE TABLE IF NOT EXISTS (idempotente).
│   ├── seed.js            # Inserta los ecopuntos iniciales.
│   └── reset.js           # Borra el .db y reaplica migrate + seed.
├── middleware/
│   ├── errorHandler.js    # Maneja errores y expone asyncHandler.
│   ├── notFound.js        # 404 en JSON (no HTML por defecto de Express).
│   └── requireAuth.js     # Verifica el JWT del header Authorization.
├── utils/
│   └── response.js        # Helpers ok()/fail() y clase HttpError.
├── models/                # Acceso a SQLite (queries puras).
│   ├── usuariosModel.js
│   ├── ecopuntosModel.js
│   └── solicitudesModel.js
├── controllers/           # Validación + orquestación + serialización.
│   ├── authController.js
│   ├── ecopuntosController.js
│   └── solicitudesController.js
└── routes/                # Tabla de URL → controller. Un archivo por recurso.
    ├── authRoutes.js
    ├── ecopuntosRoutes.js
    └── solicitudesRoutes.js
```

**Reglas de oro:**

- El **modelo** es el único que conoce SQL. Si tienes que escribir un `SELECT`, va ahí.
- El **controlador** valida, orquesta y serializa. No toca el `req`/`res` más allá de leer body/params y devolver `ok()` o lanzar `HttpError`.
- La **ruta** solo decide URL + middleware. Si tu archivo de rutas tiene lógica, mudala a un controlador.

---

## Contrato JSON

Todas las rutas devuelven una de estas dos formas:

**Éxito:**

```json
{ "ok": true, "data": ... }
```

**Error:**

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos.",
    "details": { "email": "Email no válido." }
  }
}
```

`details` solo aparece cuando aporta info útil (errores de validación campo a campo, por ejemplo).

### Códigos de error usados

| `code` | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 422 | Body inválido. `details` trae campo → mensaje. |
| `INVALID_JSON` | 400 | El body no es JSON parseable. |
| `EMAIL_EN_USO` | 409 | Registro con email ya existente. |
| `CREDENCIALES_INVALIDAS` | 401 | Login fallido. |
| `NO_TOKEN` | 401 | Falta `Authorization: Bearer ...` en ruta protegida. |
| `INVALID_TOKEN` | 401 | Token mal formado o firma inválida. |
| `TOKEN_EXPIRED` | 401 | Token expirado (revisa `JWT_EXPIRES_IN`). |
| `USUARIO_NO_ENCONTRADO` | 404 | El `sub` del token no corresponde a un usuario vivo. |
| `NOT_FOUND` | 404 | Ruta inexistente. |
| `INTERNAL_ERROR` | 500 | Error no controlado. Revisa logs del server. |

---

## Endpoints

> Convención: `🔒` = requiere `Authorization: Bearer <token>`.

### Auth

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| `POST` | `/api/auth/registro` | `{ nombre, email, password }` | `201` `{ token, usuario }` |
| `POST` | `/api/auth/login` | `{ email, password }` | `200` `{ token, usuario }` |
| 🔒 `GET` | `/api/auth/yo` | — | `200` `{ usuario }` |

`usuario` = `{ id, nombre, email, creado_en }`. Nunca incluye el hash.

### Ecopuntos

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/api/ecopuntos` | `200` `[{ id, name, address, hours, lat, lng, wasteLevels: [{ name, percentage, color }] }]` |

> Los campos están en **inglés** porque ese es el shape que ya consume el frontend (`src/data/ecopuntos.ts`). El backend serializa desde su modelo en español.

### Solicitudes de recolección

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| 🔒 `POST` | `/api/solicitudes` | `{ type, description, address, date, photoName? }` | `201` `{ solicitud }` |
| 🔒 `GET` | `/api/solicitudes/mias` | — | `200` `{ solicitudes: [...] }` |

`type` ∈ `{ 'muebles', 'colchones', 'escombros', 'otros' }`. `date` formato `YYYY-MM-DD`. `solicitud` incluye `status` (`pendiente` por defecto) y `createdAt`.

### Healthcheck

| Método | Ruta | Respuesta |
|---|---|---|
| `GET` | `/api/health` | `200` `{ service, version, timestamp }` |

---

## Cómo conectar el frontend

Hoy el frontend simula la sesión en `localStorage` y usa un webhook para las solicitudes. Para usar este backend hay que tocar **tres lugares** del frontend (todos en `src/`). Estos cambios NO están aplicados en este branch — los dejo documentados para que tu compañero los integre cuando esté listo.

### 1. Crear un cliente API (nuevo archivo `src/lib/api.ts`)

```ts
const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('eco_token');
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Error desconocido');
  return body.data as T;
}
```

Y en `.env` (raíz del frontend): `VITE_API_URL=http://localhost:4000`.

### 2. Reemplazar `handleLogin` y `handleRegister` en `App.tsx`

Hoy los handlers hardcodean el usuario. Deberían recibir el payload del formulario, llamar al backend, guardar `token` y `usuario`:

```ts
const handleLogin = async (email: string, password: string) => {
  const { token, usuario } = await api<{ token: string; usuario: any }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  localStorage.setItem('eco_token', token);
  localStorage.setItem('eco_user', JSON.stringify(usuario));
  setUser(usuario);
  navigate('map');
};
```

Y propagar `email`/`password` desde `LoginView` / `RegisterView` (los componentes ya tienen los inputs, solo no envían su valor todavía).

### 3. Cambiar `VoluminousWasteModal.tsx` para POSTear a `/api/solicitudes`

Reemplaza el bloque del `webhookUrl` por:

```ts
await api('/api/solicitudes', {
  method: 'POST',
  body: JSON.stringify({
    type: formData.type,
    description: formData.description,
    address: formData.address,
    date: formData.date,
    photoName: formData.photoName || undefined,
  }),
});
```

### Bonus (opcional)

Reemplazar el array hardcodeado de `src/data/ecopuntos.ts` por un fetch a `/api/ecopuntos` desde un hook (`useEcopuntos`). El shape de respuesta es idéntico al `EcoPunto[]` que ya tipa el frontend.

---

## Decisiones técnicas, en breve

- **`better-sqlite3`** (síncrona) en vez de `sqlite3` (callbacks): código más legible, sin Promise wrappers; perfecta para apps single-server.
- **JWT** en vez de sesiones server-side: el backend queda stateless, escala horizontal sin compartir estado.
- **bcryptjs** (puro JS) en vez de `bcrypt` (binario nativo): evita problemas de compilación nativa en Windows; la diferencia de performance es irrelevante a este volumen.
- **ESM** (`"type": "module"`): alinea con el frontend y es el estándar moderno de Node. Imports estáticos = mejor herramienta para análisis estático.
- **Sin ORM**: para enseñar SQL real. Si el dominio crece, considera Prisma o Drizzle.
