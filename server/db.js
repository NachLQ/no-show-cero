// db.js
// Conexión SQLite (better-sqlite3) y esquema de la base de datos.

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(__dirname, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const DB_PATH = join(DATA_DIR, 'noshowcero.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Fechas: se guardan como ISO local 'YYYY-MM-DDTHH:mm' para que la agenda
// muestre exactamente lo que la dueña del negocio escribió, sin líos de zona horaria.
export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tipos_cita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      duracion_min INTEGER NOT NULL DEFAULT 30,
      precio REAL NOT NULL DEFAULT 0,
      politica_deposito TEXT NOT NULL DEFAULT 'ninguno' CHECK (politica_deposito IN ('ninguno','reincidentes','siempre')),
      importe_deposito REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT,
      notas TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo_cita_id INTEGER NOT NULL REFERENCES tipos_cita(id),
      fecha_hora TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','asistida','no_show','cancelada')),
      notas TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS confirmaciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
      paso TEXT NOT NULL CHECK (paso IN ('recordatorio_48h','aviso_24h','alerta_negocio')),
      enviado_at TEXT NOT NULL,
      respuesta TEXT CHECK (respuesta IN ('confirmada','reprogramar')),
      respondido_at TEXT
    );

    CREATE TABLE IF NOT EXISTS depositos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cita_id INTEGER NOT NULL REFERENCES citas(id) ON DELETE CASCADE,
      importe REAL NOT NULL,
      estado TEXT NOT NULL DEFAULT 'solicitado' CHECK (estado IN ('solicitado','registrado','aplicado','devuelto','perdido')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lista_espera (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      tipo_cita_id INTEGER REFERENCES tipos_cita(id),
      preferencia TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS eventos_asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
      cita_id INTEGER REFERENCES citas(id) ON DELETE SET NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('asistio','no_show','cancelacion_tardia','cancelacion_ok','hueco_recuperado','reprogramada')),
      importe REAL NOT NULL DEFAULT 0,
      fecha TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
      cita_id INTEGER REFERENCES citas(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL CHECK (tipo IN ('recordatorio_48h','aviso_24h','alerta_negocio','solicitud_deposito','oferta_hueco')),
      texto TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','enviado','caducado')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_citas_fecha ON citas(fecha_hora);
    CREATE INDEX IF NOT EXISTS idx_citas_cliente ON citas(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_conf_cita ON confirmaciones(cita_id);
    CREATE INDEX IF NOT EXISTS idx_eventos_cliente ON eventos_asistencia(cliente_id);
    CREATE INDEX IF NOT EXISTS idx_mensajes_estado ON mensajes(estado);
  `);
}

// --- Helpers de configuración ---

const CONFIG_DEFAULTS = {
  negocio_nombre: 'Mi negocio',
  negocio_telefono: '',
  horas_recordatorio: '48',
  horas_segundo_aviso: '24',
  horas_alerta: '12',
  umbral_reincidente: '2',
  ofertas_por_hueco: '3',
  texto_politica:
    'Para reservar determinadas citas pedimos una señal que se descuenta íntegra del precio del servicio. ' +
    'Si cancelas con más de 24 horas de antelación, la señal se devuelve o se guarda para tu próxima cita. ' +
    'Si no acudes sin avisar, la señal se pierde. Esta política nos permite mantener la agenda disponible ' +
    'para todos los clientes y ofrecer los huecos libres a quien los está esperando.',
};

export function getConfig() {
  const rows = db.prepare('SELECT clave, valor FROM config').all();
  const cfg = { ...CONFIG_DEFAULTS };
  for (const r of rows) {
    // Bandera interna: no es un ajuste del negocio y no se enseña ni se pisa desde la UI.
    if (r.clave === 'auto_seed') continue;
    cfg[r.clave] = r.valor;
  }
  return cfg;
}

export function setConfig(parcial) {
  const up = db.prepare('INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor');
  const tx = db.transaction((obj) => {
    for (const [k, v] of Object.entries(obj)) {
      if (k in CONFIG_DEFAULTS) up.run(k, String(v));
    }
  });
  tx(parcial);
}

// --- Helpers de fecha (ISO local sin zona) ---

export function isoLocal(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function ahora() {
  return isoLocal(new Date());
}

export function horasHasta(fechaIso) {
  return (new Date(fechaIso).getTime() - Date.now()) / 3600000;
}

export default db;
