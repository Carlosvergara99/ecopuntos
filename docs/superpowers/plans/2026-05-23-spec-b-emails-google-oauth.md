# Spec B — Emails + Google OAuth · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Habilitar envío de emails reales (Nodemailer + Gmail SMTP) en registro y creación de solicitudes, y agregar "Continuar con Google" como método de autenticación adicional, con linking automático por email.

**Architecture:** Backend recibe un módulo `mailer.js` aislado y no-bloqueante; el schema de `usuarios` se migra de forma idempotente para hacer `password_hash` nullable y añadir `google_sub UNIQUE`. Nuevo endpoint `POST /api/auth/google` valida el ID token con `google-auth-library`. Frontend usa `@react-oauth/google` para mostrar el botón oficial; `GoogleSignInButton` aislado intercambia el credential por nuestro JWT vía la API. Sin push: rama local `feat/emails-oauth`.

**Tech Stack:** Backend: Node 18+, Express 4, better-sqlite3, **nodemailer**, **google-auth-library**. Frontend: React 19, Vite 8, TypeScript, **@react-oauth/google**. Gmail SMTP como remitente (opcional, con fallback no-op). Google Identity Services para OAuth.

---

## Phase 0 — Setup

### Task 0.1: Crear rama `feat/emails-oauth` desde `dev`

**Files:** ninguno se modifica.

- [ ] **Step 1: Verificar estado de partida**

Run:
```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git branch --show-current
git status -sb
```
Expected: rama `dev`, working tree limpio (solo `.claude/` untracked).

- [ ] **Step 2: Crear y cambiar a la rama**

Run: `git checkout -b feat/emails-oauth`
Expected: `Switched to a new branch 'feat/emails-oauth'`.

- [ ] **Step 3: Confirmar baseline smoke**

Asegurar backend corriendo (si no, `cd backend && npm run dev` en otra terminal).

Run: `cd backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"`
Expected: `18 ok, 0 fallidos`.

---

## Phase 1 — Backend: schema + modelo

### Task 1.1: Migración idempotente del schema

**Files:**
- Modify: `backend/src/db/migrate.js`

- [ ] **Step 1: Editar el CREATE TABLE y añadir el bloque de migración**

Edit `backend/src/db/migrate.js`. Localizar el bloque de `CREATE TABLE IF NOT EXISTS usuarios` y reemplazarlo + añadir la migración. El archivo completo queda así:

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
  -- email UNIQUE COLLATE NOCASE (Henry@x.com == henry@x.com).
  -- password_hash es nullable: los usuarios que entran por Google no tienen.
  -- google_sub es el "sub" del JWT de Google. UNIQUE parcial para que multiples
  -- usuarios solo-password (google_sub NULL) no choquen entre si.
  CREATE TABLE IF NOT EXISTS usuarios (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre        TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT,
    google_sub    TEXT    UNIQUE,
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

// ── Migración idempotente para DBs creadas con el schema viejo ─────────
// Si ya existía la tabla `usuarios` antes de este cambio, password_hash
// estaba NOT NULL y no había google_sub. CREATE TABLE IF NOT EXISTS no
// modifica una tabla existente, así que hay que migrar a mano.
const info = db.prepare("PRAGMA table_info(usuarios)").all();
const tieneGoogleSub = info.some((c) => c.name === 'google_sub');
const passwordNotNull = info.find((c) => c.name === 'password_hash')?.notnull === 1;

if (passwordNotNull) {
  // SQLite no permite cambiar NOT NULL con ALTER. Recreamos la tabla en
  // una transacción para no perder datos si falla a mitad.
  db.transaction(() => {
    db.exec(`
      CREATE TABLE usuarios_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT,
        google_sub TEXT UNIQUE,
        creado_en TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO usuarios_new (id, nombre, email, password_hash, creado_en)
        SELECT id, nombre, email, password_hash, creado_en FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_new RENAME TO usuarios;
    `);
  })();
  console.log('[migrate] tabla usuarios recreada con password_hash nullable y google_sub');
} else if (!tieneGoogleSub) {
  // Para DBs creadas con un schema intermedio que ya tenía password_hash
  // nullable pero sin google_sub. Caso poco probable pero contemplado.
  db.exec(`ALTER TABLE usuarios ADD COLUMN google_sub TEXT`);
  console.log('[migrate] columna google_sub añadida a usuarios');
}

// Índice UNIQUE parcial: aplica solo cuando google_sub IS NOT NULL,
// permitiendo que multiples usuarios sin Google convivan.
db.exec(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_google_sub
    ON usuarios(google_sub) WHERE google_sub IS NOT NULL
`);

console.log('[migrate] Esquema aplicado correctamente.');
```

- [ ] **Step 2: Ejecutar la migración contra la BD existente**

Run: `cd backend && npm run db:migrate`

Expected output incluye:
```
[migrate] tabla usuarios recreada con password_hash nullable y google_sub
[migrate] Esquema aplicado correctamente.
```

- [ ] **Step 3: Verificar que los 20 usuarios siguen ahí y el schema es nuevo**

Run:
```bash
cd backend && node -e "
const Database = require('better-sqlite3');
const db = new Database('./ecopuntos.db');
console.log('Conteo:', db.prepare('SELECT COUNT(*) AS n FROM usuarios').get().n);
console.log('Columnas:');
for (const c of db.prepare('PRAGMA table_info(usuarios)').all()) {
  console.log('  -', c.name, '|', c.type, '| notnull=' + c.notnull);
}
"
```

Expected:
```
Conteo: 20
Columnas:
  - id | INTEGER | notnull=1
  - nombre | TEXT | notnull=1
  - email | TEXT | notnull=1
  - password_hash | TEXT | notnull=0
  - google_sub | TEXT | notnull=0
  - creado_en | TEXT | notnull=1
```

Punto clave: `password_hash | notnull=0` (era `1` antes) y `google_sub` aparece.

- [ ] **Step 4: Smoke verde (los 18 tests anteriores deben seguir pasando)**

El server tiene la BD en WAL; al cambiar el schema, nodemon NO reinicia (migrate.js no es un archivo watched). Hay que reiniciarlo manualmente para que las statements preparadas se re-creen con el schema nuevo.

```bash
# Encontrar y matar el backend
for pid in $(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":4000" | awk '{print $NF}' | sort -u); do
  taskkill //F //PID $pid 2>&1 | head -1
done
sleep 1
# Re-arrancar
cd backend && npm run dev > /tmp/backend-spec-b.log 2>&1 &
sleep 4
```

Verificar log:
```bash
tail -5 /tmp/backend-spec-b.log
```
Expected: `[ecopuntos-backend] Escuchando en http://localhost:4000`.

Smoke:
```bash
npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/db/migrate.js
git commit -m "feat(backend): migrar usuarios para password_hash nullable y google_sub"
```

### Task 1.2: Funciones nuevas en `usuariosModel.js`

**Files:**
- Modify: `backend/src/models/usuariosModel.js`

- [ ] **Step 1: Añadir 3 funciones al modelo**

Edit `backend/src/models/usuariosModel.js`. AL FINAL del archivo (después de `crear`), añadir:

```js
// ── Soporte Google OAuth ───────────────────────────────────────────────

const stmtFindByGoogleSub = db.prepare(`
  SELECT id, nombre, email, creado_en
  FROM usuarios
  WHERE google_sub = ?
`);

const stmtLinkGoogle = db.prepare(`
  UPDATE usuarios SET google_sub = ? WHERE id = ?
`);

const stmtInsertGoogle = db.prepare(`
  INSERT INTO usuarios (nombre, email, password_hash, google_sub)
  VALUES (@nombre, @email, NULL, @google_sub)
`);

// Busca por google_sub (match exacto del ID de Google). NO incluye
// password_hash en el SELECT — los usuarios solo-Google no tienen.
export function buscarPorGoogleSub(google_sub) {
  return stmtFindByGoogleSub.get(google_sub);
}

// Asocia un google_sub a un usuario existente (creado con email+password).
// Ojo: NO valida que el usuario exista ni que su google_sub estuviera vacio.
// La logica de "linkear solo si tiene sentido" vive en el controller.
export function linkearGoogle(id, google_sub) {
  stmtLinkGoogle.run(google_sub, id);
}

// Crea usuario sin password (solo Google). Devuelve el registro creado.
// password_hash queda NULL, lo cual es valido tras la migracion de Phase 1.
export function crearConGoogle({ nombre, email, google_sub }) {
  const info = stmtInsertGoogle.run({ nombre, email, google_sub });
  return buscarPorId(info.lastInsertRowid);
}
```

- [ ] **Step 2: Smoke verde**

Nodemon detecta el cambio en `usuariosModel.js` y reinicia. Verificar:
```bash
sleep 3
tail -5 /tmp/backend-spec-b.log
```
Expected: `[ecopuntos-backend] Escuchando en http://localhost:4000`.

```bash
cd backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos` (los nuevos métodos no se ejercitan todavía).

- [ ] **Step 3: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/models/usuariosModel.js
git commit -m "feat(backend): funciones de Google en usuariosModel (buscar/linkear/crear)"
```

---

## Phase 2 — Backend: Nodemailer + templates

### Task 2.1: Instalar dependencias

**Files:**
- Modify: `backend/package.json` y `backend/package-lock.json` (automático)

- [ ] **Step 1: Instalar nodemailer y google-auth-library**

Run:
```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend
npm install nodemailer google-auth-library
```
Expected: instalación sin errores. Aparecerán nuevas entradas en `dependencies` de `package.json`.

- [ ] **Step 2: Verificar que el server sigue arrancando**

Nodemon detecta el cambio de package-lock y reinicia (a veces). Si crashea, kill y restart manual:
```bash
sleep 3
tail -5 /tmp/backend-spec-b.log
```
Expected: `[ecopuntos-backend] Escuchando en http://localhost:4000`.

Si el server no respondió tras el reinstall, manualmente:
```bash
for pid in $(netstat -ano 2>/dev/null | grep "LISTENING" | grep ":4000" | awk '{print $NF}' | sort -u); do
  taskkill //F //PID $pid 2>&1 | head -1
done
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run dev > /tmp/backend-spec-b.log 2>&1 &
sleep 4
```

- [ ] **Step 3: Smoke verde**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/package.json backend/package-lock.json
git commit -m "feat(backend): agregar nodemailer y google-auth-library"
```

### Task 2.2: Extender `config.js` con SMTP y Google Client ID

**Files:**
- Modify: `backend/src/config.js`

- [ ] **Step 1: Añadir `smtp` y `googleClientId` al export**

Edit `backend/src/config.js`. Reemplazar el `export const config = { ... }` por:

```js
export const config = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  dbPath: process.env.DB_PATH ?? './ecopuntos.db',
  jwtSecret: jwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '2h',

  // Google OAuth. Si esta vacio, el endpoint /api/auth/google responde 500.
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',

  // SMTP de Gmail. Si SMTP_USER o SMTP_PASS faltan, mailer.js queda en
  // modo no-op (logea pero no envia).
  smtp: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },

  // Útil para condicionar logs en dev vs prod.
  isProd: process.env.NODE_ENV === 'production',
};
```

- [ ] **Step 2: Smoke verde (los tests no usan estos campos todavía)**

```bash
sleep 3
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/config.js
git commit -m "feat(backend): exponer config.smtp y config.googleClientId"
```

### Task 2.3: Crear `mailer.js`

**Files:**
- Create: `backend/src/services/mailer.js`

- [ ] **Step 1: Crear el módulo**

Run para crear el directorio:
```bash
mkdir -p /c/Users/NicolasPulidoMoreno/ecopuntos/backend/src/services
```

Write `backend/src/services/mailer.js`:

```js
// Mailer aislado para que no acople los controllers con nodemailer.
// API publica: send({ to, subject, html, text }).
// Init lazy: lee config la primera vez. Si SMTP_USER/PASS faltan, queda
// en modo no-op (logea y devuelve sin enviar). Asi el server arranca
// tranquilo sin credenciales y los tests no se rompen.

import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;
let modoNoOp = false;

function init() {
  if (transporter !== null || modoNoOp) return;
  if (!config.smtp.user || !config.smtp.pass) {
    modoNoOp = true;
    console.warn('[mailer] SMTP no configurado (SMTP_USER/SMTP_PASS). Emails desactivados.');
    return;
  }
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });
  console.log(`[mailer] SMTP listo (remitente: ${config.smtp.user})`);
}

// Fire-and-forget. NO lanza errores — solo loguea. Los callers no
// necesitan try/catch.
export async function send({ to, subject, html, text }) {
  init();
  if (modoNoOp) {
    console.log(`[mailer] (no-op) ${subject} → ${to}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"EcoPuntos Bogotá" <${config.smtp.user}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`[mailer] enviado a ${to}: ${info.messageId}`);
  } catch (err) {
    console.error(`[mailer] error enviando a ${to}:`, err.message);
  }
}
```

- [ ] **Step 2: Verificar que el server reinicia sin errores**

Nodemon detecta el archivo nuevo y reinicia.
```bash
sleep 3
tail -8 /tmp/backend-spec-b.log
```
Expected: `[ecopuntos-backend] Escuchando en http://localhost:4000`. **No** debe aparecer `[mailer]` todavía — solo se inicializa cuando se llama `send()`.

- [ ] **Step 3: Smoke verde**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/services/mailer.js
git commit -m "feat(backend): mailer.js (nodemailer + fallback no-op si falta SMTP)"
```

### Task 2.4: Crear `templates.js`

**Files:**
- Create: `backend/src/services/templates.js`

- [ ] **Step 1: Crear las dos plantillas**

Write `backend/src/services/templates.js`:

```js
// Plantillas de email. Cada funcion devuelve { html, text }.
// HTML con CSS inline porque algunos clientes (Outlook) ignoran <style>.
// text es fallback para clientes solo-texto.

// Header verde EcoPuntos. Usuario recien registrado.
export function welcomeEmail({ nombre, email }) {
  const html = `
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#16a34a;color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:24px;font-weight:bold;">¡Bienvenido a EcoPuntos!</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Gestión inteligente de residuos voluminosos en Bogotá</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#374151;line-height:1.6;font-size:14px;">
        <p>Hola <strong>${escapeHtml(nombre)}</strong>,</p>
        <p>Tu cuenta fue creada correctamente. Ya puedes ingresar a la plataforma, ver los ecopuntos cercanos a tu dirección y agendar recolecciones de residuos voluminosos.</p>
        <table cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f3f4f6;border-radius:8px;padding:12px 16px;">
          <tr><td style="font-size:12px;color:#6b7280;">Cuenta:</td><td style="font-size:13px;color:#111827;padding-left:8px;"><strong>${escapeHtml(email)}</strong></td></tr>
        </table>
        <p style="margin-top:24px;color:#6b7280;font-size:12px;">Si no fuiste tú quien creó esta cuenta, ignora este mensaje.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
        EcoPuntos Bogotá · Proyecto académico
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `¡Bienvenido a EcoPuntos, ${nombre}!`,
    ``,
    `Tu cuenta fue creada correctamente.`,
    `Email: ${email}`,
    ``,
    `Ya puedes ingresar a la plataforma para ver ecopuntos cercanos y agendar recolecciones.`,
    ``,
    `— EcoPuntos Bogotá`,
  ].join('\n');

  return { html, text };
}

// Header azul (operacional). Confirmacion de solicitud de recoleccion.
export function solicitudConfirmEmail({ nombre, type, description, address, date }) {
  const html = `
<!doctype html>
<html lang="es">
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#2563eb;color:#fff;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:bold;">Solicitud registrada</h1>
        <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Recolección de residuos voluminosos</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#374151;line-height:1.6;font-size:14px;">
        <p>Hola <strong>${escapeHtml(nombre)}</strong>,</p>
        <p>Tu solicitud quedó registrada. Un equipo de recolección se pondrá en contacto pronto.</p>
        <table cellpadding="8" cellspacing="0" style="width:100%;margin:16px 0;background:#f3f4f6;border-radius:8px;border-collapse:separate;">
          <tr><td style="font-size:12px;color:#6b7280;width:35%;">Tipo:</td><td style="font-size:13px;color:#111827;text-transform:capitalize;"><strong>${escapeHtml(type)}</strong></td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Descripción:</td><td style="font-size:13px;color:#111827;">${escapeHtml(description)}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Dirección:</td><td style="font-size:13px;color:#111827;">${escapeHtml(address)}</td></tr>
          <tr><td style="font-size:12px;color:#6b7280;">Fecha:</td><td style="font-size:13px;color:#111827;"><strong>${escapeHtml(date)}</strong></td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background:#f9fafb;padding:16px 24px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;">
        EcoPuntos Bogotá · Proyecto académico
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = [
    `Solicitud registrada — EcoPuntos Bogotá`,
    ``,
    `Hola ${nombre},`,
    `Tu solicitud quedó registrada. Detalles:`,
    `  Tipo: ${type}`,
    `  Descripción: ${description}`,
    `  Dirección: ${address}`,
    `  Fecha: ${date}`,
    ``,
    `Un equipo de recolección se pondrá en contacto pronto.`,
    ``,
    `— EcoPuntos Bogotá`,
  ].join('\n');

  return { html, text };
}

// Escape minimo para evitar inyeccion de HTML cuando los strings vienen
// del usuario (nombre, direccion, descripcion). NO depende de librerias.
function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```

- [ ] **Step 2: Smoke verde**

```bash
sleep 3
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `18 ok, 0 fallidos`.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/services/templates.js
git commit -m "feat(backend): plantillas HTML de bienvenida y confirmacion de solicitud"
```

---

## Phase 3 — Backend: Google OAuth

### Task 3.1: Añadir tests para el nuevo endpoint (fallarán hasta Task 3.2)

**Files:**
- Modify: `backend/scripts/smoke.js`

- [ ] **Step 1: Añadir 2 tests de OAuth**

Edit `backend/scripts/smoke.js`. Localizar la sección `// ── 404 ──` y JUSTO ANTES de ese bloque, añadir:

```js
// ── Google OAuth ─────────────────────────────────────────────────────────
console.log('\nGoogle OAuth');
await test('POST /api/auth/google sin credential → 422', async () => {
  const { status, body } = await api('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  assert.equal(status, 422);
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

await test('POST /api/auth/google con credential basura → 401', async () => {
  const { status, body } = await api('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential: 'esto-no-es-un-jwt' }),
  });
  assert.equal(status, 401);
  assert.equal(body.error.code, 'GOOGLE_TOKEN_INVALIDO');
});
```

- [ ] **Step 2: Correr smoke (deben fallar los 2 nuevos)**

```bash
cd backend && npm run test:smoke 2>&1 | grep -E "(ok|fallidos)" | tail -3
```
Expected: `18 ok, 2 fallidos` (los 2 nuevos fallan con 404 NOT_FOUND porque el endpoint no existe aún).

### Task 3.2: Implementar `googleLogin` en `authController` + ruta

**Files:**
- Modify: `backend/src/controllers/authController.js`
- Modify: `backend/src/routes/authRoutes.js`

- [ ] **Step 1: Añadir import + handler en `authController.js`**

Edit `backend/src/controllers/authController.js`.

A) Al INICIO del archivo, después del import de `bcryptjs`, añadir:

```js
import { OAuth2Client } from 'google-auth-library';
```

B) Después del bloque `import * as Usuarios from '../models/usuariosModel.js';`, añadir:

```js
// Cliente de Google para verificar ID tokens. La "audience" del token
// debe coincidir con nuestro Client ID. Esto evita que un atacante use
// un token emitido para OTRA app como si fuera de la nuestra.
const googleClient = new OAuth2Client(config.googleClientId);
```

C) Al FINAL del archivo (después de `export function yo(...)`), añadir el nuevo handler:

```js
// POST /api/auth/google
// Body: { credential: string }  ← ID token JWT que el frontend recibe
//                                   de Google Identity Services.
// Flow:
//   1. Validar que credential viene.
//   2. Verificar firma/audience/expiracion con google-auth-library.
//   3. Buscar usuario por google_sub. Si no, por email (linkear). Si no, crear.
//   4. Firmar nuestro JWT y devolverlo. El frontend lo guarda en localStorage.
export async function googleLogin(req, res) {
  const { credential } = req.body ?? {};
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Falta credential.');
  }
  if (!config.googleClientId) {
    throw new HttpError(500, 'GOOGLE_NO_CONFIGURADO',
      'El servidor no tiene GOOGLE_CLIENT_ID configurado.');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw new HttpError(401, 'GOOGLE_TOKEN_INVALIDO',
      'El token de Google no es válido.');
  }

  const { sub, email, name, email_verified } = payload ?? {};
  if (!email || !email_verified) {
    throw new HttpError(401, 'GOOGLE_EMAIL_NO_VERIFICADO',
      'Tu email de Google no está verificado.');
  }

  // Buscar primero por google_sub (match exacto), luego por email (linkeo).
  let fila = Usuarios.buscarPorGoogleSub(sub);
  if (!fila) {
    fila = Usuarios.buscarPorEmail(email);
    if (fila) {
      // Existe con email+password — linkear su google_sub para la próxima vez.
      Usuarios.linkearGoogle(fila.id, sub);
    } else {
      // Usuario nuevo: crear sin password_hash (queda NULL).
      fila = Usuarios.crearConGoogle({
        nombre: name ?? email.split('@')[0],
        email,
        google_sub: sub,
      });
    }
  }

  const usuario = {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    creado_en: fila.creado_en,
  };
  const token = firmarToken(usuario);
  return ok(res, { token, usuario });
}
```

- [ ] **Step 2: Añadir la ruta en `authRoutes.js`**

Edit `backend/src/routes/authRoutes.js`. Añadir UNA línea después de la línea de `router.post('/login', ...)`:

```js
router.post('/google',   asyncHandler(authController.googleLogin));
```

El archivo completo de routes queda:

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
router.post('/google',   asyncHandler(authController.googleLogin));
router.get('/yo',        requireAuth, asyncHandler(authController.yo));

export default router;
```

- [ ] **Step 3: Esperar a que nodemon reinicie y correr smoke**

```bash
sleep 3
tail -3 /tmp/backend-spec-b.log
```
Expected: `[ecopuntos-backend] Escuchando en http://localhost:4000`.

```bash
cd backend && npm run test:smoke 2>&1 | grep -E "(ok|fallidos)" | tail -3
```
Expected: `20 ok, 0 fallidos`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/controllers/authController.js backend/src/routes/authRoutes.js backend/scripts/smoke.js
git commit -m "feat(backend): POST /api/auth/google con linking por email y 2 tests"
```

---

## Phase 4 — Backend: triggers de email

### Task 4.1: Disparar email de bienvenida en `registro` y `googleLogin`

**Files:**
- Modify: `backend/src/controllers/authController.js`

- [ ] **Step 1: Importar mailer y templates**

Edit `backend/src/controllers/authController.js`. AL INICIO, junto a los otros imports, añadir:

```js
import * as mailer from '../services/mailer.js';
import { welcomeEmail } from '../services/templates.js';
```

- [ ] **Step 2: Disparar email en `registro` (fire-and-forget)**

Edit `backend/src/controllers/authController.js`. Localizar la función `registro` y modificar el FINAL — donde dice:

```js
  const token = firmarToken(usuario);
  return ok(res, { token, usuario }, 201);
}
```

Reemplazar por:

```js
  const token = firmarToken(usuario);

  // Email de bienvenida fire-and-forget. Si SMTP no esta configurado o falla,
  // mailer.send loguea y vuelve — no afecta la respuesta al cliente.
  mailer.send({
    to: usuario.email,
    subject: 'Bienvenido a EcoPuntos Bogotá',
    ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
  });

  return ok(res, { token, usuario }, 201);
}
```

- [ ] **Step 3: Disparar email en `googleLogin` solo cuando el usuario es nuevo**

Edit `backend/src/controllers/authController.js`. Localizar `googleLogin` y modificar el bloque de búsqueda + el final. El handler completo queda así:

```js
export async function googleLogin(req, res) {
  const { credential } = req.body ?? {};
  if (typeof credential !== 'string' || credential.length === 0) {
    throw new HttpError(422, 'VALIDATION_ERROR', 'Falta credential.');
  }
  if (!config.googleClientId) {
    throw new HttpError(500, 'GOOGLE_NO_CONFIGURADO',
      'El servidor no tiene GOOGLE_CLIENT_ID configurado.');
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (err) {
    throw new HttpError(401, 'GOOGLE_TOKEN_INVALIDO',
      'El token de Google no es válido.');
  }

  const { sub, email, name, email_verified } = payload ?? {};
  if (!email || !email_verified) {
    throw new HttpError(401, 'GOOGLE_EMAIL_NO_VERIFICADO',
      'Tu email de Google no está verificado.');
  }

  let fila = Usuarios.buscarPorGoogleSub(sub);
  let esNuevo = false;
  if (!fila) {
    fila = Usuarios.buscarPorEmail(email);
    if (fila) {
      Usuarios.linkearGoogle(fila.id, sub);
    } else {
      fila = Usuarios.crearConGoogle({
        nombre: name ?? email.split('@')[0],
        email,
        google_sub: sub,
      });
      esNuevo = true;
    }
  }

  const usuario = {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    creado_en: fila.creado_en,
  };
  const token = firmarToken(usuario);

  // Email de bienvenida solo si la cuenta es nueva (creada en este flow).
  if (esNuevo) {
    mailer.send({
      to: usuario.email,
      subject: 'Bienvenido a EcoPuntos Bogotá',
      ...welcomeEmail({ nombre: usuario.nombre, email: usuario.email }),
    });
  }

  return ok(res, { token, usuario });
}
```

- [ ] **Step 4: Smoke verde**

```bash
sleep 3
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "(ok|fallidos)" | tail -3
```
Expected: `20 ok, 0 fallidos`.

Para verificar visualmente que los emails se disparan (en modo no-op porque SMTP_USER está vacío), observar el log:
```bash
tail -8 /tmp/backend-spec-b.log
```
Debería aparecer `[mailer] (no-op) Bienvenido a EcoPuntos Bogotá → smoke+1779...@example.com` cuando los smoke tests ejecuten `POST /api/auth/registro`.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/controllers/authController.js
git commit -m "feat(backend): email de bienvenida en registro y google login (nuevo)"
```

### Task 4.2: Disparar email de confirmación en `solicitudes.crear`

**Files:**
- Modify: `backend/src/controllers/solicitudesController.js`

- [ ] **Step 1: Importar mailer y template**

Edit `backend/src/controllers/solicitudesController.js`. AL INICIO, junto a los otros imports, añadir:

```js
import * as mailer from '../services/mailer.js';
import { solicitudConfirmEmail } from '../services/templates.js';
```

- [ ] **Step 2: Disparar email en `crear` (fire-and-forget)**

Edit `backend/src/controllers/solicitudesController.js`. Localizar la función `crear` y MODIFICAR el FINAL — donde dice:

```js
  return ok(res, { solicitud: aFormatoFrontend(fila) }, 201);
}
```

Reemplazar por:

```js
  // Email de confirmacion fire-and-forget al usuario autenticado.
  mailer.send({
    to: req.usuario.email,
    subject: 'Tu solicitud de recolección fue registrada',
    ...solicitudConfirmEmail({
      nombre: req.usuario.nombre,
      type: fila.tipo,
      description: fila.descripcion,
      address: fila.direccion,
      date: fila.fecha,
    }),
  });

  return ok(res, { solicitud: aFormatoFrontend(fila) }, 201);
}
```

- [ ] **Step 3: Smoke verde**

```bash
sleep 3
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "(ok|fallidos)" | tail -3
```
Expected: `20 ok, 0 fallidos`. En logs aparecerá `[mailer] (no-op) Tu solicitud de recolección...` cuando el test válido cree una solicitud.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/src/controllers/solicitudesController.js
git commit -m "feat(backend): email de confirmacion en POST /api/solicitudes"
```

### Task 4.3: Actualizar `.env.example` con SMTP y Google Client ID

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Añadir las 3 variables nuevas**

Edit `backend/.env.example`. Reemplazar el contenido completo por:

```
# Plantilla del .env del backend. Cópiala a `.env` y rellena los valores.
# `.env` está en .gitignore — no subir secretos al repo.

# Puerto del backend. 5173 es del Vite, por eso usamos 4000.
PORT=4000

# Origen permitido por CORS. En dev es el dev-server de Vite.
CORS_ORIGIN=http://localhost:5173

# Ruta del SQLite (relativa a la carpeta backend/).
DB_PATH=./ecopuntos.db

# Secreto para firmar los JWT. OBLIGATORIO y no puede ser un placeholder.
# Genera uno real con:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# El server REHÚSA arrancar si esta variable falta o tiene un placeholder
# conocido como "cambia-esto-en-produccion".
JWT_SECRET=

# Tiempo de vida del token. Ej: "15m", "2h", "7d".
JWT_EXPIRES_IN=2h

# Google OAuth — Client ID publico de tu app en Google Cloud Console.
# Termina en .apps.googleusercontent.com. Es el MISMO valor que
# VITE_GOOGLE_CLIENT_ID en el .env del frontend.
# Si esta vacio, /api/auth/google devuelve 500 (los demas endpoints OK).
GOOGLE_CLIENT_ID=

# Gmail SMTP — opcional. Si no se configura, los emails no se envian
# (el server loguea "(no-op)" y sigue funcionando normal).
# Pasos:
#   1. Activar 2FA en https://myaccount.google.com/security
#   2. Crear contraseña de aplicación en https://myaccount.google.com/apppasswords
#   3. SMTP_USER = tu Gmail; SMTP_PASS = los 16 chars sin espacios.
SMTP_USER=
SMTP_PASS=
```

- [ ] **Step 2: Commit**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
git add backend/.env.example
git commit -m "docs(backend): .env.example con GOOGLE_CLIENT_ID y SMTP"
```

---

## Phase 5 — Frontend: setup OAuth

### Task 5.1: Instalar `@react-oauth/google`

**Files:**
- Modify: `package.json` y `pnpm-lock.yaml` (automático)

- [ ] **Step 1: Instalar dependencia DESDE LA RAÍZ**

⚠️ Importante: correr `corepack pnpm add` desde `C:\Users\NicolasPulidoMoreno\ecopuntos` (raíz), NO desde `backend/`. Si lo corres desde backend rompe el `node_modules` del backend.

Run:
```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos
corepack pnpm add @react-oauth/google
```
Expected: instalación sin errores. Aparece en `dependencies` de `package.json` raíz.

- [ ] **Step 2: Verificar que NO se contamino el backend**

```bash
ls backend/pnpm-* 2>/dev/null || echo "OK, sin archivos pnpm parasitos en backend/"
```
Expected: `OK, sin archivos pnpm parasitos en backend/`.

Si aparecieron, limpiar inmediatamente:
```bash
rm backend/pnpm-lock.yaml backend/pnpm-workspace.yaml 2>/dev/null
cd backend && rm -rf node_modules && npm install
```

- [ ] **Step 3: Build TS limpio**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos && corepack pnpm build 2>&1 | tail -3
```
Expected: `✓ built in N.NNs`.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "feat(frontend): agregar @react-oauth/google"
```

### Task 5.2: Tipo `VITE_GOOGLE_CLIENT_ID` en `vite-env.d.ts`

**Files:**
- Modify: `src/vite-env.d.ts`

- [ ] **Step 1: Añadir la variable al interface**

Edit `src/vite-env.d.ts`. Reemplazar el contenido completo por:

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 2: Build limpio**

```bash
corepack pnpm build 2>&1 | tail -3
```
Expected: `✓ built in N.NNs`.

- [ ] **Step 3: Commit**

```bash
git add src/vite-env.d.ts
git commit -m "feat(frontend): tipo VITE_GOOGLE_CLIENT_ID en import.meta.env"
```

### Task 5.3: Wrapping en `main.tsx`

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Leer el archivo actual**

Run: `cat src/main.tsx` (para ver el contenido actual antes de tocar).

- [ ] **Step 2: Reescribir con el provider condicional**

Write `src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css';
import App from './App.tsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Envolvemos con GoogleOAuthProvider solo si hay client id. Si no, la app
// funciona igual y el GoogleSignInButton se oculta solo (ver componente).
const root = createRoot(document.getElementById('root')!);
root.render(
  <StrictMode>
    {GOOGLE_CLIENT_ID ? (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);
```

> Nota: el archivo original puede tener un import de CSS o un nombre distinto del elemento root. Si tu `main.tsx` original difiere, conservar esas líneas (los imports de CSS y el target del root) y solo añadir el wrapper de Google.

- [ ] **Step 3: Build limpio**

```bash
corepack pnpm build 2>&1 | tail -3
```
Expected: `✓ built in N.NNs`. Si TS se queja del archivo `.tsx` extension del import, ajustar.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx
git commit -m "feat(frontend): envolver App con GoogleOAuthProvider (condicional)"
```

---

## Phase 6 — Frontend: `GoogleSignInButton` + integración

### Task 6.1: Crear `GoogleSignInButton.tsx`

**Files:**
- Create: `src/components/GoogleSignInButton.tsx`

- [ ] **Step 1: Crear el componente**

Write `src/components/GoogleSignInButton.tsx`:

```tsx
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { api, setToken } from '../lib/api';

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

interface Props {
  onSuccess: (usuario: Usuario) => void;
  onError: (msg: string) => void;
}

const GoogleSignInButton: React.FC<Props> = ({ onSuccess, onError }) => {
  // Si no hay client id configurado, no renderizamos nada. La app sigue
  // funcionando con login/registro tradicional.
  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!hasGoogle) return null;

  return (
    <GoogleLogin
      onSuccess={async (response) => {
        if (!response.credential) {
          onError('Google no devolvió credencial.');
          return;
        }
        try {
          const { token, usuario } = await api<AuthResponse>('/api/auth/google', {
            method: 'POST',
            body: JSON.stringify({ credential: response.credential }),
          });
          setToken(token);
          localStorage.setItem('eco_user', JSON.stringify(usuario));
          onSuccess(usuario);
        } catch (err) {
          onError(err instanceof Error ? err.message : 'Error con Google Sign-in.');
        }
      }}
      onError={() => onError('No se pudo iniciar sesión con Google.')}
      theme="outline"
      size="large"
      text="continue_with"
      shape="rectangular"
      locale="es"
      width="320"
    />
  );
};

export default GoogleSignInButton;
```

- [ ] **Step 2: Build limpio**

```bash
corepack pnpm build 2>&1 | tail -3
```
Expected: `✓ built in N.NNs`.

- [ ] **Step 3: Commit**

```bash
git add src/components/GoogleSignInButton.tsx
git commit -m "feat(frontend): GoogleSignInButton aislado, intercambia credential por JWT"
```

### Task 6.2: Integrar el botón en LoginView

**Files:**
- Modify: `src/components/LoginView.tsx`

- [ ] **Step 1: Cambiar la interfaz y añadir el botón**

Edit `src/components/LoginView.tsx`. Reemplazar el contenido completo por:

```tsx
import React, { useState } from 'react';
import { Mail, Lock, ChevronRight, Recycle } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';
import GoogleSignInButton from './GoogleSignInButton';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void> | void;
  onGoogleSuccess: (usuario: Usuario) => void;
  onRegisterClick: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onGoogleSuccess, onRegisterClick }) => {
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

            {/* Separador "o continuar con" */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="mx-3 text-[10px] text-gray-400 uppercase tracking-widest">o continuar con</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            {/* Botón oficial de Google. Se oculta solo si VITE_GOOGLE_CLIENT_ID no esta seteado. */}
            <div className="flex justify-center">
              <GoogleSignInButton onSuccess={onGoogleSuccess} onError={setError} />
            </div>
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

- [ ] **Step 2: Build queda roto** (App.tsx no pasa la nueva prop). NO commitear todavía.

### Task 6.3: Integrar el botón en RegisterView

**Files:**
- Modify: `src/components/RegisterView.tsx`

- [ ] **Step 1: Cambiar la interfaz y añadir el botón**

Edit `src/components/RegisterView.tsx`. Reemplazar el contenido completo por:

```tsx
import React, { useState } from 'react';
import { Mail, Lock, User, ChevronRight, Recycle, ArrowLeft } from 'lucide-react';
import Button from './ui/Button';
import TextField from './ui/TextField';
import GoogleSignInButton from './GoogleSignInButton';

interface Usuario {
  id: number;
  nombre: string;
  email: string;
  creado_en?: string;
}

interface RegisterViewProps {
  onRegister: (nombre: string, email: string, password: string) => Promise<void> | void;
  onGoogleSuccess: (usuario: Usuario) => void;
  onBackToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onRegister, onGoogleSuccess, onBackToLogin }) => {
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

            {/* Separador "o continuar con" */}
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-gray-200"></div>
              <span className="mx-3 text-[10px] text-gray-400 uppercase tracking-widest">o continuar con</span>
              <div className="flex-grow border-t border-gray-200"></div>
            </div>

            <div className="flex justify-center">
              <GoogleSignInButton onSuccess={onGoogleSuccess} onError={setError} />
            </div>
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

- [ ] **Step 2: Build sigue roto** (App.tsx). NO commit todavía.

### Task 6.4: Integrar `handleGoogleSuccess` en App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Añadir el handler y pasarlo a ambos views**

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

  // Llamado por GoogleSignInButton tras intercambiar el credential por JWT.
  // El token y eco_user ya fueron persistidos por el componente — aqui solo
  // sincronizamos el state de React y navegamos al mapa.
  const handleGoogleSuccess = (usuario: Usuario) => {
    setUser(usuario);
    navigate('map');
  };

  const handleLogout = () => {
    setUser(null);
    clearToken();
    localStorage.removeItem('eco_user');
    navigate('login');
  };

  // MapView todavía espera { name, email } (shape del compañero). Mapeamos.
  const userForMap = user ? { name: user.nombre, email: user.email } : null;

  return (
    <div className="w-full h-screen font-sans antialiased">
      {currentView === 'login' && (
        <LoginView
          onLogin={handleLogin}
          onGoogleSuccess={handleGoogleSuccess}
          onRegisterClick={() => navigate('register')}
        />
      )}

      {currentView === 'register' && (
        <RegisterView
          onRegister={handleRegister}
          onGoogleSuccess={handleGoogleSuccess}
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

- [ ] **Step 2: Build limpio**

```bash
corepack pnpm build 2>&1 | tail -3
```
Expected: `✓ built in N.NNs`.

- [ ] **Step 3: Lint sin nuevos errores**

```bash
corepack pnpm lint 2>&1 | tail -6
```
Expected: 3 errores pre-existentes en `MapContext.tsx` (any en routeData, fast-refresh por export useMapContext). No deben aparecer errores nuevos.

- [ ] **Step 4: Commit conjunto Login/Register/App (tasks 6.2 + 6.3 + 6.4)**

```bash
git add src/components/LoginView.tsx src/components/RegisterView.tsx src/App.tsx
git commit -m "feat(frontend): boton de Google en Login y Registro, handler compartido"
```

---

## Phase 7 — Verificación final

### Task 7.1: Smoke + build + lint

**Files:** ninguno.

- [ ] **Step 1: Smoke backend (esperado: 20 ok)**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos/backend && npm run test:smoke 2>&1 | grep -E "^[0-9]+ ok"
```
Expected: `20 ok, 0 fallidos`.

- [ ] **Step 2: Build frontend desde la raíz**

```bash
cd /c/Users/NicolasPulidoMoreno/ecopuntos && corepack pnpm build 2>&1 | tail -2
```
Expected: `✓ built in N.NNs`.

- [ ] **Step 3: Lint sin errores nuevos**

```bash
corepack pnpm lint 2>&1 | tail -6
```
Expected: solo los 3 errores pre-existentes en `MapContext.tsx`.

- [ ] **Step 4: Limpiar archivos pnpm parasitos en backend (si existen)**

```bash
rm backend/pnpm-lock.yaml backend/pnpm-workspace.yaml 2>/dev/null
git status -sb
```
Expected: solo `.claude/` untracked.

### Task 7.2: Verificación manual end-to-end

**Files:** ninguno. Requiere servers vivos.

- [ ] **Step 1: Asegurar backend en :4000 y frontend en :5173**

```bash
netstat -ano | grep "LISTENING" | grep -E ":(4000|5173)" | head -3
```
Expected: dos líneas (backend + frontend).

Si frontend no está corriendo: `corepack pnpm dev > /tmp/vite.log 2>&1 &` desde la raíz.

- [ ] **Step 2: Abrir http://localhost:5173/ en el navegador**

Verifica que en Login ves:
- Header verde "EcoPuntos Bogotá"
- Form de email + password
- Botón verde "Ingresar a la Plataforma"
- Separador "o continuar con"
- **Botón blanco "Sign in with Google" (en español: "Iniciar sesión con Google" o "Continuar con Google")**
- Link "¿No tienes cuenta? Regístrate aquí"

- [ ] **Step 3: Login tradicional con cuenta existente**

Usar credenciales de cualquier cuenta registrada previamente (ej. la que creaste tipeando email+password en Spec A).

Expected: entra al mapa.

Si **SMTP estaba configurado** (`SMTP_USER` y `SMTP_PASS` no vacíos): este login NO dispara email (el email solo va en registro, no en login). Skip.

- [ ] **Step 4: Logout y registrar cuenta nueva con email+password**

1. Click LogOut.
2. Click "¿No tienes cuenta? Regístrate aquí".
3. Llenar: nombre `Test Spec B`, email cualquiera (`testb-<timestamp>@test.com`), password `secreta123`.
4. Click "Crear cuenta".

Expected: entra al mapa.

En el log del backend (`tail -3 /tmp/backend-spec-b.log`):
- Si SMTP configurado: `[mailer] enviado a testb-...@test.com: <messageId>`.
- Si SMTP no configurado: `[mailer] (no-op) Bienvenido a EcoPuntos Bogotá → testb-...`.

Si configuraste SMTP con tu propio Gmail, verifica la inbox de tu Gmail — debería llegar un email "Bienvenido a EcoPuntos Bogotá".

- [ ] **Step 5: Sign-in with Google (cuenta nueva)**

1. Logout.
2. En Login, click el botón "Continuar con Google" / "Sign in with Google".
3. Se abre popup de Google. Elige tu cuenta (la que agregaste como "test user" en Google Cloud Console).
4. Si Google muestra "This app isn't verified", click "Continue anyway" (esperado en modo Testing).
5. Autoriza acceso a `email` y `profile`.

Expected:
- Popup se cierra.
- Frontend te lleva al mapa (estado splash).
- En DevTools (F12 → Application → Local Storage), `eco_token` y `eco_user` están presentes.

En el log del backend:
- Si SMTP configurado: email de bienvenida enviado.
- Si no: `[mailer] (no-op) Bienvenido...`.

- [ ] **Step 6: Sign-in con la MISMA cuenta de Google (segunda vez)**

1. Logout.
2. Click "Continuar con Google" de nuevo con la misma cuenta.

Expected:
- Entra al mapa.
- En el backend NO debería enviar email de bienvenida (no es usuario nuevo).
- En la BD el usuario sigue siendo el mismo (verifícalo abajo).

```bash
cd backend && node -e "
const Database = require('better-sqlite3');
const db = new Database('./ecopuntos.db');
console.log(db.prepare('SELECT id, nombre, email, google_sub IS NOT NULL AS has_google, password_hash IS NOT NULL AS has_password FROM usuarios ORDER BY id DESC LIMIT 5').all());
"
```
Expected: el usuario creado por Google login tiene `has_google: 1` y `has_password: 0`.

- [ ] **Step 7: Linkear cuenta existente con Google**

Caso interesante: si tu Gmail es el mismo que usaste en el paso 4 (testb-<timestamp>@test.com), debería linkearse. Pero como esos emails son ficticios, probemos al revés:

1. Crear cuenta NUEVA con email+password usando el MISMO email que tu Gmail real. Ejemplo: si tu Gmail es `npulido1155@gmail.com`, hacer registro tradicional con ese email y password `secreta123`.
2. Logout.
3. Click "Continuar con Google" con `npulido1155@gmail.com`.

Expected:
- Entra al mapa.
- Verificar en BD que es el MISMO usuario (mismo `id`) que se creó en paso 1, ahora con `has_google: 1` Y `has_password: 1`:

```bash
cd backend && node -e "
const Database = require('better-sqlite3');
const db = new Database('./ecopuntos.db');
console.log(db.prepare(\"SELECT id, nombre, email, google_sub IS NOT NULL AS has_google, password_hash IS NOT NULL AS has_password FROM usuarios WHERE email = 'npulido1155@gmail.com' COLLATE NOCASE\").all());
"
```

(Reemplaza el email por el que usaste.)

Expected: una sola fila con `has_google: 1, has_password: 1`.

- [ ] **Step 8: Solicitud de recolección + email de confirmación**

1. Estando logueado, buscar una dirección en el mapa (ej. `Carrera 11 # 127-50`).
2. Click en un ecopunto cercano → "Trazar ruta" / cerrar.
3. Click en el FAB "Residuos Voluminosos".
4. Llenar el flow de 3 pasos (tipo: muebles, descripción cualquiera, fecha futura).
5. Click "Confirmar Solicitud".

Expected:
- Aparece pantalla "¡Todo listo!".
- En log backend: `[mailer] enviado a ...` o `[mailer] (no-op) Tu solicitud...`.

Si SMTP configurado: revisa tu Gmail — email con asunto "Tu solicitud de recolección fue registrada".

### Task 7.3: Resumen final

**Files:** ninguno.

- [ ] **Step 1: Commit log**

```bash
git log --oneline dev..HEAD
```
Expected (aprox 14 commits):
```
xxxxxxx feat(frontend): boton de Google en Login y Registro, handler compartido
xxxxxxx feat(frontend): GoogleSignInButton aislado, intercambia credential por JWT
xxxxxxx feat(frontend): envolver App con GoogleOAuthProvider (condicional)
xxxxxxx feat(frontend): tipo VITE_GOOGLE_CLIENT_ID en import.meta.env
xxxxxxx feat(frontend): agregar @react-oauth/google
xxxxxxx docs(backend): .env.example con GOOGLE_CLIENT_ID y SMTP
xxxxxxx feat(backend): email de confirmacion en POST /api/solicitudes
xxxxxxx feat(backend): email de bienvenida en registro y google login (nuevo)
xxxxxxx feat(backend): POST /api/auth/google con linking por email y 2 tests
xxxxxxx feat(backend): plantillas HTML de bienvenida y confirmacion de solicitud
xxxxxxx feat(backend): mailer.js (nodemailer + fallback no-op si falta SMTP)
xxxxxxx feat(backend): exponer config.smtp y config.googleClientId
xxxxxxx feat(backend): agregar nodemailer y google-auth-library
xxxxxxx feat(backend): funciones de Google en usuariosModel (buscar/linkear/crear)
xxxxxxx feat(backend): migrar usuarios para password_hash nullable y google_sub
```

- [ ] **Step 2: Working tree limpio**

```bash
git status -sb
```
Expected: solo `.claude/` untracked.

- [ ] **Step 3: Reporte final**

Producir resumen con:
- Tests: `20 ok, 0 fallidos`.
- Build: OK.
- Lint: 3 errores pre-existentes (no nuevos).
- 15 commits aprox sobre `feat/emails-oauth`.
- Migración aplicada: 20 usuarios preservados, schema actualizado.
- Si SMTP configurado: emails reales llegando.
- Si SMTP no configurado: backend funciona, solo loguea `(no-op)`.

Si CUALQUIER paso falla: `superpowers:systematic-debugging`. NO declarar completo con verificaciones rojas (`superpowers:verification-before-completion`).

---

## Notas de ejecución

- **Sin push**: todos los commits se quedan locales. Decisión final con `finishing-a-development-branch`.
- **Build queda roto** entre Task 6.2 y Task 6.4 (cambios en interfaces de LoginView/RegisterView que App.tsx debe consumir). NO commit individual entre esos pasos — commit conjunto al final de 6.4.
- **`corepack pnpm add`** SIEMPRE desde la raíz, NUNCA desde `backend/`. Mismo error que cometí dos veces antes.
- **Nodemon vs migración**: `migrate.js` NO se watche por nodemon. Después de editarlo, ejecutar manualmente `npm run db:migrate` Y reiniciar el server para que las prepared statements se recompilen con el schema nuevo.
- **Test users en Google Cloud**: el flow de Google sign-in solo funciona con emails registrados como "test users" en Google Cloud Console (mientras la app esté en modo "Testing"). Si tu compañero quiere probar, hay que agregar su Gmail también.
- **SMTP fallback no-op**: el plan funciona incluso si NO configuras `SMTP_USER`/`SMTP_PASS`. Solo no llegan emails. Si quieres probar emails reales, edita `backend/.env` con tu Gmail y app password de 16 chars.
