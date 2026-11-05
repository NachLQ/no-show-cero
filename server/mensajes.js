// mensajes.js
// Copy de los 5 mensajes del sistema. Todo el texto que ve el cliente final sale de aquí.
// Envío simulado: los mensajes se guardan en la bandeja (tabla mensajes) y el cliente web
// los abre en WhatsApp con un enlace wa.me con el texto precargado.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fechaBonita(iso) {
  const d = new Date(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function horaBonita(iso) {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function eur(n) {
  return `${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

// M1 — Recordatorio a 48 h, con confirmar / reprogramar.
export function msgRecordatorio48h({ cliente, servicio, fechaIso, negocio }) {
  return (
    `Hola ${cliente} 👋 Te esperamos el ${fechaBonita(fechaIso)} a las ${horaBonita(fechaIso)} ` +
    `para tu ${servicio} en ${negocio}.\n\n` +
    `¿Me confirmas que vienes?\n` +
    `✅ Responde SÍ y te guardo el hueco\n` +
    `🔄 Responde CAMBIO si te viene mejor otra hora\n\n` +
    `Si no puedes venir, dímelo con tiempo y le damos tu hueco a alguien que lo está esperando. ¡Gracias!`
  );
}

// M2 — Segundo aviso a 24 h si no ha confirmado.
export function msgAviso24h({ cliente, servicio, fechaIso, negocio }) {
  return (
    `Hola ${cliente}, soy de ${negocio} 🙂 Mañana a las ${horaBonita(fechaIso)} tienes tu ${servicio} ` +
    `y todavía no me has confirmado.\n\n` +
    `Tengo lista de espera para ese hueco, así que si no me dices nada hoy tendré que ofrecérselo a otra persona. ` +
    `Un SÍ y es tuyo. 🙌`
  );
}

// M3 — Alerta interna al negocio: sigue sin confirmar tras los dos avisos.
export function msgAlertaNegocio({ cliente, servicio, fechaIso, precio, resumenFiabilidad, enEspera }) {
  return (
    `⚠️ AVISO INTERNO — ${cliente} sigue sin confirmar su ${servicio} del ${fechaBonita(fechaIso)} ` +
    `a las ${horaBonita(fechaIso)} (${eur(precio)}).\n\n` +
    `Historial: ${resumenFiabilidad}.\n` +
    `Sugerencia: llámale directamente o cancela la cita para ofrecer el hueco a la lista de espera` +
    (enEspera > 0 ? ` (${enEspera} persona${enEspera === 1 ? '' : 's'} interesada${enEspera === 1 ? '' : 's'})` : '') +
    `.`
  );
}

// M4 — Solicitud de depósito con texto legal-comercial sin fricción.
export function msgSolicitudDeposito({ cliente, servicio, fechaIso, importe, negocio, telefonoNegocio }) {
  return (
    `Hola ${cliente} 😊 Para dejarte reservado el ${servicio} del ${fechaBonita(fechaIso)} a las ` +
    `${horaBonita(fechaIso)} necesito una señal de ${eur(importe)}.\n\n` +
    `Funciona así, muy fácil:\n` +
    `• La señal se descuenta entera del precio el día de la cita.\n` +
    `• Si avisas con más de 24 h, se devuelve o se guarda para otra fecha.\n` +
    `• Solo se pierde si no vienes sin avisar.\n\n` +
    `Así protegemos la agenda y a los clientes que están esperando hueco.` +
    (telefonoNegocio ? ` Puedes hacer Bizum al ${telefonoNegocio}.` : '') +
    ` En cuanto llegue, tu cita queda confirmada. ¡Gracias por entenderlo! 💜`
  );
}

// M5 — Oferta de hueco libre a la lista de espera.
export function msgOfertaHueco({ cliente, servicio, fechaIso, negocio }) {
  return (
    `¡Buenas noticias, ${cliente}! 🎉 Se ha quedado libre un hueco el ${fechaBonita(fechaIso)} ` +
    `a las ${horaBonita(fechaIso)} para ${servicio} en ${negocio}.\n\n` +
    `Me dijiste que querías cita cuanto antes: es tuyo si lo quieres. ` +
    `Responde SÍ en las próximas 2 horas y te lo guardo. Si no, pasará a la siguiente persona de la lista.`
  );
}
