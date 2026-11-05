// fiabilidad.js
// Score de fiabilidad por cliente a partir de su historial de asistencia.
// Fórmula (documentada en el README): se parte de 100 y cada evento de los
// últimos 6 meses ajusta: no-show -30, cancelación tardía (<24 h) -10,
// asistencia +5 (recupera puntos, con tope 100). Mínimo 0.
// Clasificación: >=80 fiable · 50-79 atención · <50 o >= umbral de no-shows reincidente.

import db, { getConfig, isoLocal } from './db.js';

export function calcularFiabilidad(clienteId) {
  const desde = new Date();
  desde.setMonth(desde.getMonth() - 6);
  const eventos = db
    .prepare(
      `SELECT tipo FROM eventos_asistencia
       WHERE cliente_id = ? AND fecha >= ? AND tipo IN ('asistio','no_show','cancelacion_tardia')
       ORDER BY fecha ASC`
    )
    .all(clienteId, isoLocal(desde));

  let score = 100;
  let noShows = 0;
  let tardias = 0;
  let asistencias = 0;
  for (const e of eventos) {
    if (e.tipo === 'no_show') { score -= 30; noShows++; }
    else if (e.tipo === 'cancelacion_tardia') { score -= 10; tardias++; }
    else { score = Math.min(100, score + 5); asistencias++; }
  }
  score = Math.max(0, Math.round(score));

  const umbral = Number(getConfig().umbral_reincidente);
  let nivel = 'fiable';
  if (noShows >= umbral || score < 50) nivel = 'reincidente';
  else if (score < 80 || noShows > 0) nivel = 'atencion';

  return {
    score,
    nivel,
    no_shows: noShows,
    cancelaciones_tardias: tardias,
    asistencias,
    deposito_recomendado: nivel === 'reincidente',
  };
}

export function resumenFiabilidad(f) {
  const partes = [];
  partes.push(`${f.asistencias} asistencia${f.asistencias === 1 ? '' : 's'}`);
  if (f.no_shows) partes.push(`${f.no_shows} plantón${f.no_shows === 1 ? '' : 'es'}`);
  if (f.cancelaciones_tardias) partes.push(`${f.cancelaciones_tardias} cancelación${f.cancelaciones_tardias === 1 ? '' : 'es'} tardía${f.cancelaciones_tardias === 1 ? '' : 's'}`);
  return `${partes.join(', ')} en 6 meses (score ${f.score}/100)`;
}
