// index.js
// API REST de No-Show Cero. Puerto 4000.
// Al arrancar: crea el esquema, siembra datos demo si la base está vacía
// y procesa la cascada de avisos pendiente (sin cron: ver motor.js).

import express from 'express';
import cors from 'cors';
import db, { initSchema, getConfig, setConfig, ahora, isoLocal, horasHasta } from './db.js';
import { seed } from './seed.js';
import { procesarAvisos, ofrecerHueco } from './motor.js';
import { calcularFiabilidad } from './fiabilidad.js';
import { msgSolicitudDeposito } from './mensajes.js';
import { loadOrCreateToken, createAuth, bindHost } from './auth.js';
import { corsOriginAllow } from './nach_net_security.js';

initSchema();

// Si el negocio pidió empezar de cero, clientes queda vacío a propósito.
// No volver a sembrar la demo en el siguiente arranque.
function autoSeedBloqueado() {
  const row = db.prepare("SELECT valor FROM config WHERE clave = 'auto_seed'").get();
  return row?.valor === '0';
}

if (db.prepare('SELECT COUNT(*) AS n FROM clientes').get().n === 0 && !autoSeedBloqueado()) {
  console.log('Base de datos vacía: cargando datos demo...');
  seed();
}
const generadosArranque = procesarAvisos();
console.log('Avisos procesados al arrancar:', generadosArranque);

const apiToken = loadOrCreateToken();
const auth = createAuth(apiToken);

const app = express();
// App local: loopback by default; optional NACH_CORS_ORIGINS allowlist. No private-LAN wildcard.
app.use(cors({
  origin: corsOriginAllow,
  credentials: true,
}));
app.use(express.json());

auth.montarRutas(app);
app.use('/api', auth.requireAuth);

// Fragmento SQL fijo del código. No lleva input: los filtros se añaden con `?`.
const CITA_COMPLETA = `
  SELECT c.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono,
         t.nombre AS servicio, t.precio, t.duracion_min,
         (SELECT json_group_array(json_object('paso', paso, 'enviado_at', enviado_at, 'respuesta', respuesta))
            FROM confirmaciones WHERE cita_id = c.id) AS confirmaciones_json,
         (SELECT json_object('id', d.id, 'importe', d.importe, 'estado', d.estado)
            FROM depositos d WHERE d.cita_id = c.id ORDER BY d.id DESC LIMIT 1) AS deposito_json
  FROM citas c
  JOIN clientes cl ON cl.id = c.cliente_id
  JOIN tipos_cita t ON t.id = c.tipo_cita_id
`;

function mapCita(row) {
  if (!row) return null;
  return {
    ...row,
    confirmaciones: JSON.parse(row.confirmaciones_json || '[]'),
    deposito: row.deposito_json ? JSON.parse(row.deposito_json) : null,
    confirmaciones_json: undefined,
    deposito_json: undefined,
  };
}

function getCita(id) {
  return mapCita(db.prepare(`${CITA_COMPLETA} WHERE c.id = ?`).get(id));
}

function hace30dias() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return isoLocal(d);
}

// --- Panel ---

app.get('/api/panel', (req, res) => {
  const desde = hace30dias();
  const hoy = ahora();

  const sum = (tipo) =>
    db.prepare('SELECT COALESCE(SUM(importe),0) AS s, COUNT(*) AS n FROM eventos_asistencia WHERE tipo = ? AND fecha >= ?').get(tipo, desde);

  const noShows = sum('no_show');
  const asistencias = sum('asistio');
  const recuperados = sum('hueco_recuperado');
  const depositosRetenidos = db
    .prepare("SELECT COALESCE(SUM(d.importe),0) AS s FROM depositos d JOIN citas c ON c.id = d.cita_id WHERE d.estado = 'perdido' AND c.estado = 'no_show' AND d.actualizado_at >= ?")
    .get(desde);

  // Pérdida real: precio de las citas plantadas menos los depósitos que se quedaron en caja.
  const perdido = noShows.s - depositosRetenidos.s;
  const finalizadas = asistencias.n + noShows.n;

  const noShowsDetalle = db
    .prepare(
      `SELECT e.fecha, e.importe - COALESCE((SELECT SUM(d.importe) FROM depositos d WHERE d.cita_id = e.cita_id AND d.estado = 'perdido'), 0) AS importe, cl.nombre AS cliente, t.nombre AS servicio
       FROM eventos_asistencia e
       JOIN clientes cl ON cl.id = e.cliente_id
       LEFT JOIN citas c ON c.id = e.cita_id
       LEFT JOIN tipos_cita t ON t.id = c.tipo_cita_id
       WHERE e.tipo = 'no_show' AND e.fecha >= ?
       ORDER BY e.fecha DESC`
    )
    .all(desde);

  const sinConfirmar = db
    .prepare("SELECT COUNT(*) AS n FROM citas WHERE estado = 'pendiente' AND fecha_hora > ?")
    .get(hoy).n;

  const ranking = db
    .prepare('SELECT id, nombre, telefono FROM clientes ORDER BY nombre')
    .all()
    .map((cl) => ({ ...cl, fiabilidad: calcularFiabilidad(cl.id) }))
    .sort((a, b) => a.fiabilidad.score - b.fiabilidad.score);

  res.json({
    perdido_30d: perdido,
    proyeccion_anual: perdido * 12,
    no_shows_30d: noShows.n,
    asistidas_30d: asistencias.n,
    tasa_asistencia: finalizadas ? Math.round((asistencias.n / finalizadas) * 100) : 100,
    huecos_recuperados_30d: recuperados.n,
    importe_recuperado_30d: recuperados.s,
    depositos_retenidos_30d: depositosRetenidos.s,
    proximas_sin_confirmar: sinConfirmar,
    no_shows_detalle: noShowsDetalle,
    ranking,
  });
});

// --- Agenda ---

app.get('/api/agenda', (req, res) => {
  const modo = req.query.modo || 'proximas';
  let rows;
  if (modo === 'historial') {
    rows = db.prepare(`${CITA_COMPLETA} WHERE c.fecha_hora <= ? ORDER BY c.fecha_hora DESC LIMIT 100`).all(ahora());
  } else {
    rows = db.prepare(`${CITA_COMPLETA} WHERE c.fecha_hora > ? ORDER BY c.fecha_hora ASC`).all(ahora());
  }
  res.json(rows.map(mapCita));
});

// --- Clientes ---

app.get('/api/clientes', (req, res) => {
  const rows = db.prepare('SELECT * FROM clientes ORDER BY nombre').all();
  res.json(rows.map((cl) => ({ ...cl, fiabilidad: calcularFiabilidad(cl.id) })));
});

app.post('/api/clientes', (req, res) => {
  const { nombre, telefono, notas } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio' });
  const info = db.prepare('INSERT INTO clientes (nombre, telefono, notas) VALUES (?, ?, ?)').run(nombre.trim(), telefono || null, notas || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

// --- Citas ---

app.post('/api/citas', (req, res) => {
  const { cliente_id, tipo_cita_id, fecha_hora, notas } = req.body;
  if (!cliente_id || !tipo_cita_id || !fecha_hora) {
    return res.status(400).json({ error: 'Faltan cliente, servicio o fecha' });
  }
  const tipo = db.prepare('SELECT * FROM tipos_cita WHERE id = ?').get(tipo_cita_id);
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente_id);
  if (!tipo || !cliente) return res.status(404).json({ error: 'Cliente o servicio no encontrado' });

  const info = db.prepare('INSERT INTO citas (cliente_id, tipo_cita_id, fecha_hora, notas) VALUES (?, ?, ?, ?)').run(
    cliente_id, tipo_cita_id, fecha_hora, notas || null
  );
  const citaId = info.lastInsertRowid;

  // Política de depósito: 'siempre', o 'reincidentes' si el historial del cliente lo pide.
  const fiab = calcularFiabilidad(cliente_id);
  const pideDeposito =
    tipo.importe_deposito > 0 &&
    (tipo.politica_deposito === 'siempre' || (tipo.politica_deposito === 'reincidentes' && fiab.deposito_recomendado));

  if (pideDeposito) {
    const cfg = getConfig();
    db.prepare("INSERT INTO depositos (cita_id, importe, estado) VALUES (?, ?, 'solicitado')").run(citaId, tipo.importe_deposito);
    db.prepare('INSERT INTO mensajes (cliente_id, cita_id, tipo, texto) VALUES (?, ?, ?, ?)').run(
      cliente_id, citaId, 'solicitud_deposito',
      msgSolicitudDeposito({
        cliente: cliente.nombre,
        servicio: tipo.nombre,
        fechaIso: fecha_hora,
        importe: tipo.importe_deposito,
        negocio: cfg.negocio_nombre,
        telefonoNegocio: cfg.negocio_telefono,
      })
    );
  }

  procesarAvisos(); // por si la cita nueva ya cae dentro de la ventana de recordatorio
  res.status(201).json({ cita: getCita(citaId), deposito_solicitado: pideDeposito });
});

// El cliente ha respondido que sí (simulado desde la agenda).
app.post('/api/citas/:id/confirmar', (req, res) => {
  const cita = getCita(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  db.prepare("UPDATE citas SET estado = 'confirmada' WHERE id = ?").run(cita.id);
  db.prepare(
    "UPDATE confirmaciones SET respuesta = 'confirmada', respondido_at = ? WHERE cita_id = ? AND respuesta IS NULL"
  ).run(ahora(), cita.id);
  res.json(getCita(cita.id));
});

app.post('/api/citas/:id/reprogramar', (req, res) => {
  const { fecha_hora } = req.body;
  const cita = getCita(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
  if (!fecha_hora) return res.status(400).json({ error: 'Falta la nueva fecha' });

  // La cita se mueve y la cascada de avisos empieza de cero.
  db.prepare("UPDATE citas SET fecha_hora = ?, estado = 'pendiente' WHERE id = ?").run(fecha_hora, cita.id);
  db.prepare('DELETE FROM confirmaciones WHERE cita_id = ?').run(cita.id);
  db.prepare('INSERT INTO eventos_asistencia (cliente_id, cita_id, tipo, importe, fecha) VALUES (?, ?, ?, 0, ?)').run(
    cita.cliente_id, cita.id, 'reprogramada', ahora()
  );
  procesarAvisos();
  res.json(getCita(cita.id));
});

// Resultado de la cita: asistió o plantón.
app.post('/api/citas/:id/resultado', (req, res) => {
  const { resultado } = req.body; // 'asistida' | 'no_show'
  if (!['asistida', 'no_show'].includes(resultado)) return res.status(400).json({ error: 'Resultado no válido' });
  const cita = getCita(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

  db.prepare('UPDATE citas SET estado = ? WHERE id = ?').run(resultado, cita.id);
  db.prepare('INSERT INTO eventos_asistencia (cliente_id, cita_id, tipo, importe, fecha) VALUES (?, ?, ?, ?, ?)').run(
    cita.cliente_id, cita.id, resultado === 'asistida' ? 'asistio' : 'no_show', cita.precio, ahora()
  );

  // El depósito sigue a la cita: se aplica al precio si vino, se queda en caja si no.
  if (cita.deposito && cita.deposito.estado === 'registrado') {
    const nuevoEstado = resultado === 'asistida' ? 'aplicado' : 'perdido';
    db.prepare('UPDATE depositos SET estado = ?, actualizado_at = ? WHERE id = ?').run(nuevoEstado, ahora(), cita.deposito.id);
  }
  res.json(getCita(cita.id));
});

// Cancelación: registra el evento y dispara la cadena de ofertas a la lista de espera.
app.post('/api/citas/:id/cancelar', (req, res) => {
  const cita = getCita(req.params.id);
  if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

  const tardia = horasHasta(cita.fecha_hora) < 24;
  db.prepare("UPDATE citas SET estado = 'cancelada' WHERE id = ?").run(cita.id);
  db.prepare('INSERT INTO eventos_asistencia (cliente_id, cita_id, tipo, importe, fecha) VALUES (?, ?, ?, ?, ?)').run(
    cita.cliente_id, cita.id, tardia ? 'cancelacion_tardia' : 'cancelacion_ok', cita.precio, ahora()
  );

  if (cita.deposito && cita.deposito.estado === 'registrado') {
    // Con aviso suficiente el depósito se devuelve; tardía, se queda en caja.
    db.prepare('UPDATE depositos SET estado = ?, actualizado_at = ? WHERE id = ?').run(
      tardia ? 'perdido' : 'devuelto', ahora(), cita.deposito.id
    );
  }

  // Solo ofrecemos huecos con margen: cancelaciones en el pasado no rellenan nada.
  const ofertas = horasHasta(cita.fecha_hora) > 0 ? ofrecerHueco(cita) : [];
  res.json({ cita: getCita(cita.id), tardia, ofertas });
});

// --- Depósitos ---

app.post('/api/depositos/:id/registrar', (req, res) => {
  const dep = db.prepare('SELECT * FROM depositos WHERE id = ?').get(req.params.id);
  if (!dep) return res.status(404).json({ error: 'Depósito no encontrado' });
  db.prepare("UPDATE depositos SET estado = 'registrado', actualizado_at = ? WHERE id = ?").run(ahora(), dep.id);
  // Un depósito pagado equivale a confirmar: nadie deja una señal para no venir.
  db.prepare("UPDATE citas SET estado = 'confirmada' WHERE id = ? AND estado = 'pendiente'").run(dep.cita_id);
  res.json(getCita(dep.cita_id));
});

// --- Motor de avisos ---

app.post('/api/motor/procesar', (req, res) => {
  res.json(procesarAvisos());
});

// --- Mensajes (bandeja de salida simulada) ---

app.get('/api/mensajes', (req, res) => {
  const rows = db
    .prepare(
      `SELECT m.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono
       FROM mensajes m
       LEFT JOIN clientes cl ON cl.id = m.cliente_id
       ORDER BY CASE m.estado WHEN 'pendiente' THEN 0 ELSE 1 END, m.created_at DESC
       LIMIT 200`
    )
    .all();
  res.json(rows);
});

app.post('/api/mensajes/:id/enviado', (req, res) => {
  db.prepare("UPDATE mensajes SET estado = 'enviado' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// Alguien de la lista de espera acepta un hueco ofrecido: se crea su cita en ese
// hueco, se registra la recuperación y las demás ofertas del mismo hueco caducan.
app.post('/api/mensajes/:id/aceptar-hueco', (req, res) => {
  const msg = db.prepare("SELECT * FROM mensajes WHERE id = ? AND tipo = 'oferta_hueco'").get(req.params.id);
  if (!msg) return res.status(404).json({ error: 'Oferta no encontrada' });
  const citaOriginal = getCita(msg.cita_id);
  if (!citaOriginal) return res.status(404).json({ error: 'La cita del hueco ya no existe' });

  const tx = db.transaction(() => {
    const info = db
      .prepare("INSERT INTO citas (cliente_id, tipo_cita_id, fecha_hora, estado, notas) VALUES (?, ?, ?, 'confirmada', 'Hueco recuperado desde lista de espera')")
      .run(msg.cliente_id, citaOriginal.tipo_cita_id, citaOriginal.fecha_hora);
    db.prepare('INSERT INTO eventos_asistencia (cliente_id, cita_id, tipo, importe, fecha) VALUES (?, ?, ?, ?, ?)').run(
      msg.cliente_id, info.lastInsertRowid, 'hueco_recuperado', citaOriginal.precio, ahora()
    );
    db.prepare('UPDATE lista_espera SET activo = 0 WHERE cliente_id = ? AND activo = 1').run(msg.cliente_id);
    db.prepare("UPDATE mensajes SET estado = 'enviado' WHERE id = ?").run(msg.id);
    db.prepare("UPDATE mensajes SET estado = 'caducado' WHERE cita_id = ? AND tipo = 'oferta_hueco' AND id != ? AND estado = 'pendiente'").run(msg.cita_id, msg.id);
    return info.lastInsertRowid;
  });
  const nuevaCitaId = tx();
  res.json({ cita: getCita(nuevaCitaId), importe_recuperado: citaOriginal.precio });
});

// --- Lista de espera ---

app.get('/api/lista-espera', (req, res) => {
  const rows = db
    .prepare(
      `SELECT le.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono, t.nombre AS servicio
       FROM lista_espera le
       JOIN clientes cl ON cl.id = le.cliente_id
       LEFT JOIN tipos_cita t ON t.id = le.tipo_cita_id
       WHERE le.activo = 1
       ORDER BY le.created_at ASC`
    )
    .all()
    .map((r) => ({ ...r, fiabilidad: calcularFiabilidad(r.cliente_id) }));
  res.json(rows);
});

app.post('/api/lista-espera', (req, res) => {
  const { cliente_id, tipo_cita_id, preferencia } = req.body;
  if (!cliente_id) return res.status(400).json({ error: 'Falta el cliente' });
  const info = db.prepare('INSERT INTO lista_espera (cliente_id, tipo_cita_id, preferencia) VALUES (?, ?, ?)').run(
    cliente_id, tipo_cita_id || null, preferencia || null
  );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.delete('/api/lista-espera/:id', (req, res) => {
  db.prepare('UPDATE lista_espera SET activo = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// --- Configuración y tipos de cita ---

app.get('/api/config', (req, res) => res.json(getConfig()));

app.put('/api/config', (req, res) => {
  setConfig(req.body || {});
  res.json(getConfig());
});

// Borra el trabajo del negocio (clientes, citas y todo lo que cuelga de ellos)
// y vacía nombre/teléfono. No toca tipos_cita: la pantalla de ajustes edita
// los servicios que ya hay, pero no permite crear el catálogo desde cero.
// No vuelve a sembrar la demo. Exige la palabra BORRAR.
app.post('/api/config/restablecer', (req, res) => {
  if (req.body?.confirmar !== 'BORRAR') {
    return res.status(400).json({ error: 'Confirmación requerida' });
  }
  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM mensajes;
      DELETE FROM confirmaciones;
      DELETE FROM depositos;
      DELETE FROM eventos_asistencia;
      DELETE FROM lista_espera;
      DELETE FROM citas;
      DELETE FROM clientes;
    `);
    const vaciar = db.prepare(
      'INSERT INTO config (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor'
    );
    vaciar.run('negocio_nombre', '');
    vaciar.run('negocio_telefono', '');
    vaciar.run('auto_seed', '0');
  });
  tx();
  res.json({ ok: true });
});

app.get('/api/tipos-cita', (req, res) => {
  res.json(db.prepare('SELECT * FROM tipos_cita WHERE activo = 1 ORDER BY id').all());
});

app.put('/api/tipos-cita/:id', (req, res) => {
  const { nombre, duracion_min, precio, politica_deposito, importe_deposito } = req.body;
  const tipo = db.prepare('SELECT * FROM tipos_cita WHERE id = ?').get(req.params.id);
  if (!tipo) return res.status(404).json({ error: 'Servicio no encontrado' });
  db.prepare(
    'UPDATE tipos_cita SET nombre = ?, duracion_min = ?, precio = ?, politica_deposito = ?, importe_deposito = ? WHERE id = ?'
  ).run(
    nombre ?? tipo.nombre,
    duracion_min ?? tipo.duracion_min,
    precio ?? tipo.precio,
    politica_deposito ?? tipo.politica_deposito,
    importe_deposito ?? tipo.importe_deposito,
    tipo.id
  );
  res.json(db.prepare('SELECT * FROM tipos_cita WHERE id = ?').get(tipo.id));
});

// Recarga la demo a mano (autenticado). Empezar de cero no pasa por aquí.
app.post('/api/demo/reset', (req, res) => {
  seed();
  const generados = procesarAvisos();
  res.json({ ok: true, avisos_generados: generados });
});

const PORT = process.env.PORT || 4000;
const HOST = bindHost();
app.listen(PORT, HOST, () => {
  console.log(`No-Show Cero · API escuchando en http://${HOST}:${PORT}`);
});
