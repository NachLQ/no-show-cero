// api.js — cliente de la API REST. Pide el token en loopback y lo manda como Bearer.

const BASE = '/api';

let cachedToken = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nach_api')) || '';

async function ensureToken() {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch(BASE + '/auth/bootstrap', { credentials: 'include' });
    if (!res.ok) return '';
    const data = await res.json();
    if (data.token) {
      cachedToken = data.token;
      try { sessionStorage.setItem('nach_api', cachedToken); } catch { /* modo privado */ }
    }
  } catch { /* sin servidor: el req de abajo mostrará el error */ }
  return cachedToken;
}

async function req(url, options = {}) {
  const token = await ensureToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers, credentials: 'include' });
  let data;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text }; }
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
}

export const api = {
  panel: () => req('/api/panel'),
  agenda: (modo = 'proximas') => req(`/api/agenda?modo=${modo}`),
  clientes: () => req('/api/clientes'),
  crearCliente: (body) => req('/api/clientes', { method: 'POST', body: JSON.stringify(body) }),
  crearCita: (body) => req('/api/citas', { method: 'POST', body: JSON.stringify(body) }),
  confirmarCita: (id) => req(`/api/citas/${id}/confirmar`, { method: 'POST' }),
  reprogramarCita: (id, fecha_hora) => req(`/api/citas/${id}/reprogramar`, { method: 'POST', body: JSON.stringify({ fecha_hora }) }),
  resultadoCita: (id, resultado) => req(`/api/citas/${id}/resultado`, { method: 'POST', body: JSON.stringify({ resultado }) }),
  cancelarCita: (id) => req(`/api/citas/${id}/cancelar`, { method: 'POST' }),
  registrarDeposito: (id) => req(`/api/depositos/${id}/registrar`, { method: 'POST' }),
  procesarAvisos: () => req('/api/motor/procesar', { method: 'POST' }),
  mensajes: () => req('/api/mensajes'),
  marcarEnviado: (id) => req(`/api/mensajes/${id}/enviado`, { method: 'POST' }),
  aceptarHueco: (id) => req(`/api/mensajes/${id}/aceptar-hueco`, { method: 'POST' }),
  listaEspera: () => req('/api/lista-espera'),
  crearEspera: (body) => req('/api/lista-espera', { method: 'POST', body: JSON.stringify(body) }),
  borrarEspera: (id) => req(`/api/lista-espera/${id}`, { method: 'DELETE' }),
  config: () => req('/api/config'),
  guardarConfig: (body) => req('/api/config', { method: 'PUT', body: JSON.stringify(body) }),
  tiposCita: () => req('/api/tipos-cita'),
  guardarTipo: (id, body) => req(`/api/tipos-cita/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  restablecer: () => req('/api/config/restablecer', { method: 'POST', body: JSON.stringify({ confirmar: 'BORRAR' }) }),
};

export const MSG_ERROR = 'No se ha podido completar. Inténtalo de nuevo.';
