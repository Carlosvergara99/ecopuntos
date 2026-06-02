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
