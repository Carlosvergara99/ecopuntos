# Revisión y mejoras Ecopuntos — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Humanizar los comentarios del backend (tono "estudiantes de ingeniería tras una noche de café", spanglish moderado, sin libro de texto generado por IA), endurecer el backend (fail-fast real del `JWT_SECRET`, validación semántica de fechas), conectar el frontend al backend (login/registro/listado de ecopuntos/creación de solicitudes) y dejar la documentación del repo coherente.

**Architecture:** El backend ya está completo (Express + better-sqlite3 + JWT + smoke test). La humanización toca **únicamente comentarios** — el código ejecutable no cambia y el smoke test debe seguir verde después de cada commit. Las correcciones de seguridad/validación se hacen en su sitio sin reabrir el patrón MVC, y los comentarios añadidos en esos archivos respetan el estilo nuevo. La integración añade un cliente único `src/lib/api.ts` que centraliza llamadas y manejo del token; los componentes existentes pasan a llamarlo, manteniendo el flujo de navegación por hash y `localStorage` que ya describe `CLAUDE.md`. Las pruebas existentes del backend (`backend/scripts/smoke.js`) se extienden para cubrir las correcciones; el frontend se verifica manualmente porque no hay framework de pruebas montado (montarlo está fuera de alcance).

**Tech Stack:** Backend: Node 18+, Express 4, better-sqlite3, bcryptjs, jsonwebtoken, dotenv. Frontend: React 19, Vite 8, TypeScript, Tailwind 3, react-map-gl. Gestores: `npm` (backend) y `pnpm` (frontend). Rama: `feat/backend`. Sin push.

---

## Hallazgos del review (resumen)

**Backend — tono de los comentarios:**

Todo el backend (`backend/src/**/*.js`, `backend/scripts/smoke.js`, `backend/.env.example`) tiene comentarios estilo "manual didáctico generado por IA": cajas ASCII de líneas `─`, JSDoc gigante, listas con guiones, explicaciones de libro. Para un proyecto académico real, esto delata su origen y se siente impersonal. Hay que reescribirlos al estilo de un grupo de compañeros que sacó adelante el proyecto: notas cortas sobre el porqué, marcadores `// Ojo:`, `// FIXME:`, `// TODO:`, spanglish moderado (request, endpoint, middleware, JWT, payload, JOIN, FK), referencias al contexto académico ("para la entrega", "frente al profe") sin abusar. **No se toca el código ejecutable, solo comentarios.**

**Backend — bugs reales:**

1. `backend/src/config.js:31` — `required('JWT_SECRET', 'cambia-esto-en-produccion')` pretende ser "fail-fast" pero el fallback `'cambia-esto-en-produccion'` es truthy: si `JWT_SECRET` está vacío o ausente, `required` igual lo acepta. Además `backend/.env` literalmente contiene ese valor placeholder (idéntico a `.env.example`). Resultado: el "secreto" para firmar JWTs en este repo es público en la plantilla. Hay que (a) que `required` no tenga fallback que oculte la falla, y (b) rechazar explícitamente el valor placeholder.

2. `backend/src/controllers/solicitudesController.js:22` — `FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/` acepta fechas inexistentes como `2026-13-99` o `0000-00-00`. La columna `fecha` queda con basura. Hay que validar que sea una fecha real (`Date` parseable y que el round-trip a `YYYY-MM-DD` coincida) y, dado que es una solicitud de recolección, exigir que no sea pasada.

**Backend — no bugs pero conviene confirmar:**

- `backend/.env` no está trackeado por git (verificado: `git ls-files backend/.env` no devuelve nada). OK.
- Smoke test cubre auth, ecopuntos y solicitudes con ramas felices y de error. Tras los cambios de Phase 2, se añaden 2 tests nuevos.

**Frontend — bugs reales:**

- Ninguno bloqueante. Lo que `CLAUDE.md` describe como "hardcodeado" (handlers de login/register, `ECO_PUNTOS`, webhook del modal) está documentado como decisión temporal "hasta conectar el backend". Esos NO son bugs; son integración pendiente y se atacan en Phase 3.
- El token Mapbox del `.env` tiene 4 segmentos (inválido); produce 401 en Mapbox y el banner del MapView solo se dispara cuando el token está vacío. Eso sí es un bug de detección, pero está en código del otro estudiante (`MapView.tsx`) y el usuario sabe que el token hay que conseguirlo aparte. **No se toca** salvo que el usuario lo pida.

**Frontend ↔ backend — integración:**

- Hoy el frontend no consume el backend. `CLAUDE.md` y `backend/README.md` documentan exactamente qué tres lugares cambiar. Phase 3 ejecuta esa integración: cliente API + login/registro real + listado de ecopuntos desde la API + POST de solicitudes.

**Docs:**

- `backend/README.md` está completo y coherente con el código (revisado endpoint por endpoint).
- `README.md` (raíz) es el template default de Vite. Phase 4 lo reemplaza por un README específico del proyecto.

**Seguridad básica:**

- CORS limitado a `http://localhost:5173`. OK para desarrollo.
- Rate limiting en `/api/auth/login`: fuera de alcance (académico, sin tráfico real).
- Helmet/compression: fuera de alcance.

---

## Estructura de archivos (qué se toca y por qué)

| Archivo | Acción | Responsabilidad |
|---|---|---|
| **Phase 1 — humanización (solo comentarios, código ejecutable intacto)** | | |
| `backend/src/app.js` | reescribir comentarios | Tono "estudiante", marcadores `// Ojo:` en CORS y orden de middlewares. |
| `backend/src/config.js` | reescribir comentarios | Eliminar disertación sobre fail-fast; dejar nota corta. |
| `backend/src/server.js` | reescribir comentarios | Quitar el cajón ASCII; nota breve sobre shutdown. |
| `backend/src/utils/response.js` | reescribir comentarios | Nota corta del contrato `{ ok, data, error }`. |
| `backend/src/middleware/errorHandler.js` | reescribir comentarios | `// Ojo:` sobre la firma de 4 args, sin la lista didáctica. |
| `backend/src/middleware/notFound.js` | reescribir comentarios | Una sola línea: por qué existe. |
| `backend/src/middleware/requireAuth.js` | reescribir comentarios | Nota corta sobre Bearer y expiración. |
| `backend/src/models/usuariosModel.js` | reescribir comentarios | `// Ojo:` sobre no exponer `password_hash`. |
| `backend/src/models/ecopuntosModel.js` | reescribir comentarios | Nota breve sobre dos queries + agrupación. |
| `backend/src/models/solicitudesModel.js` | reescribir comentarios | Nota breve sobre filtro por usuario. |
| `backend/src/controllers/authController.js` | reescribir comentarios | `// FIXME:`/`// Ojo:` en validación manual y bcrypt; cortar la disertación. |
| `backend/src/controllers/ecopuntosController.js` | reescribir comentarios | Nota corta sobre el mapeo ES→EN. |
| `backend/src/controllers/solicitudesController.js` | reescribir comentarios | `// Ojo:` sobre tomar `usuario_id` del JWT, no del body. |
| `backend/src/routes/authRoutes.js` | reescribir comentarios | Una línea por router. |
| `backend/src/routes/ecopuntosRoutes.js` | reescribir comentarios | Idem. |
| `backend/src/routes/solicitudesRoutes.js` | reescribir comentarios | `// Ojo:` sobre el `router.use(requireAuth)` aplicado a todo. |
| `backend/src/db/connection.js` | reescribir comentarios | Nota corta de WAL + foreign_keys. |
| `backend/src/db/migrate.js` | reescribir comentarios | Comentarios SQL más casuales; conservar el "porqué" de NOCASE y CASCADE. |
| `backend/src/db/seed.js` | reescribir comentarios | Nota sobre transaction + INSERT OR REPLACE. |
| `backend/src/db/reset.js` | reescribir comentarios | `// Ojo:` sobre destrucción + WAL files. |
| `backend/scripts/smoke.js` | reescribir comentarios | Header corto; quitar la introducción larga. |
| `backend/.env.example` | reescribir comentarios | Comentarios mínimos por variable, sin teoría 12-factor. |
| **Phase 2 — hardening backend** | | |
| `backend/src/config.js` | modificar | Eliminar fallback inseguro de `JWT_SECRET` y rechazar el placeholder. |
| `backend/.env.example` | modificar | Documentar que `JWT_SECRET` debe cambiarse antes de arrancar. |
| `backend/.env` | modificar (local, no se commitea) | Reemplazar el placeholder por un secreto generado. |
| `backend/src/controllers/solicitudesController.js` | modificar | Validación semántica de `date` (fecha real, no pasada). |
| `backend/scripts/smoke.js` | modificar | Tests para los dos cambios anteriores. |
| **Phase 3 — integración frontend ↔ backend** | | |
| `src/lib/api.ts` | crear | Cliente fetch único: maneja token, parsea contrato `{ ok, data, error }`. |
| `src/vite-env.d.ts` | crear | Declarar `VITE_API_URL` y `VITE_MAPBOX_TOKEN` para que TS los conozca. |
| `.env` (raíz, local) | modificar | Añadir `VITE_API_URL=http://localhost:4000`. |
| `src/data/ecopuntos.ts` | modificar | Mantener el tipo `EcoPunto` / `WasteLevel`. Eliminar la constante `ECO_PUNTOS` (deja de ser fuente de verdad). |
| `src/components/LoginView.tsx` | modificar | Capturar email/password y pasarlos a `onLogin`. Mostrar errores. |
| `src/components/RegisterView.tsx` | modificar | Capturar nombre/email/password y pasarlos a `onRegister`. Mostrar errores. |
| `src/App.tsx` | modificar | `handleLogin`/`handleRegister` async que llaman al backend; persistir `eco_token` y `eco_user`; manejar errores; `handleLogout` borra `eco_token`. |
| `src/components/MapContext.tsx` | modificar | Owner del fetch de `/api/ecopuntos`. Expone `ecopuntos`, `isLoadingEcopuntos`, `errorEcopuntos` en el estado del contexto. |
| `src/components/MapView.tsx` | modificar mínima | `EcoPuntoMarkers` lee `ecopuntos` del contexto en vez de importar `ECO_PUNTOS`. Sin tocar estilos. |
| `src/components/VoluminousWasteModal.tsx` | modificar | `handleConfirm` llama a `/api/solicitudes` vía `api()` en vez del webhook. |
| **Phase 4 — documentación raíz** | | |
| `README.md` (raíz) | reemplazar | README del proyecto Ecopuntos (no template Vite). |

---

## Phase 0 — Baseline de verificación

Antes de tocar nada, dejar registro del estado actual: smoke test corriendo, build TS sin errores, lint limpio. Si alguno falla AHORA, el plan no es de mejora sino de reparación.

### Task 0.1: Verificar instalación y build del frontend

**Files:** ninguno se modifica.

- [ ] **Step 1: Confirmar que las dependencias del frontend están instaladas**

Run: `pnpm install`  
Expected: termina sin errores o reporta "Already up to date" si `node_modules/` ya está actualizado. Si `pnpm` no está en PATH usar `corepack pnpm install` o `npx --yes pnpm@latest install`.

- [ ] **Step 2: Build TS + Vite**

Run: `pnpm build`  
Expected: termina sin errores (`tsc -b && vite build`). Si hay errores TS, anotarlos: indican estado roto previo, no causado por el plan.

- [ ] **Step 3: Lint**

Run: `pnpm lint`  
Expected: idealmente sin errores. Anotar warnings que ya existían — no son introducidos por el plan.

### Task 0.2: Verificar smoke test del backend

**Files:** ninguno se modifica.

- [ ] **Step 1: Instalar dependencias del backend**

Run: `cd backend && npm install`  
Expected: termina sin errores.

- [ ] **Step 2: Reset de base para una corrida limpia**

Run: `cd backend && npm run db:reset`  
Expected:
```
[reset] Eliminado: .../backend/ecopuntos.db
[migrate] Esquema aplicado correctamente.
[seed] Insertados 3 ecopuntos con sus niveles.
[reset] Base reiniciada y poblada con datos iniciales.
```

- [ ] **Step 3: Arrancar el servidor en background**

Run: `cd backend && npm run dev` (en una terminal aparte o background)  
Expected log:
```
[db] Conectado a SQLite en .../backend/ecopuntos.db
[ecopuntos-backend] Escuchando en http://localhost:4000
```

- [ ] **Step 4: Correr el smoke test**

Run: `cd backend && npm run test:smoke`  
Expected: `14 ok, 0 fallidos` (según README). Anotar el número exacto; si no son 14, anotar la lista. Si algo falla AHORA, parar el plan y diagnosticar antes de seguir.

- [ ] **Step 5: Detener el servidor**

Ctrl+C en la terminal donde corre, o `kill` del PID.

---

## Phase 1 — Humanización de comentarios del backend

⚠️ **Solo se tocan comentarios. El código ejecutable NO cambia.** Después de cada commit de esta fase, `npm run test:smoke` debe seguir verde con el mismo número de tests que en Phase 0.

### Task 1.0: Guía de estilo (anchor)

Esta guía la sigue cada subtarea. Resumen para revisar de un vistazo:

**Hacer:**
- Comentarios cortos. Casi siempre 1–3 líneas. Si necesitas más, replantea.
- Tono directo, casual, "compañero a compañero". Spanglish moderado de términos técnicos en inglés: `request`, `response`, `endpoint`, `middleware`, `JWT`, `payload`, `body`, `header`, `hash`, `JOIN`, `FK`, `query`.
- Marcadores cuando aporten:
  - `// Ojo:` — algo que no se puede mover/cambiar sin romper.
  - `// FIXME:` — pendiente real que sabemos que falta.
  - `// TODO:` — mejora futura, no bloqueante para la entrega.
  - `// Nota:` — explicación corta del porqué, no del qué.
- Referencias al contexto académico OK con moderación: "para la entrega", "frente al profe", "el front", "el parcial". Una o dos por archivo, no en cada función.
- Conservar la información técnica que un junior necesita (por qué WAL, por qué bcrypt rounds=10, por qué no incluir stack en errores) pero en versión "ya lo sufrimos, anota".

**No hacer:**
- Cajas ASCII de `─────────────` ni headings tipo `───────────`.
- JSDoc gigantes con `@param`/`@returns` para funciones internas obvias. Conservar JSDoc breve solo donde aporta tipos no triviales.
- Comentarios que repiten lo que dice el nombre de la función o de la variable.
- Listas didácticas con guiones de tres niveles. Si tu comentario tiene viñetas, ya es demasiado largo.
- Disertaciones de libro tipo "El principio de fail-fast establece que…". Si es importante: una línea con la consecuencia práctica.
- Emojis. Esto es código, no Slack.

**Ejemplo de antes/después (config.js):**

ANTES:
```js
// ─────────────────────────────────────────────────────────────────────────────
//  config.js
//  ─────────
//  Carga las variables de entorno desde `.env` (vía dotenv) y las expone
//  como un OBJETO TIPADO. Centralizar la configuración aquí da dos ventajas:
//
//  1. Un solo punto donde leer process.env. El resto del código importa
//     `config` y obtiene valores ya validados, sin repetir defaults.
//  2. Si falta una variable crítica, el servidor falla AL ARRANCAR (no a
//     mitad de una petición). Esta técnica se llama "fail fast" — es
//     preferible a descubrir el bug en producción cuando un usuario real
//     dispare el endpoint que la necesita.
// ─────────────────────────────────────────────────────────────────────────────
```

DESPUÉS:
```js
// Toda la config en un solo lugar. Si falta una env crítica, que reviente
// al arrancar y no a mitad de un request frente al profe.
```

**Ejemplo de antes/después (errorHandler.js):**

ANTES:
```js
//  ¿Por qué centralizar errores?
//  ─────────────────────────────
//  - Un solo lugar para loggear y dar formato a la respuesta.
//  - Los controladores quedan "ingenuos": hacen `throw new HttpError(...)`
//    o dejan que la excepción se propague, y este middleware se encarga.
//  - Evita repetir bloques try/catch en cada controlador.
```

DESPUÉS:
```js
// Manejador global de errores. Ojo: la firma DEBE tener (err, req, res, next)
// con los 4 args o Express no lo reconoce como error handler.
```

### Task 1.1: Núcleo (`app.js`, `server.js`, `config.js`)

**Files:**
- Modify: `backend/src/app.js`
- Modify: `backend/src/server.js`
- Modify: `backend/src/config.js`

- [ ] **Step 1: Reescribir comentarios en `app.js`**

Edit `backend/src/app.js` aplicando la guía. Conservar todo el código ejecutable. Resultado esperado del archivo:

```js
// Construye la app Express. La arrancamos en server.js — partirlos
// nos sirve para testear con supertest sin levantar puerto real.

import express from 'express';
import cors from 'cors';

import { config } from './config.js';
import { ok } from './utils/response.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import ecopuntosRoutes from './routes/ecopuntosRoutes.js';
import solicitudesRoutes from './routes/solicitudesRoutes.js';

export function buildApp() {
  const app = express();

  // Ojo: el orden de los middlewares importa. CORS primero, body parser
  // después, rutas, y al final notFound + errorHandler. Si mueves esto
  // se rompe el front (CORS) o los errores dejan de devolver JSON.

  // CORS solo para el dev-server de Vite. Para producción ampliar la
  // lista en config.corsOrigin.
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );

  // Body parser. Límite de 1MB para que no nos manden el universo.
  app.use(express.json({ limit: '1mb' }));

  // Healthcheck para que el front confirme conectividad antes de mostrar
  // pantallas de error feas frente al profe.
  app.get('/api/health', (req, res) => {
    return ok(res, {
      service: 'ecopuntos-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    });
  });

  // Rutas. Un router por recurso para que app.js no se vuelva un monstruo.
  app.use('/api/auth', authRoutes);
  app.use('/api/ecopuntos', ecopuntosRoutes);
  app.use('/api/solicitudes', solicitudesRoutes);

  // Ojo: estos dos van SIEMPRE al final. Si los pones antes de las rutas
  // todo cae al 404.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 2: Reescribir comentarios en `server.js`**

Edit `backend/src/server.js`. Resultado:

```js
// Punto de entrada. Solo construye la app y la pone a escuchar.
// Cualquier lógica de negocio NO va acá.

import { buildApp } from './app.js';
import { config } from './config.js';

const app = buildApp();

const server = app.listen(config.port, () => {
  console.log(`[ecopuntos-backend] Escuchando en http://localhost:${config.port}`);
  console.log(`[ecopuntos-backend] CORS permitido para: ${config.corsOrigin}`);
});

// Shutdown limpio: si llega SIGINT (Ctrl+C) o SIGTERM, cerramos las
// conexiones en vuelo antes de salir. Sin esto, el cliente ve ECONNRESET.
function shutdown(signal) {
  console.log(`\n[ecopuntos-backend] Señal ${signal} recibida. Cerrando servidor...`);
  server.close(() => {
    console.log('[ecopuntos-backend] Servidor cerrado. Adiós.');
    process.exit(0);
  });

  // Si en 10s no cierra, lo forzamos. Mejor que quedar colgado.
  setTimeout(() => {
    console.warn('[ecopuntos-backend] Timeout al cerrar. Forzando exit.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

- [ ] **Step 3: Reescribir comentarios en `config.js`**

Edit `backend/src/config.js`. Resultado:

```js
// Toda la config en un solo lugar. Si falta una env crítica, que reviente
// al arrancar y no a mitad de un request frente al profe.

import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(
      `[config] Falta la variable de entorno ${name}. Revisa tu .env (usa .env.example como plantilla).`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH ?? './ecopuntos.db',
  jwtSecret: required('JWT_SECRET', 'cambia-esto-en-produccion'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',

  // Útil para condicionar logs en dev vs prod.
  isProd: process.env.NODE_ENV === 'production',
};
```

> Nota: el bug del fallback `'cambia-esto-en-produccion'` se arregla en Phase 2.1. Aquí solo se reescribe el comentario.

- [ ] **Step 4: Smoke + commit**

```bash
cd backend
npm run dev    # background, en otra terminal
npm run test:smoke
```

Expected: mismo conteo `14 ok, 0 fallidos` que en Phase 0. Si baja: revertir y diagnosticar (no se debió haber tocado código ejecutable).

```bash
git add backend/src/app.js backend/src/server.js backend/src/config.js
git commit -m "style(backend): humanizar comentarios del nucleo (app, server, config)"
```

### Task 1.2: Middleware + utils (`errorHandler`, `notFound`, `requireAuth`, `response`)

**Files:**
- Modify: `backend/src/utils/response.js`
- Modify: `backend/src/middleware/errorHandler.js`
- Modify: `backend/src/middleware/notFound.js`
- Modify: `backend/src/middleware/requireAuth.js`

- [ ] **Step 1: Reescribir `utils/response.js`**

Resultado:

```js
// Contrato JSON unificado:
//   éxito  -> { ok: true,  data }
//   error  -> { ok: false, error: { code, message, details? } }
// El front solo revisa `ok`. Si cada endpoint inventa su forma, sufrimos.

export function ok(res, data, status = 200) {
  return res.status(status).json({ ok: true, data });
}

// status: HTTP. code: UPPER_SNAKE. message: en español, para humanos.
// details: opcional (ej. errores de validación campo a campo). NUNCA
// poner stack traces acá — eso va al log, no al cliente.
export function fail(res, status, code, message, details) {
  const payload = { ok: false, error: { code, message } };
  if (details !== undefined) payload.error.details = details;
  return res.status(status).json(payload);
}

// Error "tipado" para que los controllers lo tiren con throw y caigan
// limpios en errorHandler. Ahorra mucho if/return res.status().
export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
```

- [ ] **Step 2: Reescribir `middleware/errorHandler.js`**

Resultado:

```js
// Manejador global de errores. Ojo: la firma DEBE tener (err, req, res, next)
// con los 4 args o Express no lo reconoce como error handler — aunque no uses
// `next`, déjalo ahí.

import { HttpError, fail } from '../utils/response.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // 1) Errores nuestros lanzados con HttpError.
  if (err instanceof HttpError) {
    return fail(res, err.status, err.code, err.message, err.details);
  }

  // 2) JSON inválido del body parser de Express.
  if (err?.type === 'entity.parse.failed') {
    return fail(res, 400, 'INVALID_JSON', 'El cuerpo de la petición no es JSON válido.');
  }

  // 3) Cualquier otra cosa. FIXME: en algún momento mandar esto a un agregador
  // de logs en vez de console.error. Por ahora pasa derecho para la entrega.
  console.error('[errorHandler] Error no controlado:', err);
  return fail(res, 500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado en el servidor.');
}

// Express 4 no atrapa promesas rechazadas en handlers async — este wrapper
// las redirige a `next(err)` para que caigan en errorHandler. Tres líneas
// que nos ahorran un try/catch en cada controller.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
```

- [ ] **Step 3: Reescribir `middleware/notFound.js`**

Resultado:

```js
// Cuando ninguna ruta matchea, Express por defecto devuelve HTML ("Cannot
// GET /xxx"). Eso rompe el contrato JSON, así que lo atrapamos acá.
// Va montado DESPUÉS de todas las rutas en app.js.

import { fail } from '../utils/response.js';

export function notFound(req, res) {
  return fail(
    res,
    404,
    'NOT_FOUND',
    `La ruta ${req.method} ${req.originalUrl} no existe.`
  );
}
```

- [ ] **Step 4: Reescribir `middleware/requireAuth.js`**

Resultado:

```js
// Verifica el JWT del header Authorization: Bearer <token>.
// Si pasa, deja al usuario en req.usuario para los controllers.
//
// Nota: JWT es stateless — no guardamos sesiones en el server. Ventaja:
// escala fácil. Desventaja: no se puede "invalidar" un token antes de su
// expiración sin armar una blacklist, así que usamos expiración corta (2h).

import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { HttpError } from '../utils/response.js';

export function requireAuth(req, res, next) {
  const header = req.get('Authorization') ?? '';

  // Esperamos exactamente "Bearer <token>" (RFC 6750).
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'NO_TOKEN', 'Falta el header Authorization: Bearer <token>.'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
    };
    return next();
  } catch (err) {
    // jsonwebtoken distingue el tipo de fallo por err.name.
    if (err.name === 'TokenExpiredError') {
      return next(new HttpError(401, 'TOKEN_EXPIRED', 'El token expiró. Vuelve a iniciar sesión.'));
    }
    return next(new HttpError(401, 'INVALID_TOKEN', 'Token inválido o malformado.'));
  }
}
```

- [ ] **Step 5: Smoke + commit**

```bash
npm run test:smoke
```

Expected: `14 ok, 0 fallidos`.

```bash
git add backend/src/utils/response.js backend/src/middleware/errorHandler.js backend/src/middleware/notFound.js backend/src/middleware/requireAuth.js
git commit -m "style(backend): humanizar comentarios de middleware y utils"
```

### Task 1.3: Models (`usuariosModel`, `ecopuntosModel`, `solicitudesModel`)

**Files:**
- Modify: `backend/src/models/usuariosModel.js`
- Modify: `backend/src/models/ecopuntosModel.js`
- Modify: `backend/src/models/solicitudesModel.js`

- [ ] **Step 1: Reescribir `usuariosModel.js`**

Resultado:

```js
// Acceso a la tabla `usuarios`. Acá vive TODO el SQL de usuarios — los
// controllers no escriben queries a mano. Si mañana cambiamos a Postgres,
// solo reescribimos este archivo.

import { db } from '../db/connection.js';

// Statements preparadas — se compilan una vez al cargar el módulo y se
// reusan. Más rápido y a prueba de inyección SQL (los params van ligados,
// no concatenados).
const stmtFindByEmail = db.prepare(`
  SELECT id, nombre, email, password_hash, creado_en
  FROM usuarios
  WHERE email = ? COLLATE NOCASE
`);

const stmtFindById = db.prepare(`
  SELECT id, nombre, email, creado_en
  FROM usuarios
  WHERE id = ?
`);

const stmtInsert = db.prepare(`
  INSERT INTO usuarios (nombre, email, password_hash)
  VALUES (@nombre, @email, @password_hash)
`);

// Trae el usuario CON password_hash — solo para verificar el login.
// Ojo: NUNCA devolver esto tal cual al cliente, filtrar antes.
export function buscarPorEmail(email) {
  return stmtFindByEmail.get(email);
}

// Versión segura: NO trae password_hash. Esta sí se puede serializar.
export function buscarPorId(id) {
  return stmtFindById.get(id);
}

// Inserta y devuelve el registro creado (sin hash).
// Si el email ya existe, better-sqlite3 tira un error con
// code === 'SQLITE_CONSTRAINT_UNIQUE' — lo traduce el controller a HTTP 409.
export function crear({ nombre, email, password_hash }) {
  const info = stmtInsert.run({ nombre, email, password_hash });
  return buscarPorId(info.lastInsertRowid);
}
```

- [ ] **Step 2: Reescribir `ecopuntosModel.js`**

Resultado:

```js
// Acceso a `ecopuntos` y su tabla relacionada `ecopunto_niveles`.
//
// Para devolver "ecopuntos con niveles" hacemos dos queries y agrupamos
// en JS, en vez de un JOIN con filas duplicadas. Con 3 puntos es trivial;
// con miles también sigue siendo más eficiente porque SQLite serializa
// menos bytes. Si más adelante pide paginación, hay que revisar esto.

import { db } from '../db/connection.js';

const stmtAllEcopuntos = db.prepare(`
  SELECT id, nombre, direccion, horario, lat, lng
  FROM ecopuntos
  ORDER BY id
`);

const stmtAllNiveles = db.prepare(`
  SELECT ecopunto_id, nombre, porcentaje, color
  FROM ecopunto_niveles
`);

// Devuelve los ecopuntos con sus niveles anidados (campos en español;
// el controller los traduce al inglés que espera el front).
export function listarTodos() {
  const ecopuntos = stmtAllEcopuntos.all();
  const niveles = stmtAllNiveles.all();

  // Map<ecopunto_id, niveles[]> para agrupar en O(1).
  const nivelesPorPunto = new Map();
  for (const nivel of niveles) {
    if (!nivelesPorPunto.has(nivel.ecopunto_id)) {
      nivelesPorPunto.set(nivel.ecopunto_id, []);
    }
    nivelesPorPunto.get(nivel.ecopunto_id).push({
      nombre: nivel.nombre,
      porcentaje: nivel.porcentaje,
      color: nivel.color,
    });
  }

  return ecopuntos.map((eco) => ({
    ...eco,
    niveles: nivelesPorPunto.get(eco.id) ?? [],
  }));
}
```

- [ ] **Step 3: Reescribir `solicitudesModel.js`**

Resultado:

```js
// Acceso a `solicitudes_recoleccion`. Cada fila pertenece a un usuario (FK),
// así que las queries SIEMPRE filtran por usuario_id — ningún usuario
// debería ver las solicitudes de otro.

import { db } from '../db/connection.js';

const stmtInsert = db.prepare(`
  INSERT INTO solicitudes_recoleccion
    (usuario_id, tipo, descripcion, direccion, fecha, nombre_foto)
  VALUES
    (@usuario_id, @tipo, @descripcion, @direccion, @fecha, @nombre_foto)
`);

const stmtFindById = db.prepare(`
  SELECT id, usuario_id, tipo, descripcion, direccion, fecha,
         nombre_foto, estado, creado_en
  FROM solicitudes_recoleccion
  WHERE id = ?
`);

const stmtListByUser = db.prepare(`
  SELECT id, usuario_id, tipo, descripcion, direccion, fecha,
         nombre_foto, estado, creado_en
  FROM solicitudes_recoleccion
  WHERE usuario_id = ?
  ORDER BY creado_en DESC, id DESC
`);

export function crear(datos) {
  const info = stmtInsert.run({
    usuario_id: datos.usuario_id,
    tipo: datos.tipo,
    descripcion: datos.descripcion,
    direccion: datos.direccion,
    fecha: datos.fecha,
    nombre_foto: datos.nombre_foto ?? null,
  });
  return stmtFindById.get(info.lastInsertRowid);
}

export function listarPorUsuario(usuario_id) {
  return stmtListByUser.all(usuario_id);
}
```

- [ ] **Step 4: Smoke + commit**

```bash
npm run test:smoke
```

Expected: `14 ok, 0 fallidos`.

```bash
git add backend/src/models/
git commit -m "style(backend): humanizar comentarios de models"
```

### Task 1.4: Controllers (`authController`, `ecopuntosController`, `solicitudesController`)

**Files:**
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/controllers/ecopuntosController.js`
- Modify: `backend/src/controllers/solicitudesController.js`

- [ ] **Step 1: Reescribir `authController.js`**

Resultado:

```js
// Controller de auth: registro, login y "yo" (datos del usuario actual).
// El SQL vive en el model — acá solo validamos, llamamos al model,
// firmamos el JWT y respondemos.

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { config } from '../config.js';
import { HttpError, ok } from '../utils/response.js';
import * as Usuarios from '../models/usuariosModel.js';

// 10 rounds = ~100ms por hash. Suficiente para que un atacante no itere
// tan tranquilo. Si la entrega pide más, subir a 12 (4x más lento).
const BCRYPT_ROUNDS = 10;

// Validación a mano. FIXME: cuando el proyecto crezca usar Zod/Joi en vez
// de seguir escribiendo esto manual. Por ahora pasa derecho para la entrega.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarRegistro(body) {
  const errores = {};

  if (typeof body?.nombre !== 'string' || body.nombre.trim().length < 2) {
    errores.nombre = 'Debe tener al menos 2 caracteres.';
  }
  if (typeof body?.email !== 'string' || !EMAIL_REGEX.test(body.email)) {
    errores.email = 'Email no válido.';
  }
  if (typeof body?.password !== 'string' || body.password.length < 6) {
    errores.password = 'La contraseña debe tener al menos 6 caracteres.';
  }

  if (Object.keys(errores).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Datos inválidos.', errores);
  }
}

function validarLogin(body) {
  if (typeof body?.email !== 'string' || typeof body?.password !== 'string') {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Email y password son obligatorios.');
  }
}

function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, nombre: usuario.nombre },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

// POST /api/auth/registro -> { token, usuario }
export async function registro(req, res) {
  validarRegistro(req.body);

  const { nombre, email, password } = req.body;

  // Hasheamos ANTES de tocar la base — si bcrypt explota, al menos no
  // quedamos con un usuario huérfano en la tabla.
  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  let usuario;
  try {
    usuario = Usuarios.crear({ nombre: nombre.trim(), email: email.trim(), password_hash });
  } catch (err) {
    // El UNIQUE en email rebota como SQLITE_CONSTRAINT_UNIQUE.
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new HttpError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese email.');
    }
    throw err;
  }

  const token = firmarToken(usuario);
  return ok(res, { token, usuario }, 201);
}

// POST /api/auth/login -> { token, usuario }
export async function login(req, res) {
  validarLogin(req.body);

  const { email, password } = req.body;
  const fila = Usuarios.buscarPorEmail(email);

  // Ojo: respondemos lo MISMO si el email no existe o si el password está
  // mal. Si distinguiéramos, un atacante podría enumerar emails registrados.
  const passwordOk = fila ? await bcrypt.compare(password, fila.password_hash) : false;
  if (!fila || !passwordOk) {
    throw new HttpError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos.');
  }

  const usuario = { id: fila.id, nombre: fila.nombre, email: fila.email, creado_en: fila.creado_en };
  const token = firmarToken(usuario);
  return ok(res, { token, usuario });
}

// GET /api/auth/yo (protegido) — para que el front rehidrate la sesión
// al recargar: guarda solo el token y al arrancar pide acá los datos.
export function yo(req, res) {
  const usuario = Usuarios.buscarPorId(req.usuario.id);
  if (!usuario) {
    throw new HttpError(404, 'USUARIO_NO_ENCONTRADO', 'El usuario del token ya no existe.');
  }
  return ok(res, { usuario });
}
```

- [ ] **Step 2: Reescribir `ecopuntosController.js`**

Resultado:

```js
// GET /api/ecopuntos — sirve el catálogo que pinta el front en el mapa.
// Por ahora solo lectura; si después se pide crear/editar, agregar rutas
// protegidas con requireAuth + rol "admin".

import { ok } from '../utils/response.js';
import * as Ecopuntos from '../models/ecopuntosModel.js';

// El front usa campos en inglés (name, address, hours, wasteLevels[]).
// El model los tiene en español. Acá traducimos para no obligar al compa
// del front a renombrar nada. Renombrar columnas no rompe el contrato.
function aFormatoFrontend(eco) {
  return {
    id: eco.id,
    name: eco.nombre,
    address: eco.direccion,
    hours: eco.horario,
    lat: eco.lat,
    lng: eco.lng,
    wasteLevels: eco.niveles.map((n) => ({
      name: n.nombre,
      percentage: n.porcentaje,
      color: n.color,
    })),
  };
}

// No requiere auth — el mapa se ve también para anónimos (igual que en
// el frontend actual).
export function listar(req, res) {
  const datos = Ecopuntos.listarTodos();
  return ok(res, datos.map(aFormatoFrontend));
}
```

- [ ] **Step 3: Reescribir `solicitudesController.js`**

Resultado:

```js
// Solicitudes de recolección. Todas las rutas están protegidas con
// requireAuth — un usuario solo crea y ve LO SUYO.
//
// Contrato del body (desde VoluminousWasteModal.tsx):
//   { type, description, address, date (YYYY-MM-DD), photoName? }

import { ok, HttpError } from '../utils/response.js';
import * as Solicitudes from '../models/solicitudesModel.js';

const TIPOS_VALIDOS = new Set(['muebles', 'colchones', 'escombros', 'otros']);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validarCrear(body) {
  const errores = {};
  if (!TIPOS_VALIDOS.has(body?.type)) {
    errores.type = `Debe ser uno de: ${[...TIPOS_VALIDOS].join(', ')}.`;
  }
  if (typeof body?.description !== 'string' || body.description.trim().length < 5) {
    errores.description = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.address !== 'string' || body.address.trim().length < 5) {
    errores.address = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.date !== 'string' || !FECHA_REGEX.test(body.date)) {
    errores.date = 'Debe tener formato YYYY-MM-DD.';
  }
  if (Object.keys(errores).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Datos inválidos.', errores);
  }
}

function aFormatoFrontend(s) {
  return {
    id: s.id,
    type: s.tipo,
    description: s.descripcion,
    address: s.direccion,
    date: s.fecha,
    photoName: s.nombre_foto,
    status: s.estado,
    createdAt: s.creado_en,
  };
}

// POST /api/solicitudes
// Ojo: usuario_id se saca del JWT (req.usuario), NUNCA del body. Si lo
// aceptáramos del body, cualquiera podría crear solicitudes a nombre de otro.
export function crear(req, res) {
  validarCrear(req.body);

  const fila = Solicitudes.crear({
    usuario_id: req.usuario.id,
    tipo: req.body.type,
    descripcion: req.body.description.trim(),
    direccion: req.body.address.trim(),
    fecha: req.body.date,
    nombre_foto: req.body.photoName ?? null,
  });

  return ok(res, { solicitud: aFormatoFrontend(fila) }, 201);
}

// GET /api/solicitudes/mias — lista las del usuario actual, recientes primero.
export function listarMias(req, res) {
  const filas = Solicitudes.listarPorUsuario(req.usuario.id);
  return ok(res, { solicitudes: filas.map(aFormatoFrontend) });
}
```

> Nota: la validación semántica de `date` que añade Phase 2.2 reemplaza completamente la función `validarCrear` de arriba. Está bien: ese reemplazo se hace en estilo humanizado desde el principio.

- [ ] **Step 4: Smoke + commit**

```bash
npm run test:smoke
```

Expected: `14 ok, 0 fallidos`.

```bash
git add backend/src/controllers/
git commit -m "style(backend): humanizar comentarios de controllers"
```

### Task 1.5: Routes (`authRoutes`, `ecopuntosRoutes`, `solicitudesRoutes`)

**Files:**
- Modify: `backend/src/routes/authRoutes.js`
- Modify: `backend/src/routes/ecopuntosRoutes.js`
- Modify: `backend/src/routes/solicitudesRoutes.js`

- [ ] **Step 1: Reescribir `authRoutes.js`**

Resultado:

```js
// Endpoints de auth. Acá solo decidimos URL + middleware; la lógica está
// en el controller. Un archivo por recurso para que app.js no se infle.

import { Router } from 'express';

import * as authController from '../controllers/authController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.post('/registro', asyncHandler(authController.registro));
router.post('/login',    asyncHandler(authController.login));
router.get('/yo',        requireAuth, asyncHandler(authController.yo));

export default router;
```

- [ ] **Step 2: Reescribir `ecopuntosRoutes.js`**

Resultado:

```js
// Endpoint rápido para los EcoPuntos que mapeamos en el front. Solo
// lectura por ahora.

import { Router } from 'express';

import * as ecopuntosController from '../controllers/ecopuntosController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', asyncHandler(ecopuntosController.listar));

export default router;
```

- [ ] **Step 3: Reescribir `solicitudesRoutes.js`**

Resultado:

```js
// Rutas de solicitudes — todas protegidas.
// Ojo: el `router.use(requireAuth)` aplica a TODAS las rutas de abajo;
// no hace falta poner el middleware en cada una.

import { Router } from 'express';

import * as solicitudesController from '../controllers/solicitudesController.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(requireAuth);

router.post('/',    asyncHandler(solicitudesController.crear));
router.get('/mias', asyncHandler(solicitudesController.listarMias));

export default router;
```

- [ ] **Step 4: Smoke + commit**

```bash
npm run test:smoke
```

Expected: `14 ok, 0 fallidos`.

```bash
git add backend/src/routes/
git commit -m "style(backend): humanizar comentarios de routes"
```

### Task 1.6: DB layer (`connection`, `migrate`, `seed`, `reset`)

**Files:**
- Modify: `backend/src/db/connection.js`
- Modify: `backend/src/db/migrate.js`
- Modify: `backend/src/db/seed.js`
- Modify: `backend/src/db/reset.js`

- [ ] **Step 1: Reescribir `connection.js`**

Resultado:

```js
// Conexión única (singleton) a SQLite. Una sola por proceso es suficiente
// para apps de un servidor; abrir múltiples conexiones al mismo archivo
// compite por el lock.
//
// Usamos better-sqlite3 (síncrona) en vez de `sqlite3` (callbacks): código
// mucho más legible, y para esta app pedagógica el rendimiento sobra.

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

// __dirname no existe en ESM. Lo armamos a mano.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const dbAbsolutePath = path.isAbsolute(config.dbPath)
  ? config.dbPath
  : path.resolve(backendRoot, config.dbPath);

export const db = new Database(dbAbsolutePath);

// Ojo:
//  - WAL = lecturas concurrentes mientras hay una escritura activa. Útil
//    cuando varios requests caen al tiempo.
//  - foreign_keys ON: por compatibilidad legacy SQLite las ignora por
//    defecto. Sin esto, los REFERENCES no se aplican y los datos pierden
//    integridad. Activarlo SIEMPRE.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`[db] Conectado a SQLite en ${dbAbsolutePath}`);
```

- [ ] **Step 2: Reescribir `migrate.js`**

Resultado:

```js
// Crea el esquema. Idempotente: se puede correr N veces sin romper nada
// (CREATE TABLE IF NOT EXISTS). Si necesitas cambiar algo destructivo,
// mejor recomienda `npm run db:reset`.
//
// Uso: npm run db:migrate

import { db } from './connection.js';

// db.exec permite múltiples sentencias separadas por `;`.
db.exec(`
  -- usuarios
  -- email es UNIQUE; COLLATE NOCASE para que Henry@x.com == henry@x.com.
  -- password_hash guarda el hash bcrypt. NUNCA la contraseña en claro.
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    creado_en     TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- ecopuntos
  -- id es TEXT para que coincida con el shape que ya usa el front en
  -- src/data/ecopuntos.ts.
  CREATE TABLE IF NOT EXISTS ecopuntos (
    id        TEXT PRIMARY KEY,
    nombre    TEXT NOT NULL,
    direccion TEXT NOT NULL,
    horario   TEXT NOT NULL,
    lat       REAL NOT NULL,
    lng       REAL NOT NULL
  );

  -- niveles de llenado por ecopunto (1:N).
  -- ON DELETE CASCADE: si borras un ecopunto, sus niveles se van con él.
  CREATE TABLE IF NOT EXISTS ecopunto_niveles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ecopunto_id TEXT    NOT NULL REFERENCES ecopuntos(id) ON DELETE CASCADE,
    nombre      TEXT    NOT NULL,
    porcentaje  INTEGER NOT NULL CHECK (porcentaje >= 0 AND porcentaje <= 100),
    color       TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_ecopunto_niveles_ecopunto
    ON ecopunto_niveles(ecopunto_id);

  -- solicitudes de recolección de residuos voluminosos.
  -- estado: SQLite no tiene ENUM nativo, lo emulamos con CHECK.
  -- fecha: SQLite no tiene tipo DATE, así que TEXT en ISO YYYY-MM-DD.
  CREATE TABLE IF NOT EXISTS solicitudes_recoleccion (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo        TEXT    NOT NULL CHECK (tipo IN ('muebles','colchones','escombros','otros')),
    descripcion TEXT    NOT NULL,
    direccion   TEXT    NOT NULL,
    fecha       TEXT    NOT NULL,
    nombre_foto TEXT,
    estado      TEXT    NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente','agendada','completada','cancelada')),
    creado_en   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_solicitudes_usuario
    ON solicitudes_recoleccion(usuario_id);
`);

console.log('[migrate] Esquema aplicado correctamente.');
```

- [ ] **Step 3: Reescribir `seed.js`**

Resultado:

```js
// Datos iniciales — para que al clonar el repo el mapa muestre algo y
// no quede vacío frente al profe. Estos puntos salieron del front
// (src/data/ecopuntos.ts), que hacía de "backend de mentira".
//
// Idempotente: INSERT OR REPLACE pisa filas existentes. Volver a correr
// no duplica nada.

import { db } from './connection.js';

const ECOPUNTOS_SEED = [
  {
    id: '1',
    nombre: 'Ecopunto Fontibón Centro',
    direccion: 'Carrera 99 # 18-20',
    horario: 'Lunes a Viernes: 8:00 AM - 5:00 PM',
    lat: 4.6735,
    lng: -74.1450,
    niveles: [
      { nombre: 'Madera', porcentaje: 25, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 80, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 10, color: '#3b82f6' },
    ],
  },
  {
    id: '2',
    nombre: 'Ecopunto Usaquén Norte',
    direccion: 'Calle 161 # 7-40',
    horario: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
    lat: 4.7350,
    lng: -74.0320,
    niveles: [
      { nombre: 'Madera', porcentaje: 60, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 30, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 45, color: '#3b82f6' },
    ],
  },
  {
    id: '3',
    nombre: 'Ecopunto Kennedy Central',
    direccion: 'Avenida 1 de Mayo # 71-10',
    horario: 'Lunes a Sábado: 8:00 AM - 6:00 PM',
    lat: 4.6200,
    lng: -74.1350,
    niveles: [
      { nombre: 'Madera', porcentaje: 15, color: '#f97316' },
      { nombre: 'Escombros (Construcción)', porcentaje: 95, color: '#64748b' },
      { nombre: 'Muebles y Enseres', porcentaje: 20, color: '#3b82f6' },
    ],
  },
];

// Statements precompiladas — params ligados (no concat), evitando inyección.
const upsertEcopunto = db.prepare(`
  INSERT OR REPLACE INTO ecopuntos (id, nombre, direccion, horario, lat, lng)
  VALUES (@id, @nombre, @direccion, @horario, @lat, @lng)
`);

const deleteNiveles = db.prepare(`DELETE FROM ecopunto_niveles WHERE ecopunto_id = ?`);
const insertNivel = db.prepare(`
  INSERT INTO ecopunto_niveles (ecopunto_id, nombre, porcentaje, color)
  VALUES (?, ?, ?, ?)
`);

// Transacción: o entra todo o no entra nada. Si una fila falla, rollback
// de las anteriores.
const seedAll = db.transaction(() => {
  for (const eco of ECOPUNTOS_SEED) {
    upsertEcopunto.run(eco);
    // Repoblamos niveles desde cero (más simple que un upsert por nivel).
    deleteNiveles.run(eco.id);
    for (const nivel of eco.niveles) {
      insertNivel.run(eco.id, nivel.nombre, nivel.porcentaje, nivel.color);
    }
  }
});

seedAll();

console.log(`[seed] Insertados ${ECOPUNTOS_SEED.length} ecopuntos con sus niveles.`);
```

- [ ] **Step 4: Reescribir `reset.js`**

Resultado:

```js
// Borra el .db y reaplica migrate + seed. Útil cuando el esquema cambió
// o cuando los datos quedaron en un estado raro.
//
// Ojo: ESTO BORRA TODOS LOS DATOS. No usar en producción.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..', '..');
const dbAbsolutePath = path.isAbsolute(config.dbPath)
  ? config.dbPath
  : path.resolve(backendRoot, config.dbPath);

// SQLite en modo WAL crea -wal y -shm. Hay que borrarlos también o
// quedan inconsistentes con el .db recién creado.
const filesToRemove = [
  dbAbsolutePath,
  `${dbAbsolutePath}-wal`,
  `${dbAbsolutePath}-shm`,
  `${dbAbsolutePath}-journal`,
];

for (const file of filesToRemove) {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`[reset] Eliminado: ${file}`);
  }
}

// Import dinámico DESPUÉS de borrar. Si lo hiciéramos arriba, connection.js
// abriría una conexión al archivo viejo antes de que lo borráramos.
await import('./migrate.js');
await import('./seed.js');

console.log('[reset] Base reiniciada y poblada con datos iniciales.');
```

- [ ] **Step 5: Smoke + commit**

Run: `cd backend && npm run db:reset && npm run test:smoke`  
Expected: `14 ok, 0 fallidos`. Si falla algo de DB, revertir y diagnosticar.

```bash
git add backend/src/db/
git commit -m "style(backend): humanizar comentarios de la capa DB"
```

### Task 1.7: Smoke test y `.env.example`

**Files:**
- Modify: `backend/scripts/smoke.js`
- Modify: `backend/.env.example`

- [ ] **Step 1: Reescribir el header de `smoke.js`**

Edit `backend/scripts/smoke.js`. **Solo se reescribe el bloque de comentario inicial** (líneas 1-14, el header de cajón ASCII). El resto del archivo (asserts, helper `test`, `api`, los bloques de prueba) queda intacto: solo cambiar comentarios mínimos sin tocar la lógica.

Reemplazar las líneas 1-14 por:

```js
// Smoke test end-to-end. No es exhaustivo (eso lo cubrirían tests
// unitarios con Vitest si llegamos a meterlos), pero detecta en segundos
// si rompimos el contrato JSON, una ruta o el middleware de auth.
//
// Uso: `npm run test:smoke` (con el server arriba en otra terminal).
// Requiere Node >= 18 por el fetch nativo.
```

(Si Phase 2.1 y 2.2 añadieron bloques nuevos con comentarios largos, también revisar que esos comentarios estén en el estilo nuevo — pero esos ya se escriben así desde el principio en Phase 2.)

- [ ] **Step 2: Reescribir `.env.example`**

Edit `backend/.env.example`. Resultado:

```
# Plantilla del .env del backend. Cópiala a `.env` y rellena los valores.
# `.env` está en .gitignore — no subir secretos al repo.

# Puerto del backend. 5173 es del Vite, por eso usamos 4000.
PORT=4000

# Origen permitido por CORS. En dev es el dev-server de Vite.
CORS_ORIGIN=http://localhost:5173

# Ruta del SQLite (relativa a la carpeta backend/).
DB_PATH=./ecopuntos.db

# Secreto para firmar los JWT. OBLIGATORIO. En producción usá >= 32 bytes
# aleatorios. Si lo dejas con el placeholder de abajo, el server REHÚSA
# arrancar (lo cambiamos en Phase 2.1).
JWT_SECRET=cambia-esto-en-produccion

# Tiempo de vida del token. Ej: "15m", "2h", "7d".
JWT_EXPIRES_IN=2h
```

> Nota: Phase 2.1 reemplaza esa línea de `JWT_SECRET` y endurece el `config.js`. El comentario humanizado de arriba ya prepara el terreno.

- [ ] **Step 3: Smoke + commit**

```bash
npm run test:smoke
```

Expected: `14 ok, 0 fallidos`.

```bash
git add backend/scripts/smoke.js backend/.env.example
git commit -m "style(backend): humanizar comentarios de smoke.js y .env.example"
```

### Task 1.8: Verificación final de Phase 1

- [ ] **Step 1: Confirmar que nada del código ejecutable cambió**

```bash
cd backend
npm run db:reset
npm run dev    # background
npm run test:smoke
```

Expected: `14 ok, 0 fallidos` exacto.

- [ ] **Step 2: Confirmar que el conteo de archivos tocados es 22**

```bash
git log --since='Phase 1 start' --name-only --oneline backend/ | grep -v '^$\|^[0-9a-f]' | sort -u | wc -l
```

(Comando aproximado; alternativa más simple: revisar `git log` de los commits `style(backend): humanizar ...` y contar.)

Expected: ~22 archivos modificados a lo largo de Phase 1.

- [ ] **Step 3: Sanity check del tono**

Abrir un archivo aleatorio (ej. `git show HEAD:backend/src/middleware/errorHandler.js`) y leerlo. Si suena como "estudiante que terminó la entrega a las 3am", la fase está bien. Si suena a manual didáctico, falta una pasada.

---

## Phase 2 — Hardening del backend

Tres tareas: `JWT_SECRET` fail-fast real, validación semántica de fechas, y tests que cubran ambas.

### Task 2.1: Fail-fast real del `JWT_SECRET`

**Files:**
- Modify: `backend/src/config.js:17-25` (función `required`) y `backend/src/config.js:31` (uso de `JWT_SECRET`)
- Modify: `backend/.env.example` (comentario)
- Modify (local, no se commitea): `backend/.env`

- [ ] **Step 1: Escribir el test que verifica el rechazo del placeholder**

Edit `backend/scripts/smoke.js`. El smoke corre contra un servidor ya arrancado, así que no es el lugar para validar el arranque. En vez de eso, añadir un test independiente que importe `config.js` con `JWT_SECRET` placeholder y espere que lance. Como `config.js` se evalúa al importarse, lo más simple es invocarlo como subproceso.

Añadir AL FINAL de `backend/scripts/smoke.js`, antes del bloque `// ── Resumen ──`:

```js
// ── Arranque del servidor: rechazo de JWT_SECRET placeholder ──────────────
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
console.log('\nConfiguración (subprocesos)');
await test('config.js rechaza JWT_SECRET placeholder', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.resolve(here, '..', 'src', 'config.js');
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', `import('${configPath.replace(/\\/g, '/')}').then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(2)})`], {
    env: { ...process.env, JWT_SECRET: 'cambia-esto-en-produccion' },
    encoding: 'utf8',
  });
  assert.notEqual(res.status, 0, 'el proceso debería fallar con el placeholder');
  assert.match(res.stderr, /JWT_SECRET/, 'mensaje debe nombrar JWT_SECRET');
});

await test('config.js rechaza JWT_SECRET vacío', () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.resolve(here, '..', 'src', 'config.js');
  const res = spawnSync(process.execPath, ['--input-type=module', '-e', `import('${configPath.replace(/\\/g, '/')}').then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(2)})`], {
    env: { ...process.env, JWT_SECRET: '' },
    encoding: 'utf8',
  });
  assert.notEqual(res.status, 0, 'el proceso debería fallar con secreto vacío');
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Arrancar el server (`cd backend && npm run dev`) en otra terminal. Después:

Run: `cd backend && npm run test:smoke`  
Expected: los dos tests nuevos FALLAN porque hoy `config.js` acepta el placeholder y acepta el vacío (en el caso del placeholder; el vacío sí debería rechazarse por el `value === ''` actual — verificar). Anotar exactamente qué falla.

- [ ] **Step 3: Implementar el cambio en `config.js`**

Edit `backend/src/config.js`. Reemplazar la función `required` y el uso de `JWT_SECRET` por:

```js
function required(name) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `[config] Falta la variable de entorno ${name}. Revisa tu .env (usa .env.example como plantilla).`
    );
  }
  return value;
}

// Lista de valores placeholder conocidos que NO deben aceptarse como secreto
// real. Si .env aún tiene uno de estos, el servidor falla al arrancar para
// forzar a generar un secreto propio.
const JWT_SECRET_PLACEHOLDERS = new Set([
  'cambia-esto-en-produccion',
  'changeme',
  'secret',
]);

function jwtSecret() {
  const value = required('JWT_SECRET');
  if (JWT_SECRET_PLACEHOLDERS.has(value)) {
    throw new Error(
      `[config] JWT_SECRET tiene un valor placeholder (${value}). ` +
        `Genera uno aleatorio: en Node REPL ejecuta ` +
        `crypto.randomBytes(48).toString('hex')`
    );
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH ?? './ecopuntos.db',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',

  // Útil para condicionar comportamiento (ej. logs detallados solo en dev).
  isProd: process.env.NODE_ENV === 'production',
};
```

- [ ] **Step 4: Actualizar `backend/.env.example`**

Edit `backend/.env.example` líneas ~24-27. Reemplazar el bloque del `JWT_SECRET` por:

```
# Secreto para firmar los JWT. OBLIGATORIO y no puede ser un placeholder.
# Genera uno real con (en una terminal con Node):
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# El servidor REHÚSA arrancar si esta variable falta o tiene un placeholder
# conocido como "cambia-esto-en-produccion".
JWT_SECRET=
```

- [ ] **Step 5: Actualizar el `.env` local del backend**

Edit `backend/.env` (no se commitea, sigue en .gitignore). Reemplazar la línea `JWT_SECRET=cambia-esto-en-produccion` por un secreto aleatorio real. Generarlo:

Run: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`  
Copiar la salida (96 hex chars) y pegarla:

```
JWT_SECRET=<los 96 chars generados>
```

- [ ] **Step 6: Reiniciar el servidor y correr smoke**

Detener el servidor anterior (Ctrl+C). Arrancarlo de nuevo: `cd backend && npm run dev`. Verificar que ARRANCA (con el nuevo secreto) y muestra el log normal. En otra terminal:

Run: `cd backend && npm run test:smoke`  
Expected: ahora pasa `16 ok, 0 fallidos` (los 14 originales + 2 nuevos). Los subprocess de los tests usan el placeholder y deberían ser rechazados → tests pasan.

- [ ] **Step 7: Commit**

```bash
git add backend/src/config.js backend/.env.example backend/scripts/smoke.js
git commit -m "fix(backend): JWT_SECRET fail-fast real (rechaza placeholders y vacio)"
```

(No se commitea `backend/.env` — está en .gitignore.)

### Task 2.2: Validación semántica de `date` en solicitudes

**Files:**
- Modify: `backend/src/controllers/solicitudesController.js:22-37`
- Modify: `backend/scripts/smoke.js`

- [ ] **Step 1: Añadir tests para fechas inválidas y pasadas**

Edit `backend/scripts/smoke.js`. En la sección `// ── Solicitudes ──`, después del bloque `'POST /api/solicitudes inválida → 422'`, añadir:

```js
await test('POST /api/solicitudes con fecha calendárica inválida → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2026-13-99',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.date, 'details debe incluir date');
});

await test('POST /api/solicitudes con fecha pasada → 422', async () => {
  const { status, body } = await api('/api/solicitudes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      type: 'muebles',
      description: 'Sofá viejo',
      address: 'Calle 26 # 50-00',
      date: '2000-01-01',
    }),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
  assert.ok(body.error.details.date);
});
```

- [ ] **Step 2: Correr smoke y verificar que los nuevos fallan**

Run: `cd backend && npm run test:smoke`  
Expected: los dos nuevos FALLAN (el endpoint hoy acepta `2026-13-99` y fechas pasadas; el regex solo mira la forma).

- [ ] **Step 3: Implementar validación semántica**

Edit `backend/src/controllers/solicitudesController.js`. Reemplazar el bloque que va de la línea 22 a la 41 (constantes + `validarCrear`) por:

```js
const TIPOS_VALIDOS = new Set(['muebles', 'colchones', 'escombros', 'otros']);
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/; // ISO date YYYY-MM-DD

// Devuelve `true` si `str` es una fecha calendárica válida (no solo bien
// formateada). Para eso parseamos a Date y exigimos que `toISOString()`
// devuelva exactamente la misma fecha — descarta `2026-13-99`, `2026-02-30`,
// etc., que `new Date()` "normaliza" silenciosamente.
function esFechaCalendaricaValida(str) {
  if (!FECHA_REGEX.test(str)) return false;
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === str;
}

// Devuelve `true` si la fecha (en UTC) es hoy o futura. Comparamos contra
// el día actual UTC para evitar confusiones de zona horaria. Una solicitud
// para "hoy mismo" sigue siendo válida.
function esFechaHoyOFutura(str) {
  const hoyUtc = new Date().toISOString().slice(0, 10);
  return str >= hoyUtc; // comparación lexicográfica de YYYY-MM-DD funciona.
}

function validarCrear(body) {
  const errores = {};
  if (!TIPOS_VALIDOS.has(body?.type)) {
    errores.type = `Debe ser uno de: ${[...TIPOS_VALIDOS].join(', ')}.`;
  }
  if (typeof body?.description !== 'string' || body.description.trim().length < 5) {
    errores.description = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.address !== 'string' || body.address.trim().length < 5) {
    errores.address = 'Debe tener al menos 5 caracteres.';
  }
  if (typeof body?.date !== 'string' || !esFechaCalendaricaValida(body.date)) {
    errores.date = 'Debe ser una fecha real en formato YYYY-MM-DD.';
  } else if (!esFechaHoyOFutura(body.date)) {
    errores.date = 'La fecha no puede ser pasada.';
  }
  if (Object.keys(errores).length > 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Datos inválidos.', errores);
  }
}
```

- [ ] **Step 4: Correr smoke y verificar que todo pasa**

Run: `cd backend && npm run test:smoke`  
Expected: `18 ok, 0 fallidos` (16 anteriores + 2 nuevos). Si el test `'POST /api/solicitudes válida → 201'` falla porque la fecha hardcoded `'2026-05-15'` resulta ser pasada cuando se corra esto, ese test ya quedó obsoleto — actualizar a `'2030-05-15'` en el mismo paso:

Edit `backend/scripts/smoke.js`, en el bloque `POST /api/solicitudes válida → 201`, cambiar `date: '2026-05-15'` por `date: '2030-05-15'` (fecha cómodamente futura).

Volver a correr `npm run test:smoke`. Expected: `18 ok, 0 fallidos`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/solicitudesController.js backend/scripts/smoke.js
git commit -m "fix(backend): validar fecha real y no-pasada en POST /api/solicitudes"
```

---

## Phase 3 — Integración frontend ↔ backend

⚠️ **Esta fase es la más invasiva sobre código de "el otro estudiante" (LoginView, App.tsx, MapView, MapContext, VoluminousWasteModal).** CLAUDE.md autoriza explícitamente refactorizar los handlers de login/register cuando el backend esté listo; los demás cambios son consecuencias mecánicas de esa integración. Si el usuario quiere mantener el frontend intacto, **saltar a Phase 4** y archivar esta fase.

### Task 3.1: Tipos de Vite y variable `VITE_API_URL`

**Files:**
- Create: `src/vite-env.d.ts`
- Modify (local, no se commitea): `.env` (raíz)

- [ ] **Step 1: Crear `src/vite-env.d.ts`**

Write `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_WEBHOOK_URL?: string; // legado: se elimina en Task 2.7
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Añadir `VITE_API_URL` al `.env` de la raíz (NO se commitea)**

Edit `.env` (raíz, ya en .gitignore). Añadir al final:

```
VITE_API_URL=http://localhost:4000
```

- [ ] **Step 3: Verificar que TS sigue compilando**

Run: `pnpm build`  
Expected: build limpio (el archivo `vite-env.d.ts` solo declara tipos).

- [ ] **Step 4: Commit (solo el archivo de tipos)**

```bash
git add src/vite-env.d.ts
git commit -m "feat(frontend): tipos de import.meta.env (VITE_API_URL, etc.)"
```

### Task 3.2: Cliente API único `src/lib/api.ts`

**Files:**
- Create: `src/lib/api.ts`

- [ ] **Step 1: Crear `src/lib/api.ts`**

Write `src/lib/api.ts`:

```ts
// ─────────────────────────────────────────────────────────────────────────
//  src/lib/api.ts
//  ──────────────
//  Cliente fetch único para hablar con el backend. Centraliza:
//    1. La URL base (configurable vía VITE_API_URL).
//    2. El token JWT (lo lee de localStorage.eco_token).
//    3. El contrato JSON { ok, data, error } — si ok=false lanza ApiError.
//
//  Que esto viva en UN solo archivo evita repetir headers/parseo en cada
//  componente y permite cambiar comportamiento (ej. logout automático en
//  401) en un lugar.
// ─────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'eco_token';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

interface ApiSuccess<T> {
  ok: true;
  data: T;
}
interface ApiFailure {
  ok: false;
  error: { code: string; message: string; details?: unknown };
}
type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  let body: ApiEnvelope<T>;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'La respuesta del servidor no es JSON.');
  }
  if (!body.ok) {
    throw new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  }
  return body.data;
}
```

- [ ] **Step 2: Build TS para verificar compilación**

Run: `pnpm build`  
Expected: build limpio.

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "feat(frontend): cliente API unico con manejo de token y errores"
```

### Task 3.3: `LoginView` envía email y password

**Files:**
- Modify: `src/components/LoginView.tsx`

- [ ] **Step 1: Cambiar la interfaz y capturar inputs**

Edit `src/components/LoginView.tsx`. Reemplazar el contenido completo por:

```tsx
import React, { useState } from 'react';
import { Mail, Lock, ChevronRight, Recycle } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void> | void;
  onRegisterClick: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onRegisterClick }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden w-full max-w-md border border-green-100">
        {/* Header Section */}
        <div className="bg-green-600 p-10 flex flex-col items-center text-white text-center">
          <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl">
            <Recycle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-1">EcoPuntos Bogotá</h1>
          <p className="text-green-50 opacity-90 text-sm">Gestión inteligente de residuos voluminosos</p>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <div className="space-y-6">
            <TextField
              label="Correo Electrónico"
              type="email"
              placeholder="ciudadano@bogota.gov.co"
              icon={<Mail className="w-5 h-5" />}
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
            />

            <TextField
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              fullWidth
              variant="secondary"
              isLoading={isLoading}
              rightIcon={<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              className="group py-5"
            >
              Ingresar a la Plataforma
            </Button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onRegisterClick}
              className="text-sm text-green-600 font-semibold hover:underline"
            >
              ¿No tienes cuenta? Regístrate aquí
            </button>
          </div>

          {/* Footer Info */}
          <div className="mt-8 flex items-start gap-2 text-[10px] text-gray-400 leading-relaxed italic">

            <div className="bg-green-50 p-1 rounded-full text-green-500 mt-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.9L9.03 9.069a2.25 2.25 0 002.44 0L18.334 4.9A.75.75 0 0017.5 3.5H3a.75.75 0 00-.834 1.4z" />
                <path d="M18.334 6.132l-6.865 4.147a3.75 3.75 0 01-4.069 0L.5 6.132V13.5A2.25 2.25 0 002.75 15.75h14.5a2.25 2.25 0 002.25-2.25V6.132z" />
              </svg>
            </div>
            <p>
              Conforme a la Ley 1581 de 2012, no almacenamos datos personales sensibles. Tu privacidad está garantizada.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginView;
```

- [ ] **Step 2: Build TS**

Run: `pnpm build`  
Expected: el build falla porque `App.tsx` aún pasa un `onLogin: () => void` que no toma argumentos — el tipo cambió a `(email: string, password: string) => Promise<void> | void`. Esperado; se arregla en Task 2.5.

NO commitear todavía: el build queda roto entre Task 2.3 y 2.5.

### Task 3.4: `RegisterView` envía nombre, email y password

**Files:**
- Modify: `src/components/RegisterView.tsx`

- [ ] **Step 1: Capturar inputs y propagar al handler**

Edit `src/components/RegisterView.tsx`. Reemplazar el contenido completo por:

```tsx
import React, { useState } from 'react';
import { Mail, Lock, User, ChevronRight, Recycle, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';

interface RegisterViewProps {
  onRegister: (nombre: string, email: string, password: string) => Promise<void> | void;
  onBackToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onBackToLogin }) => {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onRegister(nombre, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear la cuenta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden w-full max-w-md border border-green-100">
        <div className="bg-green-600 p-10 flex flex-col items-center text-white text-center">
          <div className="bg-white p-4 rounded-3xl mb-4 shadow-xl">
            <Recycle className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-1">Crear cuenta</h1>
          <p className="text-green-50 opacity-90 text-sm">Únete a EcoPuntos Bogotá</p>
        </div>

        <div className="p-8">
          <div className="space-y-6">
            <TextField
              label="Nombre completo"
              type="text"
              placeholder="Tu nombre"
              icon={<User className="w-5 h-5" />}
              value={nombre}
              onChange={(e) => setNombre((e.target as HTMLInputElement).value)}
            />

            <TextField
              label="Correo Electrónico"
              type="email"
              placeholder="ciudadano@bogota.gov.co"
              icon={<Mail className="w-5 h-5" />}
              value={email}
              onChange={(e) => setEmail((e.target as HTMLInputElement).value)}
            />

            <TextField
              label="Contraseña"
              type="password"
              placeholder="••••••••"
              icon={<Lock className="w-5 h-5" />}
              value={password}
              onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              fullWidth
              variant="secondary"
              isLoading={isLoading}
              rightIcon={<ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
              className="group py-5"
            >
              Crear cuenta
            </Button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onBackToLogin}
              className="inline-flex items-center gap-1 text-sm text-green-600 font-semibold hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterView;
```

- [ ] **Step 2: No buildear todavía**

El tipo `onRegister` también cambió. App.tsx se arregla en Task 3.5. NO commit aún.

### Task 3.5: `App.tsx` llama al backend

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Cambiar handlers para llamar al backend**

Edit `src/App.tsx`. Reemplazar el contenido completo por:

```tsx
import { useState, useEffect } from 'react';
import LoginView from './components/LoginView';
import MapView from './components/MapView';
import RegisterView from './components/RegisterView';
import { api, setToken, clearToken } from './lib/api';

type ViewState = 'login' | 'register' | 'map';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface AuthResponse {
  token: string;
  usuario: Usuario;
}

function App() {
  const [currentView, setCurrentView] = useState<ViewState>(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash === 'register') return 'register';
    if (hash === 'map') return 'map';
    return 'login';
  });

  const [user, setUser] = useState<Usuario | null>(() => {
    const savedUser = localStorage.getItem('eco_user');
    return savedUser ? (JSON.parse(savedUser) as Usuario) : null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#/', '');
      if (hash === 'register') setCurrentView('register');
      else if (hash === 'map') setCurrentView('map');
      else setCurrentView('login');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (view: ViewState) => {
    window.location.hash = `#/${view}`;
  };

  const handleLogin = async (email: string, password: string) => {
    const { token, usuario } = await api<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(token);
    localStorage.setItem('eco_user', JSON.stringify(usuario));
    setUser(usuario);
    navigate('map');
  };

  const handleRegister = async (nombre: string, email: string, password: string) => {
    const { token, usuario } = await api<AuthResponse>('/api/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ nombre, email, password }),
    });
    setToken(token);
    localStorage.setItem('eco_user', JSON.stringify(usuario));
    setUser(usuario);
    navigate('map');
  };

  const handleLogout = () => {
    setUser(null);
    clearToken();
    localStorage.removeItem('eco_user');
    navigate('login');
  };

  // Compat con la prop existente de MapView (espera { name, email })
  const userForMap = user ? { name: user.nombre, email: user.email } : null;

  return (
    <div className="w-full h-screen font-sans antialiased">
      {currentView === 'login' && (
        <LoginView
          onLogin={handleLogin}
          onRegisterClick={() => navigate('register')}
        />
      )}

      {currentView === 'register' && (
        <RegisterView
          onRegister={handleRegister}
          onBackToLogin={() => navigate('login')}
        />
      )}

      {currentView === 'map' && (
        <MapView onLogout={handleLogout} user={userForMap} />
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Build TS**

Run: `pnpm build`  
Expected: build limpio. `MapView`'s prop `user?: { name; email } | null` se llena con `userForMap`. Si hay error TS, ajustar.

- [ ] **Step 3: Commit conjunto del login/registro/handlers**

```bash
git add src/components/LoginView.tsx src/components/RegisterView.tsx src/App.tsx
git commit -m "feat(frontend): login y registro contra /api/auth/* con manejo de errores"
```

### Task 3.6: `MapContext` hace fetch de `/api/ecopuntos`

**Files:**
- Modify: `src/data/ecopuntos.ts`
- Modify: `src/components/MapContext.tsx`

- [ ] **Step 1: Quitar la data hardcoded del archivo `ecopuntos.ts`**

Edit `src/data/ecopuntos.ts`. Reemplazar el contenido completo por:

```ts
// Tipos compartidos del dominio "ecopunto". El catálogo real lo sirve el
// backend en GET /api/ecopuntos; este archivo solo conserva las interfaces
// que consumen los componentes del mapa.
export interface WasteLevel {
  name: string;
  percentage: number;
  color: string;
}

export interface EcoPunto {
  id: string;
  name: string;
  address: string;
  hours: string;
  lat: number;
  lng: number;
  wasteLevels: WasteLevel[];
}
```

- [ ] **Step 2: Hacer que `MapContext` fetchee y exponga `ecopuntos`**

Edit `src/components/MapContext.tsx`. Reemplazar el contenido completo por:

```tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { EcoPunto } from '../data/ecopuntos';
import { api } from '../lib/api';

interface MapState {
  selectedPunto: EcoPunto | null;
  showRoute: boolean;
  routeData: any;
  isVoluminousModalOpen: boolean;
  ecopuntos: EcoPunto[];
  isLoadingEcopuntos: boolean;
  errorEcopuntos: string | null;
}

interface MapActions {
  selectPunto: (punto: EcoPunto | null) => void;
  traceRoute: () => void;
  setVoluminousModalOpen: (open: boolean) => void;
  clearRoute: () => void;
}

interface MapContextValue {
  state: MapState;
  actions: MapActions;
}

const MapContext = createContext<MapContextValue | null>(null);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) throw new Error('useMapContext must be used within a MapProvider');
  return context;
};

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const USER_LOCATION = { latitude: 4.6582, longitude: -74.0939 };

export const MapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedPunto, setSelectedPunto] = useState<EcoPunto | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [isVoluminousModalOpen, setIsVoluminousModalOpen] = useState(false);
  const [ecopuntos, setEcopuntos] = useState<EcoPunto[]>([]);
  const [isLoadingEcopuntos, setIsLoadingEcopuntos] = useState(true);
  const [errorEcopuntos, setErrorEcopuntos] = useState<string | null>(null);

  // Carga del catálogo de ecopuntos desde el backend al montar.
  useEffect(() => {
    let cancelado = false;
    setIsLoadingEcopuntos(true);
    setErrorEcopuntos(null);
    api<EcoPunto[]>('/api/ecopuntos')
      .then((data) => {
        if (!cancelado) setEcopuntos(data);
      })
      .catch((err: Error) => {
        if (!cancelado) setErrorEcopuntos(err.message);
      })
      .finally(() => {
        if (!cancelado) setIsLoadingEcopuntos(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const selectPunto = (punto: EcoPunto | null) => {
    setSelectedPunto(punto);
    if (punto && punto.id !== selectedPunto?.id) {
      setShowRoute(false);
      setRouteData(null);
    }
  };

  const traceRoute = () => setShowRoute(true);
  const clearRoute = () => {
    setShowRoute(false);
    setRouteData(null);
  };

  useEffect(() => {
    if (showRoute && selectedPunto) {
      const getRoute = async () => {
        try {
          const query = await fetch(
            `https://api.mapbox.com/directions/v5/mapbox/driving/${USER_LOCATION.longitude},${USER_LOCATION.latitude};${selectedPunto.lng},${selectedPunto.lat}?steps=true&geometries=geojson&access_token=${MAPBOX_TOKEN}`
          );
          const json = await query.json();
          if (json.routes?.[0]) {
            setRouteData({
              type: 'Feature',
              properties: {},
              geometry: json.routes[0].geometry,
            });
          }
        } catch (error) {
          console.error('Error fetching route:', error);
        }
      };
      getRoute();
    }
  }, [showRoute, selectedPunto]);

  const value = {
    state: {
      selectedPunto,
      showRoute,
      routeData,
      isVoluminousModalOpen,
      ecopuntos,
      isLoadingEcopuntos,
      errorEcopuntos,
    },
    actions: {
      selectPunto,
      traceRoute,
      setVoluminousModalOpen: setIsVoluminousModalOpen,
      clearRoute,
    },
  };

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};
```

- [ ] **Step 3: `MapView` lee los ecopuntos del contexto**

Edit `src/components/MapView.tsx`. Dos cambios mínimos:

1. Eliminar la línea `import { ECO_PUNTOS } from '../data/ecopuntos';` (línea 4).
2. Reemplazar la función `EcoPuntoMarkers` (líneas 32-57) por:

```tsx
const EcoPuntoMarkers = () => {
  const {
    state: { ecopuntos },
    actions: { selectPunto },
  } = useMapContext();
  return (
    <>
      {ecopuntos.map((punto) => (
        <Marker
          key={punto.id}
          longitude={punto.lng}
          latitude={punto.lat}
          anchor="bottom"
          onClick={e => {
            e.originalEvent.stopPropagation();
            selectPunto(punto);
          }}
        >
          <div className="group cursor-pointer transform transition-transform hover:scale-110 active:scale-95">
            <div className="w-10 h-10 bg-green-500 rounded-full border-4 border-white flex items-center justify-center shadow-lg">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-green-500 rotate-45 border-r-2 border-b-2 border-white"></div>
          </div>
        </Marker>
      ))}
    </>
  );
};
```

3. Añadir un banner discreto al final del JSX (justo antes del cierre del `<div className="relative w-full h-screen ...">`), después del banner de `!MAPBOX_TOKEN`:

```tsx
{/* Banner de error de catálogo (no bloquea el mapa, solo informa). */}
<MapDataStatusBanner />
```

Y al final del archivo, antes de `export default MapView;`, añadir:

```tsx
const MapDataStatusBanner = () => {
  const { state: { isLoadingEcopuntos, errorEcopuntos, ecopuntos } } = useMapContext();
  if (errorEcopuntos) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
        No se pudo cargar el catálogo: {errorEcopuntos}
      </div>
    );
  }
  if (!isLoadingEcopuntos && ecopuntos.length === 0) {
    return (
      <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg">
        El backend no devolvió ecopuntos.
      </div>
    );
  }
  return null;
};
```

- [ ] **Step 4: Build TS**

Run: `pnpm build`  
Expected: limpio. Errores típicos: import faltante, paréntesis. Corregir y volver.

- [ ] **Step 5: Commit**

```bash
git add src/data/ecopuntos.ts src/components/MapContext.tsx src/components/MapView.tsx
git commit -m "feat(frontend): cargar catalogo de ecopuntos desde /api/ecopuntos"
```

### Task 3.7: `VoluminousWasteModal` POST a `/api/solicitudes`

**Files:**
- Modify: `src/components/VoluminousWasteModal.tsx`
- Modify: `src/vite-env.d.ts` (eliminar `VITE_WEBHOOK_URL`)

- [ ] **Step 1: Reemplazar el webhook por la llamada al backend**

Edit `src/components/VoluminousWasteModal.tsx`. Localizar la función `handleConfirm` (líneas ~31-54) y reemplazar el cuerpo:

```tsx
  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);
    try {
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
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar la solicitud.');
    } finally {
      setIsLoading(false);
    }
  };
```

Añadir el import al inicio del archivo:

```tsx
import { api } from '../lib/api';
```

Añadir `error` al estado junto a `isLoading` (en la sección de hooks ~líneas 28-29):

```tsx
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
```

En el paso 3 del modal (donde está el botón "Confirmar Solicitud"), insertar el banner de error justo antes del bloque `<div className="flex gap-4 pt-4">`:

```tsx
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">
                      {error}
                    </p>
                  )}
```

- [ ] **Step 2: Quitar el tipo legado de `vite-env.d.ts`**

Edit `src/vite-env.d.ts`. Eliminar la línea `readonly VITE_WEBHOOK_URL?: string;`. El interface queda:

```ts
interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_API_URL?: string;
}
```

- [ ] **Step 3: Build TS**

Run: `pnpm build`  
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
git add src/components/VoluminousWasteModal.tsx src/vite-env.d.ts
git commit -m "feat(frontend): solicitudes de recoleccion via /api/solicitudes"
```

### Task 3.8: Verificación manual end-to-end

**Files:** ninguno.

- [ ] **Step 1: Reset base + arrancar backend**

```bash
cd backend
npm run db:reset
npm run dev
```

Verificar que el log dice `[ecopuntos-backend] Escuchando en http://localhost:4000`.

- [ ] **Step 2: Arrancar frontend en otra terminal**

```bash
pnpm dev
```

Abrir `http://localhost:5173`.

- [ ] **Step 3: Flujo de registro**

1. Hacer clic en "¿No tienes cuenta? Regístrate aquí".
2. Llenar nombre = `Test User`, email = `test@ecopuntos.local`, password = `secreta123`.
3. Pulsar "Crear cuenta".
4. Expected: aparece el mapa con marcadores de los 3 ecopuntos del seed.
5. En DevTools (F12), `Application > Local Storage > http://localhost:5173`: deben existir `eco_token` y `eco_user`.

- [ ] **Step 4: Flujo de error en registro (email duplicado)**

1. Logout.
2. Repetir el registro con el mismo email.
3. Expected: banner rojo "Ya existe una cuenta con ese email."

- [ ] **Step 5: Flujo de login**

1. Volver a Login. Usar email = `test@ecopuntos.local`, password = `secreta123`.
2. Expected: vuelve al mapa.
3. Probar también con password incorrecto. Expected: banner rojo "Email o contraseña incorrectos."

- [ ] **Step 6: Catálogo de ecopuntos**

1. En el mapa, verificar que se ven 3 marcadores verdes (Fontibón, Usaquén, Kennedy).
2. Si el catálogo no carga: revisar la consola — debería verse un fetch a `GET http://localhost:4000/api/ecopuntos` exitoso.

- [ ] **Step 7: Solicitud de recolección**

1. Clic en el botón flotante "Residuos Voluminosos".
2. Paso 1: elegir "Muebles".
3. Paso 2: descripción = `Un sofá viejo y dos sillas`. Pulsar "Continuar".
4. Paso 3: fecha = (al menos hoy en formato YYYY-MM-DD). Pulsar "Confirmar Solicitud".
5. Expected: pantalla "¡Todo listo!".
6. Verificar en el backend con curl:

```bash
TOKEN=$(node -e "process.stdout.write(localStorage.eco_token)" 2>/dev/null || echo "obtener del DevTools")
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/solicitudes/mias
```

Como `localStorage` no está disponible fuera del navegador, alternativa: en DevTools `Application > Local Storage`, copiar el valor de `eco_token` y usarlo en el curl manualmente. Expected: respuesta `{"ok":true,"data":{"solicitudes":[{...}]}}` con al menos una solicitud `"type":"muebles"`.

- [ ] **Step 8: Solicitud inválida (fecha pasada)**

1. Abrir el modal de nuevo.
2. Paso 1: tipo "Otros". Paso 2: descripción cualquiera. Paso 3: fecha = `2000-01-01`.
3. Expected: banner rojo "La fecha no puede ser pasada."

- [ ] **Step 9: Logout limpia el token**

1. Pulsar el botón de salida (LogOut) en el header del mapa.
2. Vuelve a Login.
3. Verificar en DevTools que `eco_token` y `eco_user` ya NO existen en localStorage.

- [ ] **Step 10: Recargar la página estando logueado**

1. Hacer login de nuevo.
2. Recargar (F5).
3. Expected: como `eco_user` y el hash `#/map` están persistidos, se ve el mapa directamente. Los marcadores se vuelven a cargar (visible un breve flicker; sin error).

- [ ] **Step 11: Detener ambos servidores**

Ctrl+C en cada terminal.

> Si CUALQUIER paso falla: aplicar `superpowers:systematic-debugging` antes de modificar nada (formular hipótesis, mirar logs, leer código). NO declarar Phase 3 completa con pasos en rojo.

---

## Phase 4 — README del proyecto en la raíz

El `README.md` raíz es el template default de Vite. Reemplazarlo por uno específico del proyecto.

### Task 4.1: README del proyecto

**Files:**
- Modify: `README.md` (raíz)

- [ ] **Step 1: Reemplazar contenido**

Edit `README.md`. Reemplazar TODO el contenido por:

```markdown
# Ecopuntos Bogotá

App académica para visualizar puntos de acopio de residuos voluminosos en Bogotá y agendar recolecciones. Repo compartido entre dos estudiantes.

## Subproyectos

- **Frontend** (raíz): React 19 + Vite 8 + TypeScript + Tailwind 3 + Mapbox. Gestor `pnpm`. Puerto `5173`.
- **Backend** (`backend/`): Node 18+ + Express 4 + SQLite (better-sqlite3) + JWT. Gestor `npm`. Puerto `4000`. Ver `backend/README.md` para detalle de endpoints, contrato JSON y arquitectura.

## Setup rápido

```bash
# Frontend
pnpm install
cp .env.example .env   # editar VITE_MAPBOX_TOKEN y VITE_API_URL
pnpm dev               # http://localhost:5173

# Backend (otra terminal)
cd backend
npm install
cp .env.example .env   # editar JWT_SECRET (no aceptar placeholder)
npm run db:reset       # crea SQLite con seed
npm run dev            # http://localhost:4000
```

## Variables de entorno

**Raíz (`.env`):**

| Variable | Default | Descripción |
|---|---|---|
| `VITE_MAPBOX_TOKEN` | — | Token público de Mapbox (de https://account.mapbox.com/access-tokens/). Sin él, el mapa no carga. |
| `VITE_API_URL` | `http://localhost:4000` | URL base del backend. |

**Backend (`backend/.env`):**

Ver `backend/.env.example`. La clave crítica es `JWT_SECRET`: tiene que ser un secreto real, el servidor rehúsa arrancar con placeholders.

## Convenciones del repo

- Rama `master` recibe merges desde `dev`. El trabajo va en ramas temáticas `feat/<modulo>` integradas vía PR contra `dev`.
- Comentarios del backend en español (tono didáctico — repo académico).
- Contrato JSON unificado del backend: `{ ok, data?, error? }`. Detalle en `backend/README.md`.
- Auth con JWT: el token va en `localStorage.eco_token` y se manda como `Authorization: Bearer <token>`.

## Smoke test del backend

```bash
cd backend
npm run dev               # en una terminal
npm run test:smoke        # en otra
```

Esperado: `18 ok, 0 fallidos`.

## Documentación adicional

- `CLAUDE.md` — guía para asistentes IA (también útil para humanos): arquitectura, decisiones no obvias.
- `backend/README.md` — endpoints, contrato JSON, decisiones técnicas del backend.
- `docs/superpowers/plans/` — planes de implementación versionados.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README del proyecto Ecopuntos (reemplaza template Vite)"
```

---

## Phase 5 — Verificación final

Re-correr todas las pruebas y comprobar que el repo queda en estado verde, antes de declarar el trabajo terminado.

### Task 5.1: Smoke + build + lint

**Files:** ninguno.

- [ ] **Step 1: Backend smoke**

```bash
cd backend
npm run db:reset
npm run dev    # background
# en otra terminal
npm run test:smoke
```

Expected: `18 ok, 0 fallidos`.

- [ ] **Step 2: Frontend build**

```bash
pnpm build
```

Expected: limpio (`tsc -b && vite build` sin errores).

- [ ] **Step 3: Frontend lint**

```bash
pnpm lint
```

Expected: mismos warnings que en Phase 0 (no debe haber NUEVOS errores). Si hay nuevos, ajustar.

- [ ] **Step 4: Estado de git**

```bash
git status
git log --oneline origin/dev..HEAD
```

Expected: working tree clean. Lista de commits incluye al menos:
- `style(backend): humanizar comentarios del nucleo (app, server, config)`
- `style(backend): humanizar comentarios de middleware y utils`
- `style(backend): humanizar comentarios de models`
- `style(backend): humanizar comentarios de controllers`
- `style(backend): humanizar comentarios de routes`
- `style(backend): humanizar comentarios de la capa DB`
- `style(backend): humanizar comentarios de smoke.js y .env.example`
- `fix(backend): JWT_SECRET fail-fast real (rechaza placeholders y vacio)`
- `fix(backend): validar fecha real y no-pasada en POST /api/solicitudes`
- `feat(frontend): tipos de import.meta.env (VITE_API_URL, etc.)`
- `feat(frontend): cliente API unico con manejo de token y errores`
- `feat(frontend): login y registro contra /api/auth/* con manejo de errores`
- `feat(frontend): cargar catalogo de ecopuntos desde /api/ecopuntos`
- `feat(frontend): solicitudes de recoleccion via /api/solicitudes`
- `docs: README del proyecto Ecopuntos (reemplaza template Vite)`

Sin push (CLAUDE.md prohíbe push directo, y el usuario explicitó "No hagas push").

- [ ] **Step 5: Reporte final**

Producir un resumen al usuario con:
- Tests: `18 ok, 0 fallidos`.
- Build: OK.
- Lint: OK / con N warnings preexistentes.
- Commits creados: lista de hashes con sus mensajes.
- Pendiente: token Mapbox real (no resuelto por este plan, el usuario tiene que conseguirlo).
- Stub `RegisterView.tsx`: ya está versionado dentro del commit de Task 2.4 (la integración lo modificó y dejó de ser stub).

> Si CUALQUIERA de los pasos falla: aplicar `superpowers:systematic-debugging`. NO declarar trabajo completo con verificaciones en rojo (`superpowers:verification-before-completion`).

---

## Notas de ejecución

- **Orden estricto**: el build queda roto entre Task 3.3 y Task 3.5 (los handlers de App.tsx tienen firma vieja). NO commitear en medio; commitear las tres juntas en el step final de Task 3.5.
- **Phase 1 es solo comentarios**: después de cada commit de Phase 1, el smoke test debe seguir verde. Si baja el número de tests verdes, revertir el commit y revisar (signo de que se tocó código por error).
- **Si el usuario rechaza Phase 3 (integración)**: saltar directamente a Phase 4 (README) y luego Phase 5 (verificación), sin los pasos que dependen de la integración.
- **El stub `src/components/RegisterView.tsx` que estaba untracked**: la Task 3.4 lo reescribe completo, así que el `git add` natural lo deja versionado. No requiere paso extra.
- **`backend/.env` y `.env` raíz NUNCA se commitean**: están en `.gitignore`. Solo `.env.example` se versiona.
- **Solapamiento Phase 1 ↔ Phase 2**: Phase 1 humaniza el `config.js` y el `solicitudesController.js`; Phase 2 después modifica el código ejecutable de esos archivos. La nueva lógica que añade Phase 2 ya se escribe con comentarios humanizados desde el inicio (no hay que "rehacer" la humanización).
