import { useEffect, useState } from 'react';
import { api, MSG_ERROR } from '../api.js';
import { waLink, TIPOS_MENSAJE, eur, cls } from '../ui.js';

const ESTADOS = {
  pendiente: { label: 'Por enviar', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' },
  enviado: { label: 'Enviado', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300' },
  caducado: { label: 'Caducado', clase: 'bg-paper-card text-paper-muted dark:bg-ink-card dark:text-ink-muted' },
};

function MensajeCard({ msg, onCambio, onAviso }) {
  const tipo = TIPOS_MENSAJE[msg.tipo];
  const estado = ESTADOS[msg.estado];
  const interno = msg.tipo === 'alerta_negocio';
  const wa = !interno && waLink(msg.cliente_telefono, msg.texto);
  const [procesando, setProcesando] = useState('');
  const [error, setError] = useState('');

  async function run(clave, fn) {
    setProcesando(clave);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setProcesando('');
    }
  }

  async function copiar() {
    await run('copiar', async () => {
      await navigator.clipboard.writeText(msg.texto);
      onAviso('Mensaje copiado. Pégalo donde quieras.');
    });
  }

  async function abrirWhatsApp() {
    await run('whatsapp', async () => {
      window.open(wa, '_blank');
      await api.marcarEnviado(msg.id);
      onCambio();
    });
  }

  async function aceptarHueco() {
    await run('aceptar', async () => {
      const r = await api.aceptarHueco(msg.id);
      onAviso(`¡Hueco recuperado! ${eur(r.importe_recuperado)} salvados. La cita nueva ya está en la agenda.`);
      onCambio();
    });
  }

  async function marcar() {
    await run('enviado', async () => {
      await api.marcarEnviado(msg.id);
      onCambio();
    });
  }

  return (
    <div className={`rounded-xl border bg-paper-surface p-3  dark:bg-ink-surface ${interno ? 'border-rose-200 dark:border-rose-800/40' : 'border-paper-card dark:border-ink-card'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold">
          {tipo.icono} {tipo.label}
          {msg.cliente_nombre && !interno && <span className="font-normal text-paper-muted dark:text-ink-muted"> · para {msg.cliente_nombre}</span>}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estado.clase}`}>{estado.label}</span>
      </div>
      <p className="mt-2 whitespace-pre-line rounded-lg bg-paper-card p-2 text-sm text-paper-text dark:bg-ink-card dark:text-ink-text">{msg.texto}</p>
      {error && <p className={`mt-2 ${cls.error}`}>{error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {wa && msg.estado === 'pendiente' && (
          <button disabled={!!procesando} onClick={abrirWhatsApp} className={cls.btn + ' bg-emerald-600'}>
            {procesando === 'whatsapp' ? 'Abriendo…' : "Abrir en WhatsApp"}
          </button>
        )}
        {!interno && (
          <button disabled={!!procesando} onClick={copiar} className={cls.btnSec}>
            {procesando === 'copiar' ? 'Copiando…' : "Copiar"}
          </button>
        )}
        {msg.tipo === 'oferta_hueco' && msg.estado === 'pendiente' && (
          <button disabled={!!procesando} onClick={aceptarHueco} className={cls.btn + ' bg-sky-600'}>
            {procesando === 'aceptar' ? 'Aceptando…' : "Ha aceptado el hueco"}
          </button>
        )}
        {msg.estado === 'pendiente' && (
          <button disabled={!!procesando} onClick={marcar} className={cls.btnSec}>
            {procesando === 'enviado' ? 'Marcando…' : 'Marcar enviado'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MensajesPage() {
  const [mensajes, setMensajes] = useState([]);
  const [filtro, setFiltro] = useState('pendiente');
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState('');

  function cargar() {
    api.mensajes().then(setMensajes).catch((e) => setError(e.message || MSG_ERROR));
  }
  useEffect(() => { cargar(); }, []);

  function avisar(t) {
    setAviso(t);
    setTimeout(() => setAviso(null), 5000);
  }

  const visibles = filtro === 'todos' ? mensajes : mensajes.filter((m) => m.estado === filtro);
  const pendientes = mensajes.filter((m) => m.estado === 'pendiente').length;

  return (
    <div className="space-y-3">
      <p className={cls.muted}>
        El envío automático llega en fase 2. Hoy cada mensaje se abre en WhatsApp con el texto ya escrito: un toque y fuera.
      </p>

      {error && <p className={cls.error}>{error}</p>}
      {aviso && <div className={cls.aviso}>{aviso}</div>}

      <div className="flex gap-1 rounded-lg bg-paper-card p-1 dark:bg-ink-card">
        {[['pendiente', `Por enviar (${pendientes})`], ['enviado', 'Enviados'], ['todos', 'Todos']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFiltro(v)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-bold ${filtro === v ? "bg-paper-surface text-paper-text  dark:bg-ink-surface dark:text-ink-text" : 'text-paper-muted dark:text-ink-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {visibles.length === 0 && <p className={`py-8 text-center text-sm ${cls.dim}`}>Nada por aquí.</p>}
      {visibles.map((m) => <MensajeCard key={m.id} msg={m} onCambio={cargar} onAviso={avisar} />)}
    </div>
  );
}
