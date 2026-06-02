# EcoPuntos Bogotá ♻️

> Aplicación web académica para que los ciudadanos de Bogotá **encuentren puntos de acopio de residuos** cercanos a su dirección y **agenden la recolección de residuos voluminosos** (muebles, colchones, escombros) desde un mapa interactivo.

Repositorio compartido entre estudiantes, organizado como un **monorepo de dos subproyectos**: un frontend (React + Vite) en la raíz y un backend (Node + Express + SQLite) en `backend/`.

---

## 1. Visión de negocio

### 1.1 El problema

En Bogotá, deshacerse de un mueble viejo, un colchón o escombros de una remodelación no es trivial: no caben en la caneca de la basura, el servicio de aseo no los recoge en la ruta normal, y los ciudadanos terminan **dejándolos en la calle**, generando focos de basura, multas y deterioro del espacio público. Al mismo tiempo, existen **ecopuntos** (puntos de acopio) repartidos por la ciudad, pero la gente no sabe **dónde están, qué horario tienen ni si todavía tienen capacidad** para recibir cierto tipo de material.

### 1.2 La propuesta de valor

EcoPuntos Bogotá resuelve esto con dos funcionalidades centrales:

1. **Encontrar el ecopunto adecuado.** El usuario escribe su dirección o un lugar de referencia ("Universidad Nacional", "Chapinero", "Carrera 11 #127") y la app le muestra en un mapa los ecopuntos **dentro de un radio configurable** (1, 3, 5 o 10 km), con su dirección, horario, **nivel de llenado por tipo de residuo** (madera, escombros, muebles) y una **ruta de conducción** hasta el punto elegido.

2. **Agendar una recolección a domicilio.** Si el residuo es voluminoso y el usuario no puede transportarlo, llena un formulario indicando el **tipo de residuo, descripción, dirección, fecha deseada y datos de contacto**. La solicitud queda registrada y recibe un **correo de confirmación**.

### 1.3 ¿Quién lo usa?

- **Ciudadano / hogar**: la audiencia principal. Busca ecopuntos cercanos y agenda recolecciones. Puede registrarse con email/contraseña o con su cuenta de **Google**.
- **(Futuro) Operador del ecopunto / municipio**: el modelo de datos ya contempla **estados de solicitud** (`pendiente → agendada → completada / cancelada`) y **niveles de llenado** por punto, pensados para un panel operativo que aún no está construido.

### 1.4 Recorrido del usuario (flujo end-to-end)

```
Registro / Login  ──►  Mapa (splash)  ──►  Busca su dirección
   (email o Google)         │                      │
                            │                      ▼
                            │            Ve ecopuntos dentro del radio elegido
                            │                      │
                            │            ┌─────────┴──────────┐
                            ▼            ▼                    ▼
              Agendar recolección   Selecciona un punto   Traza ruta hasta él
              (residuo voluminoso)  (horario + niveles)
                            │
                            ▼
              Recibe email de confirmación
```

### 1.5 Estado del producto

Es un **proyecto académico**, no un producto en producción. Funcionalmente cubre el camino feliz completo (auth real, catálogo servido por API, búsqueda con autocompletado, agendamiento con correos), pero **no hay panel de administración, ni asignación real de rutas de camiones, ni pasarela de pagos**. Los niveles de llenado y los estados de solicitud son datos semilla / por defecto, no provienen de sensores ni de un operador.

---

## 2. Visión técnica

### 2.1 Arquitectura general

Dos aplicaciones independientes que se comunican por HTTP/JSON:

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│  FRONTEND  (raíz del repo)   │  HTTP   │  BACKEND  (backend/)          │
│  React 19 + Vite + TS        │ ◄─────► │  Node 18+ + Express 4         │
│  Tailwind + Mapbox GL        │  JSON   │  SQLite (better-sqlite3)      │
│  pnpm · puerto 5173          │         │  JWT · bcryptjs · npm · :4000 │
└──────────────┬──────────────┘         └───────────────┬──────────────┘
               │                                         │
        ┌──────┴───────┐                          ┌──────┴───────┐
        ▼              ▼                          ▼              ▼
   Mapbox APIs    Google Identity            SQLite file     Gmail SMTP
 (Search Box +    Services (OAuth)          (ecopuntos.db)   (nodemailer)
  Directions)
```

El frontend habla con **tres servicios externos directamente desde el cliente**: Mapbox (mapa, autocompletado y rutas) y Google Identity Services (botón de login). El backend habla con SQLite (persistencia), Google (verificación del ID token) y Gmail (correos).

### 2.2 Stack tecnológico

| Capa | Tecnologías |
|---|---|
| **Frontend** | React 19 (con **React Compiler**), Vite 8, TypeScript, Tailwind CSS 3, `mapbox-gl` + `react-map-gl`, `@react-oauth/google`, `lucide-react`. Gestor **pnpm**. |
| **Backend** | Node ≥ 18 (ESM), Express 4, `better-sqlite3` (síncrono), `jsonwebtoken`, `bcryptjs`, `google-auth-library`, `nodemailer`, `cors`, `dotenv`. Gestor **npm**, dev con `nodemon`. |
| **Datos** | SQLite (un archivo `ecopuntos.db`, modo WAL, FKs activadas). |

> Cada subproyecto usa su propio gestor de paquetes (`pnpm` arriba, `npm` en `backend/`) y sus `node_modules` viven en carpetas distintas, por lo que conviven sin conflicto.

### 2.3 Arranque rápido

```bash
# ── Frontend (raíz) ──
pnpm install
cp .env.example .env          # editar VITE_MAPBOX_TOKEN, VITE_API_URL, VITE_GOOGLE_CLIENT_ID
pnpm dev                      # http://localhost:5173

# ── Backend (otra terminal) ──
cd backend
npm install
cp .env.example .env          # editar JWT_SECRET (obligatorio), GOOGLE_CLIENT_ID, SMTP_* (opcionales)
npm run db:reset              # crea ecopuntos.db con esquema + seed
npm run dev                   # http://localhost:4000
```

Comandos relevantes:

| Subproyecto | Comando | Qué hace |
|---|---|---|
| Frontend | `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm preview` | dev server / `tsc -b && vite build` / ESLint / servir bundle |
| Backend | `npm run dev` / `npm start` | nodemon / producción local |
| Backend | `npm run db:migrate` / `db:seed` / `db:reset` | esquema idempotente / semilla / **reset destructivo** |
| Backend | `npm run test:smoke` | corre `scripts/smoke.js` contra el server local |

### 2.4 Variables de entorno

**Frontend (`.env` en la raíz, prefijo `VITE_` para que Vite las exponga):**

| Variable | Default | Descripción |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | — | Token público de Mapbox. Sin él el mapa, el autocompletado y las rutas no funcionan. |
| `VITE_API_URL` | `http://localhost:4000` | URL base del backend. |
| `VITE_GOOGLE_CLIENT_ID` | — | Client ID de Google. Si falta, el botón de Google **se oculta solo** y la app sigue con login tradicional. |

**Backend (`backend/.env`):**

| Variable | Default | Descripción |
|---|---|---|
| `PORT` | `4000` | Puerto HTTP. |
| `CORS_ORIGIN` | `http://localhost:5173` | Único origen permitido por CORS. |
| `DB_PATH` | `./ecopuntos.db` | Ruta del archivo SQLite. |
| `JWT_SECRET` | *(obligatorio)* | Secreto para firmar JWTs. **El server rehúsa arrancar** si falta o es un placeholder conocido. |
| `JWT_EXPIRES_IN` | `2h` | Vida del token (`15m`, `2h`, `7d`...). |
| `GOOGLE_CLIENT_ID` | `''` | Mismo valor que `VITE_GOOGLE_CLIENT_ID`. Si vacío, `/api/auth/google` responde 500; el resto OK. |
| `SMTP_USER` / `SMTP_PASS` | `''` | Credenciales de Gmail (contraseña de aplicación). Si faltan, el mailer entra en **modo no-op**. |

### 2.5 Backend — diseño

Patrón **MVC clásico** bajo `backend/src/`, sin ORM (SQL a mano, con fines didácticos):

```
backend/src/
├── app.js              # construye la app Express (middlewares + rutas), no la arranca
├── server.js           # arranca el HTTP server en :4000, maneja shutdown
├── config.js           # lee process.env con fail-fast (JWT_SECRET obligatorio, sin placeholders)
├── db/
│   ├── connection.js   # singleton de better-sqlite3 (WAL, foreign_keys ON)
│   ├── migrate.js      # CREATE TABLE IF NOT EXISTS + migraciones idempotentes en código
│   ├── seed.js         # 12 ecopuntos de Bogotá con sus niveles (INSERT OR REPLACE)
│   └── reset.js        # borra el .db y reaplica migrate + seed
├── middleware/
│   ├── requireAuth.js  # verifica el JWT del header Authorization, rellena req.usuario
│   ├── errorHandler.js # centraliza errores → JSON, expone asyncHandler
│   └── notFound.js     # 404 en JSON (no el HTML por defecto de Express)
├── utils/response.js   # helpers ok()/fail() + clase HttpError
├── models/             # ÚNICO lugar que conoce SQL (queries puras)
├── controllers/        # validan + orquestan + serializan (no escriben SQL)
├── routes/             # tabla URL → controller + middleware, un archivo por recurso
└── services/
    ├── mailer.js       # nodemailer con fallback no-op si no hay SMTP
    └── templates.js    # plantillas HTML de bienvenida y confirmación
```

**Reglas de oro:** el modelo es el único que escribe SQL; el controlador valida/orquesta/serializa; la ruta solo decide URL + middleware.

**Contrato JSON unificado** — toda respuesta es una de estas dos formas:

```jsonc
{ "ok": true, "data": ... }
// o
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "email": "..." } } }
```

El frontend solo necesita mirar `ok`. Códigos de error usados: `VALIDATION_ERROR` (422), `INVALID_JSON` (400), `EMAIL_EN_USO` (409), `CREDENCIALES_INVALIDAS` / `NO_TOKEN` / `INVALID_TOKEN` / `TOKEN_EXPIRED` (401), `USUARIO_NO_ENCONTRADO` / `NOT_FOUND` (404), `GOOGLE_TOKEN_INVALIDO` / `GOOGLE_EMAIL_NO_VERIFICADO` (401), `INTERNAL_ERROR` (500).

#### Endpoints (`🔒` = requiere `Authorization: Bearer <token>`)

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| `POST` | `/api/auth/registro` | `{ nombre, email, password }` | `201 { token, usuario }` + email de bienvenida |
| `POST` | `/api/auth/login` | `{ email, password }` | `200 { token, usuario }` |
| `POST` | `/api/auth/google` | `{ credential }` (ID token de Google) | `200 { token, usuario }`; crea o linkea cuenta |
| 🔒 `GET` | `/api/auth/yo` | — | `200 { usuario }` (rehidrata sesión al recargar) |
| `GET` | `/api/ecopuntos` | — | `200 [{ id, name, address, hours, lat, lng, wasteLevels[] }]` |
| 🔒 `POST` | `/api/solicitudes` | `{ type, description, address, date, photoName?, solicitanteNombre, solicitanteTelefono }` | `201 { solicitud }` + email de confirmación |
| 🔒 `GET` | `/api/solicitudes/mias` | — | `200 { solicitudes: [...] }` |
| `GET` | `/api/health` | — | `200 { service, version, timestamp }` |

`usuario` = `{ id, nombre, email, creado_en }` (nunca incluye el hash). `type` ∈ `{muebles, colchones, escombros, otros}`, `date` en `YYYY-MM-DD`, `status` arranca en `pendiente`.

#### Modelo de datos (SQLite)

- **`usuarios`** — `email` UNIQUE (case-insensitive); `password_hash` **nullable** (los usuarios de Google no tienen); `google_sub` UNIQUE parcial para enlazar la cuenta de Google.
- **`ecopuntos`** — `id` TEXT (coincide con el shape que ya usaba el front); dirección, horario, lat/lng.
- **`ecopunto_niveles`** — 1:N con ecopuntos (nivel de llenado por tipo de residuo: nombre, porcentaje 0–100, color), `ON DELETE CASCADE`.
- **`solicitudes_recoleccion`** — pertenece a un usuario (`ON DELETE CASCADE`); tipo y estado validados con `CHECK`; fecha como TEXT ISO; datos de contacto del solicitante (pueden diferir de la cuenta).

Las migraciones son **idempotentes y defensivas**: `migrate.js` recrea la tabla `usuarios` en transacción si viene de un esquema viejo con `password_hash NOT NULL`, y agrega columnas faltantes con `ALTER TABLE` cuando hace falta.

#### Decisiones técnicas notables

- **JWT stateless** (sin sesiones en servidor) → escala horizontal sin estado compartido.
- **`better-sqlite3` síncrono** → código lineal sin wrappers de Promise; ideal para single-server.
- **`bcryptjs`** (JS puro) en vez de `bcrypt` nativo → evita problemas de compilación en Windows.
- **Login resistente a enumeración**: misma respuesta si el email no existe o si la contraseña es incorrecta.
- **`usuario_id` se toma del JWT, nunca del body** → un usuario no puede crear solicitudes a nombre de otro.
- **Verificación del ID token de Google** con `audience = GOOGLE_CLIENT_ID` → impide reusar tokens emitidos para otra app.
- **Correos fire-and-forget**: el mailer nunca lanza; si SMTP no está configurado, loguea `(no-op)` y la API responde igual.

### 2.6 Frontend — diseño

`src/` con componentes React + Tailwind. Puntos no obvios:

1. **Routing por hash, sin `react-router-dom`.** Aunque está en `package.json`, el "routing" vive en `App.tsx`: una variable `currentView` (`'login' | 'register' | 'map'`) se sincroniza con `window.location.hash`. Navegar = `window.location.hash = '#/...'`.

2. **Sesión real vía API.** `App.tsx` llama a `/api/auth/login` y `/api/auth/registro`, guarda el JWT en `localStorage.eco_token` y el usuario en `eco_user`. El cliente HTTP único es **`src/lib/api.ts`**: inyecta el `Bearer` token, parsea el envelope `{ ok, data, error }` y lanza `ApiError` si `ok=false`.

3. **Login con Google** (`GoogleSignInButton.tsx` + `GoogleOAuthProvider` en `main.tsx`): obtiene el `credential` de Google Identity Services y lo intercambia en `/api/auth/google` por el JWT propio. Si no hay `VITE_GOOGLE_CLIENT_ID`, todo el flujo de Google se desactiva limpiamente.

4. **Estado del mapa centralizado en `MapContext`** (`src/components/MapContext.tsx`): catálogo de ecopuntos (cargado desde `/api/ecopuntos`), punto seleccionado, ruta, modal, y el estado de **búsqueda por dirección + radio**. Los hijos del mapa no tienen estado de selección propio — todo pasa por `useMapContext()`.

5. **Búsqueda estilo Google Maps** (`src/lib/geo.ts`): autocompletado con la **Mapbox Search Box API** (mejor cobertura de POIs en Colombia que Geocoding v5), en dos pasos `suggest → retrieve`, con `debounce` para no pegarle a la API en cada tecla. Los ecopuntos visibles se derivan filtrando el catálogo por **distancia Haversine** dentro del radio elegido (`visibleEcopuntos`).

6. **Rutas de conducción**: la **Mapbox Directions API** se llama desde el cliente, con origen en la dirección buscada (o un fallback en el centro de Bogotá).

7. **React Compiler activado** (`babel-plugin-react-compiler` vía Vite): no hace falta `useMemo`/`useCallback` manuales salvo casos puntuales.

### 2.7 Pruebas

El backend trae un **smoke test** (`scripts/smoke.js`) que ejercita los endpoints contra el server local:

```bash
cd backend
npm run dev          # terminal 1
npm run test:smoke   # terminal 2  → esperado: "N ok, 0 fallidos"
```

No hay suite de pruebas unitarias formal; el enfoque es smoke + revisión manual (proyecto académico).

### 2.8 Convenciones del repositorio

- Rama `master`/`main` recibe merges desde `dev`; el trabajo va en ramas `feat/<modulo>` integradas vía PR contra `dev`. **No** se hace push directo a `master`/`dev`.
- Comentarios del backend en **español**, tono didáctico (el "porqué" importa tanto como el "qué").
- Skills externas fijadas en `skills-lock.json` (no editar a mano).

---

## 3. Documentación adicional

- **`CLAUDE.md`** — guía para asistentes IA (y humanos): decisiones de arquitectura no obvias.
- **`backend/README.md`** — detalle de endpoints, contrato JSON y guía de integración frontend↔backend.
- **`docs/superpowers/specs/`** y **`docs/superpowers/plans/`** — specs y planes de implementación versionados (búsqueda en mapa, emails + Google OAuth).
```