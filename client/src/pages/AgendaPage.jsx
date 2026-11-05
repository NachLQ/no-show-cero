import { useEffect, useState } from 'react';
import { api, MSG_ERROR } from '../api.js';
import { eur, fechaCorta, ESTADOS_CITA, cls } from '../ui.js';

const PASOS = {
  recordatorio_48h: "48 h",
  aviso_24h: "24 h",
  alerta_negocio: "alerta",
};

const GERUNDIOS = {
  confirmar: 'Confirmando…',
  deposito: 'Registrando…',
  asistida: 'Guardando…',
  no_show: 'Registrando…',
  reprogramar: 'Reprogramando…',
  cancelar: 'Cancelando…',
};

function Chip({ clase, children }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}>{children}</span>;
}

function CitaCard({ cita, onAccion, modo, busy }) {
  const [reprogramando, setReprogramando] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const estado = ESTADOS_CITA[cita.estado];
  const esHoy = new Date(cita.fecha_hora).toDateString() === new Date().toDateString();
  const activa = ['pendiente', 'confirmada'].includes(cita.estado);
  const accionActual = busy?.startsWith(`${cita.id}:`) ? busy.slice(String(cita.id).length + 1) : '';

  return (
    <div className={cls.card}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold">{cita.cliente_nombre}</p>
          <p className={cls.muted}>
            {cita.servicio} · {eur(cita.precio)} · {cita.duracion_min} min
          </p>
          <p className="text-sm font-semibold text-paper-text dark:text-ink-text">{fechaCorta(cita.fecha_hora)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Chip clase={estado.clase}>{estado.label}</Chip>
          {cita.deposito && (
            <Chip clase={cita.deposito.estado === 'solicitado'
              ? 'bg-violet-100 text-violet-800 dark:bg-violet-950/30 dark:text-violet-300'
              : 'bg-violet-200 text-violet-900 dark:bg-violet-950/30 dark:text-violet-300'}>
              Señal {eur(cita.deposito.importe)} · {cita.deposito.estado}
            </Chip>
          )}
        </div>
      </div>

      {cita.confirmaciones.length > 0 && (
        <p className={`mt-1 text-xs ${cls.dim}`}>
          Avisos enviados: {cita.confirmaciones.map((c) => PASOS[c.paso]).join(' → ')}
        </p>
      )}
      {cita.notas && <p className={`mt-1 text-xs italic ${cls.dim}`}>{cita.notas}</p>}

      {activa && (
        <div className="mt-2 flex flex-wrap gap-2">
          {cita.estado === 'pendiente' && (
            <button disabled={!!busy} onClick={() => onAccion('confirmar', cita)} className={cls.btn + ' bg-emerald-600'}>
              {accionActual === 'confirmar' ? GERUNDIOS.confirmar : "Ha confirmado"}
            </button>
          )}
          {cita.deposito?.estado === 'solicitado' && (
            <button disabled={!!busy} onClick={() => onAccion('deposito', cita)} className={cls.btn + ' bg-violet-600'}>
              {accionActual === 'deposito' ? GERUNDIOS.deposito : "Señal recibida"}
            </button>
          )}
          {(esHoy || modo === 'historial') && (
            <>
              <button disabled={!!busy} onClick={() => onAccion('asistida', cita)} className={cls.btn + ' bg-emerald-700'}>
                {accionActual === 'asistida' ? GERUNDIOS.asistida : 'Asistió'}
              </button>
              <button disabled={!!busy} onClick={() => onAccion('no_show', cita)} className={cls.btn + ' bg-rose-600'}>
                {accionActual === 'no_show' ? GERUNDIOS.no_show : 'No vino'}
              </button>
            </>
          )}
          <button disabled={!!busy} onClick={() => setReprogramando(!reprogramando)} className={cls.btnSec}>Reprogramar
 </button>
          <button disabled={!!busy} onClick={() => onAccion('cancelar', cita)} className={cls.btnSec}>
            {accionActual === 'cancelar' ? GERUNDIOS.cancelar : "Cancelar"}
          </button>
        </div>
      )}

      {reprogramando && (
        <div className="mt-2 flex gap-2">
          <input
            type="datetime-local"
            value={nuevaFecha}
            onChange={(e) => setNuevaFecha(e.target.value)}
            className="inp flex-1"
          />
          <button
            disabled={!!busy || !nuevaFecha}
            onClick={async () => {
              const ok = await onAccion('reprogramar', cita, nuevaFecha);
              if (ok) { setReprogramando(false); setNuevaFecha(''); }
            }}
            className={cls.btn + ' bg-marca-600'}
          >
            {accionActual === 'reprogramar' ? GERUNDIOS.reprogramar : 'Mover'}
          </button>
        </div>
      )}
    </div>
  );
}

function NuevaCita({ clientes, tipos, onCreada }) {
  const [abierto, setAbierto] = useState(false);
  const [clienteId, setClienteId] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [fecha, setFecha] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState(false);

  async function crear() {
    setError('');
    setProcesando(true);
    try {
      let cid = clienteId;
      if (cid === 'nuevo') {
        if (!nuevoNombre.trim()) throw new Error('Escribe el nombre del cliente nuevo');
        const r = await api.crearCliente({ nombre: nuevoNombre, telefono: nuevoTelefono });
        cid = r.id;
      }
      const r = await api.crearCita({ cliente_id: Number(cid), tipo_cita_id: Number(tipoId), fecha_hora: fecha });
      setAbierto(false);
      setClienteId(''); setNuevoNombre(''); setNuevoTelefono(''); setTipoId(''); setFecha('');
      onCreada(r);
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setProcesando(false);
    }
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className={cls.btnLg}>Nueva cita
 </button>
    );
  }

  return (
    <div className={`space-y-2 ${cls.card}`}>
      <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="inp">
        <option value="">Cliente...</option>
        {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        <option value="nuevo">Cliente nuevo</option>
      </select>
      {clienteId === 'nuevo' && (
        <div className="flex gap-2">
          <input placeholder="Nombre" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} className="inp flex-1" />
          <input placeholder="Teléfono (34...)" value={nuevoTelefono} onChange={(e) => setNuevoTelefono(e.target.value)} className="inp flex-1" />
        </div>
      )}
      <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="inp">
        <option value="">Servicio...</option>
        {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre} · {eur(t.precio)}</option>)}
      </select>
      <input type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} className="inp" />
      {error && <p className={cls.error}>{error}</p>}
      <div className="flex gap-2">
        <button disabled={procesando || !clienteId || !tipoId || !fecha} onClick={crear} className={`flex-1 ${cls.btn} bg-marca-600 py-2 text-sm`}>
          {procesando ? 'Guardando…' : 'Guardar cita'}
        </button>
        <button disabled={procesando} onClick={() => setAbierto(false)} className={`${cls.btnSec} px-4 py-2 text-sm`}>
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  const [citas, setCitas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [modo, setModo] = useState('proximas');
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function cargar(m = modo) {
    try {
      const [ag, cl, tp] = await Promise.all([api.agenda(m), api.clientes(), api.tiposCita()]);
      setCitas(ag); setClientes(cl); setTipos(tp);
    } catch (e) {
      setError(e.message || MSG_ERROR);
    }
  }

  useEffect(() => { cargar(modo); }, [modo]);

  function avisar(texto) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 6000);
  }

  async function onAccion(accion, cita, extra) {
    setBusy(`${cita.id}:${accion}`);
    setError('');
    try {
      if (accion === 'confirmar') await api.confirmarCita(cita.id);
      if (accion === 'deposito') { await api.registrarDeposito(cita.deposito.id); avisar('Señal registrada: la cita queda confirmada.'); }
      if (accion === 'asistida') await api.resultadoCita(cita.id, 'asistida');
      if (accion === 'no_show') { await api.resultadoCita(cita.id, 'no_show'); avisar('Plantón registrado. Mira la pérdida neta en el Panel.'); }
      if (accion === 'reprogramar') { await api.reprogramarCita(cita.id, extra); avisar('Cita movida. La cadena de avisos empieza de cero.'); }
      if (accion === 'cancelar') {
        const r = await api.cancelarCita(cita.id);
        if (r.ofertas.length > 0) {
          avisar(`Hueco ofrecido a ${r.ofertas.length} persona${r.ofertas.length === 1 ? '' : 's'} de la lista de espera. Los mensajes están en Mensajes.`);
        } else {
          avisar(r.tardia ? 'Cancelación tardía registrada.' : 'Cita cancelada.');
        }
      }
      await cargar();
      return true;
    } catch (e) {
      setError(e.message || MSG_ERROR);
      return false;
    } finally {
      setBusy('');
    }
  }

  async function procesar() {
    setBusy('procesar');
    setError('');
    try {
      const g = await api.procesarAvisos();
      const total = g.recordatorio_48h + g.aviso_24h + g.alerta_negocio;
      avisar(total === 0
        ? 'Todo al día: no toca ningún aviso ahora mismo.'
        : `Generados: ${g.recordatorio_48h} recordatorios, ${g.aviso_24h} segundos avisos, ${g.alerta_negocio} alertas. Están en Mensajes.`);
      await cargar();
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-3">
      {error && <p className={cls.error}>{error}</p>}
      {aviso && (
        <div className={cls.aviso}>{aviso}</div>
      )}

      <NuevaCita clientes={clientes} tipos={tipos} onCreada={(r) => {
        avisar(r.deposito_solicitado
          ? "Cita creada. Este cliente necesita señal: el mensaje está listo en Mensajes."
          : 'Cita creada.');
        cargar();
      }} />

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-paper-card p-1 dark:bg-ink-card">
          {[['proximas', 'Próximas'], ['historial', 'Historial']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setModo(v)}
              className={`rounded-md px-3 py-1 text-xs font-bold ${modo === v ? "bg-paper-surface text-paper-text  dark:bg-ink-surface dark:text-ink-text" : 'text-paper-muted dark:text-ink-muted'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <button disabled={!!busy} onClick={procesar} className={cls.btn + ' bg-sky-600'}>
          {busy === 'procesar' ? 'Procesando…' : "Procesar avisos"}
        </button>
      </div>

      {citas.length === 0 && <p className={`py-8 text-center text-sm ${cls.dim}`}>No hay citas aquí.</p>}
      {citas.map((c) => <CitaCard key={c.id} cita={c} onAccion={onAccion} modo={modo} busy={busy} />)}
    </div>
  );
}
