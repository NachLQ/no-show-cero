// seed.js
// Datos demo: peluquería "Sala Bruna", 1 mes de historial con patrones de no-show
// realistas y citas próximas en cada estado de la cascada de confirmación.
//
// MATEMÁTICA DEL PANEL, CALCULADA A MANO (no cambiar sin recalcular):
//   No-shows de los últimos 30 días:
//     Vanesa  · Color y mechas ....... 60 €
//     Vanesa  · Color y mechas ....... 60 €
//     Iván    · Corte ................ 25 €
//     Iván    · Tratamiento keratina . 45 €
//     Lorena  · Tratamiento keratina . 45 €
//     Raquel  · Corte ................ 25 €
//     TOTAL PERDIDO .................. 260 €   (proyección anual: 260 × 12 = 3.120 €)
//   Asistencias últimos 30 días: 34 · Tasa de asistencia: 34 / (34 + 6) = 85 %
//   Huecos recuperados por lista de espera: 2 (60 € + 45 € = 105 € recuperados)
//
// El seed es 100 % determinista (sin aleatoriedad): el panel siempre cuadra.

import { pathToFileURL } from 'url';
import db, { initSchema, setConfig, isoLocal } from './db.js';
import { msgSolicitudDeposito } from './mensajes.js';

initSchema();

// Fecha relativa a hoy: rel(-3, 17) = hace 3 días a las 17:00.
function rel(dias, hora, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setHours(hora, min, 0, 0);
  return isoLocal(d);
}

// Fecha relativa en horas desde ahora, redondeada a la media hora, para que las
// citas próximas caigan siempre en la ventana de cascada correcta arranques cuando arranques.
function relH(horas) {
  const d = new Date(Date.now() + horas * 3600000);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  return isoLocal(d);
}

// Como relH pero ajustada al horario del salón (10-19 h) para que la demo no muestre
// citas de madrugada. Mueve la hora como mucho ±10 h: solo se usa en citas cuya
// ventana de cascada tiene holgura suficiente (ver cada llamada).
function relHLaboral(horas) {
  const d = new Date(Date.now() + horas * 3600000);
  d.setMinutes(d.getMinutes() < 30 ? 0 : 30, 0, 0);
  if (d.getHours() < 10) d.setHours(10, 0, 0, 0);
  if (d.getHours() > 19) d.setHours(19, 0, 0, 0);
  return isoLocal(d);
}

export function seed() {
  // Lista fija del código (no viene de input). Orden: hijas antes que padres por las FK.
  const limpiar = db.transaction(() => {
    db.exec(`
      DELETE FROM mensajes;
      DELETE FROM confirmaciones;
      DELETE FROM depositos;
      DELETE FROM eventos_asistencia;
      DELETE FROM lista_espera;
      DELETE FROM citas;
      DELETE FROM clientes;
      DELETE FROM tipos_cita;
      DELETE FROM config;
    `);
  });
  limpiar();

  setConfig({
    negocio_nombre: 'Sala Bruna',
    negocio_telefono: '600 111 222',
    horas_recordatorio: 48,
    horas_segundo_aviso: 24,
    horas_alerta: 12,
    umbral_reincidente: 2,
    ofertas_por_hueco: 3,
  });

  const insTipo = db.prepare(
    'INSERT INTO tipos_cita (nombre, duracion_min, precio, politica_deposito, importe_deposito) VALUES (?, ?, ?, ?, ?)'
  );
  const T = {}; // nombre → id
  T.corte = insTipo.run('Corte', 30, 25, 'ninguno', 0).lastInsertRowid;
  T.color = insTipo.run('Color y mechas', 90, 60, 'reincidentes', 20).lastInsertRowid;
  T.keratina = insTipo.run('Tratamiento keratina', 60, 45, 'reincidentes', 15).lastInsertRowid;
  T.peinado = insTipo.run('Peinado evento', 45, 35, 'siempre', 10).lastInsertRowid;

  const insCliente = db.prepare('INSERT INTO clientes (nombre, telefono, notas) VALUES (?, ?, ?)');
  const C = {};
  C.marta = insCliente.run('Marta Ríos', '34600111001', 'Clienta de siempre, viene cada 3 semanas').lastInsertRowid;
  C.vanesa = insCliente.run('Vanesa Ortiz', '34600111002', 'Dos plantones seguidos este mes').lastInsertRowid;
  C.ivan = insCliente.run('Iván Castro', '34600111003', 'Confirma y luego no aparece').lastInsertRowid;
  C.lorena = insCliente.run('Lorena Gil', '34600111004', null).lastInsertRowid;
  C.raquel = insCliente.run('Raquel Peña', '34600111005', 'Cambia de hora a menudo').lastInsertRowid;
  C.carmen = insCliente.run('Carmen Vidal', '34600111006', null).lastInsertRowid;
  C.sonia = insCliente.run('Sonia Delgado', '34600111007', 'Quiere hueco antes si sale algo').lastInsertRowid;
  C.paula = insCliente.run('Paula Moreno', '34600111008', null).lastInsertRowid;
  C.nuria = insCliente.run('Nuria Salas', '34600111009', 'Clienta nueva, vino recomendada').lastInsertRowid;
  C.alberto = insCliente.run('Alberto Cano', '34600111010', null).lastInsertRowid;

  const insCita = db.prepare('INSERT INTO citas (cliente_id, tipo_cita_id, fecha_hora, estado, notas) VALUES (?, ?, ?, ?, ?)');
  const insEvento = db.prepare('INSERT INTO eventos_asistencia (cliente_id, cita_id, tipo, importe, fecha) VALUES (?, ?, ?, ?, ?)');
  const insConf = db.prepare('INSERT INTO confirmaciones (cita_id, paso, enviado_at, respuesta, respondido_at) VALUES (?, ?, ?, ?, ?)');
  const insMsg = db.prepare("INSERT INTO mensajes (cliente_id, cita_id, tipo, texto, estado, created_at) VALUES (?, ?, ?, ?, 'enviado', ?)");

  const precios = { [T.corte]: 25, [T.color]: 60, [T.keratina]: 45, [T.peinado]: 35 };

  function citaPasada(clienteId, tipoId, dias, hora, resultado) {
    const fecha = rel(dias, hora);
    const estado = resultado === 'asistio' ? 'asistida' : resultado === 'no_show' ? 'no_show' : 'cancelada';
    const citaId = insCita.run(clienteId, tipoId, fecha, estado, null).lastInsertRowid;
    insEvento.run(clienteId, citaId, resultado, precios[tipoId], fecha);
    return citaId;
  }

  // --- 34 asistencias en los últimos 30 días (repartidas de forma fija) ---
  const asistidas = [
    [C.marta, T.color, -28, 10], [C.marta, T.corte, -21, 17], [C.marta, T.corte, -14, 11],
    [C.marta, T.keratina, -9, 16], [C.marta, T.corte, -5, 10], [C.marta, T.peinado, -2, 18],
    [C.carmen, T.corte, -27, 12], [C.carmen, T.color, -20, 10], [C.carmen, T.corte, -13, 17],
    [C.carmen, T.corte, -7, 11], [C.carmen, T.keratina, -3, 12],
    [C.alberto, T.corte, -26, 18], [C.alberto, T.corte, -19, 18], [C.alberto, T.corte, -12, 18],
    [C.alberto, T.corte, -6, 18], [C.alberto, T.corte, -1, 18],
    [C.sonia, T.color, -25, 10], [C.sonia, T.corte, -17, 12], [C.sonia, T.corte, -10, 16], [C.sonia, T.peinado, -4, 19],
    [C.paula, T.keratina, -24, 11], [C.paula, T.corte, -16, 10], [C.paula, T.corte, -8, 13], [C.paula, T.color, -2, 10],
    [C.nuria, T.corte, -15, 12], [C.nuria, T.corte, -4, 12],
    [C.lorena, T.corte, -23, 16], [C.lorena, T.color, -11, 10], [C.lorena, T.corte, -3, 16],
    [C.raquel, T.corte, -22, 13], [C.raquel, T.peinado, -13, 19], [C.raquel, T.corte, -6, 13],
    [C.vanesa, T.corte, -29, 11],
    [C.ivan, T.corte, -25, 17],
  ];
  for (const [cli, tipo, d, h] of asistidas) citaPasada(cli, tipo, d, h, 'asistio');

  // --- 6 no-shows = 260 € (ver matemática arriba) ---
  citaPasada(C.vanesa, T.color, -18, 10, 'no_show');   // 60 €
  citaPasada(C.vanesa, T.color, -7, 10, 'no_show');    // 60 €
  citaPasada(C.ivan, T.corte, -16, 17, 'no_show');     // 25 €
  citaPasada(C.ivan, T.keratina, -5, 16, 'no_show');   // 45 €
  citaPasada(C.lorena, T.keratina, -19, 11, 'no_show');// 45 €
  citaPasada(C.raquel, T.corte, -12, 13, 'no_show');   // 25 €

  // --- Cancelaciones: 2 con aviso (huecos recuperados) y 1 tardía ---
  const canc1 = citaPasada(C.paula, T.color, -10, 10, 'cancelacion_ok');
  const canc2 = citaPasada(C.sonia, T.keratina, -4, 16, 'cancelacion_ok');
  citaPasada(C.raquel, T.color, -8, 10, 'cancelacion_tardia');

  // Los dos huecos cancelados se rellenaron desde la lista de espera: 105 € recuperados.
  insEvento.run(C.nuria, canc1, 'hueco_recuperado', 60, rel(-10, 10));
  insEvento.run(C.marta, canc2, 'hueco_recuperado', 45, rel(-4, 16));

  // --- Citas próximas: una por cada estado de la cascada ---

  // Fuera de la ventana de 48 h: aún sin avisos. (holgura: 60 ± 10 h sigue siendo > 48)
  insCita.run(C.carmen, T.color, relHLaboral(60), 'pendiente', null);

  // Dentro de 48 h, sin recordatorio todavía → el motor generará el M1 al arrancar.
  // (holgura: 36 ± 10 h sigue dentro de la ventana 24-48)
  insCita.run(C.marta, T.corte, relHLaboral(36), 'pendiente', null);

  // Recordatorio enviado hace más de un día, sin respuesta → el motor generará el M2.
  const citaLorena = insCita.run(C.lorena, T.keratina, relH(20), 'pendiente', null).lastInsertRowid;
  insConf.run(citaLorena, 'recordatorio_48h', relH(-28), null, null);
  insMsg.run(C.lorena, citaLorena, 'recordatorio_48h', '(enviado ayer) Recordatorio de cita: tratamiento keratina.', relH(-28));

  // Dos avisos enviados, sigue sin confirmar y quedan pocas horas → el motor generará la alerta interna.
  const citaIvan = insCita.run(C.ivan, T.corte, relH(6), 'pendiente', null).lastInsertRowid;
  insConf.run(citaIvan, 'recordatorio_48h', relH(-42), null, null);
  insConf.run(citaIvan, 'aviso_24h', relH(-18), null, null);
  insMsg.run(C.ivan, citaIvan, 'recordatorio_48h', '(enviado hace 2 días) Recordatorio de cita: corte.', relH(-42));
  insMsg.run(C.ivan, citaIvan, 'aviso_24h', '(enviado ayer) Segundo aviso: corte sin confirmar.', relH(-18));

  // Confirmada: Alberto respondió al recordatorio.
  const citaAlberto = insCita.run(C.alberto, T.corte, relHLaboral(30), 'confirmada', null).lastInsertRowid;
  insConf.run(citaAlberto, 'recordatorio_48h', relH(-20), 'confirmada', relH(-19));

  // Vanesa es reincidente (2 plantones): cita nueva con depósito solicitado.
  // A más de 48 h: su vía de confirmación es el depósito, no el recordatorio.
  const fechaVanesa = relHLaboral(58); // holgura: 58 − 10 h sigue siendo > 48, sin recordatorio antes de la señal
  const citaVanesa = insCita.run(C.vanesa, T.color, fechaVanesa, 'pendiente', 'Depósito solicitado por historial').lastInsertRowid;
  db.prepare("INSERT INTO depositos (cita_id, importe, estado) VALUES (?, ?, 'solicitado')").run(citaVanesa, 20);
  db.prepare("INSERT INTO mensajes (cliente_id, cita_id, tipo, texto, estado) VALUES (?, ?, 'solicitud_deposito', ?, 'pendiente')").run(
    C.vanesa, citaVanesa,
    msgSolicitudDeposito({
      cliente: 'Vanesa Ortiz', servicio: 'Color y mechas', fechaIso: fechaVanesa,
      importe: 20, negocio: 'Sala Bruna', telefonoNegocio: '600 111 222',
    })
  );

  // Cita para cancelar en la demo: al cancelarla se dispara la cadena de lista de espera.
  insCita.run(C.raquel, T.color, relHLaboral(72), 'pendiente', 'Cancélala en la demo para ver la lista de espera');

  // --- Lista de espera: 3 personas quieren hueco antes ---
  const insEspera = db.prepare('INSERT INTO lista_espera (cliente_id, tipo_cita_id, preferencia, created_at) VALUES (?, ?, ?, ?)');
  insEspera.run(C.sonia, T.color, 'Mañanas entre semana', rel(-9, 12));
  insEspera.run(C.paula, null, 'Cualquier servicio, cuanto antes', rel(-6, 12));
  insEspera.run(C.nuria, null, 'Tardes a partir de las 17:00', rel(-3, 12));

  console.log('Seed completado: Sala Bruna · 260 € perdidos en 30 días · 34 asistencias · 6 no-shows · 2 huecos recuperados.');
}

// Ejecutable directo: npm run seed
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed();
}
