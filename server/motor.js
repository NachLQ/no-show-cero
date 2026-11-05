// motor.js
// Motor de avisos (cascada de confirmación) y lista de espera.
// Sin cron: se ejecuta al arrancar el servidor y desde el botón "Procesar avisos".
// Es idempotente: cada paso de la cascada se genera una sola vez por cita.

import db, { getConfig, ahora, horasHasta } from './db.js';
import { calcularFiabilidad, resumenFiabilidad } from './fiabilidad.js';
import {
  msgRecordatorio48h,
  msgAviso24h,
  msgAlertaNegocio,
  msgOfertaHueco,
} from './mensajes.js';

function citaConDatos(citaId) {
  return db
    .prepare(
      `SELECT c.*, cl.nombre AS cliente_nombre, cl.telefono AS cliente_telefono,
              t.nombre AS servicio, t.precio, t.duracion_min
       FROM citas c
       JOIN clientes cl ON cl.id = c.cliente_id
       JOIN tipos_cita t ON t.id = c.tipo_cita_id
       WHERE c.id = ?`
    )
    .get(citaId);
}

function tienePaso(citaId, paso) {
  return !!db.prepare('SELECT 1 FROM confirmaciones WHERE cita_id = ? AND paso = ?').get(citaId, paso);
}

function crearMensaje({ clienteId, citaId, tipo, texto }) {
  db.prepare('INSERT INTO mensajes (cliente_id, cita_id, tipo, texto) VALUES (?, ?, ?, ?)').run(
    clienteId, citaId, tipo, texto
  );
}

// Recorre las citas futuras sin confirmar y genera los pasos de la cascada que toquen.
// Devuelve un resumen de lo generado para mostrarlo en la interfaz.
export function procesarAvisos() {
  const cfg = getConfig();
  const hRecordatorio = Number(cfg.horas_recordatorio);
  const hSegundo = Number(cfg.horas_segundo_aviso);
  const hAlerta = Number(cfg.horas_alerta);

  const pendientes = db
    .prepare(`SELECT id FROM citas WHERE estado = 'pendiente' AND fecha_hora > ?`)
    .all(ahora());

  const generados = { recordatorio_48h: 0, aviso_24h: 0, alerta_negocio: 0 };

  for (const { id } of pendientes) {
    const cita = citaConDatos(id);
    const horas = horasHasta(cita.fecha_hora);
    const base = {
      cliente: cita.cliente_nombre,
      servicio: cita.servicio,
      fechaIso: cita.fecha_hora,
      negocio: cfg.negocio_nombre,
    };

    if (horas <= hRecordatorio && !tienePaso(id, 'recordatorio_48h')) {
      db.prepare('INSERT INTO confirmaciones (cita_id, paso, enviado_at) VALUES (?, ?, ?)').run(id, 'recordatorio_48h', ahora());
      crearMensaje({ clienteId: cita.cliente_id, citaId: id, tipo: 'recordatorio_48h', texto: msgRecordatorio48h(base) });
      generados.recordatorio_48h++;
      continue; // un paso por pasada: la cascada avanza en el orden correcto
    }

    if (horas <= hSegundo && tienePaso(id, 'recordatorio_48h') && !tienePaso(id, 'aviso_24h')) {
      db.prepare('INSERT INTO confirmaciones (cita_id, paso, enviado_at) VALUES (?, ?, ?)').run(id, 'aviso_24h', ahora());
      crearMensaje({ clienteId: cita.cliente_id, citaId: id, tipo: 'aviso_24h', texto: msgAviso24h(base) });
      generados.aviso_24h++;
      continue;
    }

    if (horas <= hAlerta && tienePaso(id, 'aviso_24h') && !tienePaso(id, 'alerta_negocio')) {
      const fiab = calcularFiabilidad(cita.cliente_id);
      const enEspera = db.prepare('SELECT COUNT(*) AS n FROM lista_espera WHERE activo = 1').get().n;
      db.prepare('INSERT INTO confirmaciones (cita_id, paso, enviado_at) VALUES (?, ?, ?)').run(id, 'alerta_negocio', ahora());
      crearMensaje({
        clienteId: cita.cliente_id,
        citaId: id,
        tipo: 'alerta_negocio',
        texto: msgAlertaNegocio({ ...base, precio: cita.precio, resumenFiabilidad: resumenFiabilidad(fiab), enEspera }),
      });
      generados.alerta_negocio++;
    }
  }

  return generados;
}

// Al cancelarse una cita, ofrece el hueco a la lista de espera por orden:
// primero quien encaja en el tipo de servicio, dentro de eso por fiabilidad
// (mejor cliente primero) y antigüedad en la lista. Genera hasta N ofertas.
export function ofrecerHueco(citaCancelada) {
  const cfg = getConfig();
  const maxOfertas = Number(cfg.ofertas_por_hueco);

  const candidatos = db
    .prepare(
      `SELECT le.id AS espera_id, le.cliente_id, le.tipo_cita_id, le.created_at,
              cl.nombre, cl.telefono
       FROM lista_espera le
       JOIN clientes cl ON cl.id = le.cliente_id
       WHERE le.activo = 1
         AND (le.tipo_cita_id IS NULL OR le.tipo_cita_id = ?)
         AND le.cliente_id != ?`
    )
    .all(citaCancelada.tipo_cita_id, citaCancelada.cliente_id)
    .map((c) => ({ ...c, fiabilidad: calcularFiabilidad(c.cliente_id) }))
    .sort((a, b) => b.fiabilidad.score - a.fiabilidad.score || a.created_at.localeCompare(b.created_at))
    .slice(0, maxOfertas);

  const ofertas = [];
  for (const c of candidatos) {
    const texto = msgOfertaHueco({
      cliente: c.nombre,
      servicio: citaCancelada.servicio,
      fechaIso: citaCancelada.fecha_hora,
      negocio: cfg.negocio_nombre,
    });
    const info = db
      .prepare('INSERT INTO mensajes (cliente_id, cita_id, tipo, texto) VALUES (?, ?, ?, ?)')
      .run(c.cliente_id, citaCancelada.id, 'oferta_hueco', texto);
    ofertas.push({ mensaje_id: info.lastInsertRowid, cliente: c.nombre, score: c.fiabilidad.score });
  }
  return ofertas;
}
