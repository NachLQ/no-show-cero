// ui.js — helpers de formato compartidos por todas las pantallas.

export function eur(n) {
  return `${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  const mismodia = (a, b) => a.toDateString() === b.toDateString();
  const hora = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (mismodia(d, hoy)) return `Hoy · ${hora}`;
  if (mismodia(d, manana)) return `Mañana · ${hora}`;
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} · ${hora}`;
}

export function waLink(telefono, texto) {
  if (!telefono) return null;
  const tel = String(telefono).replace(/\D/g, '');
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}

// Estado de cita → etiqueta y color del chip.
// Los fondos semánticos claros se conservan; en oscuro se añade el par -950/30 + texto -300.
export const ESTADOS_CITA = {
  pendiente: { label: 'Sin confirmar', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' },
  confirmada: { label: 'Confirmada', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' },
  asistida: { label: 'Asistió', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' },
  no_show: { label: 'Plantón', clase: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300' },
  cancelada: { label: 'Cancelada', clase: 'bg-paper-card text-paper-muted dark:bg-ink-card dark:text-ink-muted' },
};

export const NIVELES_FIABILIDAD = {
  fiable: { label: 'Fiable', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300', punto: 'bg-emerald-500' },
  atencion: { label: 'Atención', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300', punto: 'bg-amber-500' },
  reincidente: { label: 'Reincidente', clase: 'bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-300', punto: 'bg-rose-500' },
};

export const cls = {
  card: "vach-card rounded-xl border border-paper-card bg-paper-surface p-3  dark:border-ink-card dark:bg-ink-surface",
  muted: 'text-sm text-paper-muted dark:text-ink-muted',
  dim: 'text-paper-dim dark:text-ink-dim',
  error: 'rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-300',
  aviso: 'rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-300',
  ok: 'rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300',
  btn: 'rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40',
  btnLg: 'w-full rounded-xl bg-marca-600 py-3 font-bold text-white disabled:opacity-40',
  btnSec: 'rounded-lg bg-paper-card px-3 py-1.5 text-xs font-bold text-paper-text disabled:opacity-40 dark:bg-ink-card dark:text-ink-text',
  label: 'text-xs font-semibold uppercase tracking-wide text-paper-muted dark:text-ink-muted',
};

export const TIPOS_MENSAJE = {
  recordatorio_48h: { label: 'Recordatorio 48 h', icono: "" },
  aviso_24h: { label: 'Segundo aviso 24 h', icono: "" },
  alerta_negocio: { label: 'Alerta interna', icono: "" },
  solicitud_deposito: { label: 'Solicitud de señal', icono: "" },
  oferta_hueco: { label: 'Oferta de hueco', icono: "" },
};
