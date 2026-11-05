import { useEffect, useState } from 'react';
import { api, MSG_ERROR } from '../api.js';
import { eur, cls } from '../ui.js';

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className={cls.label}>{label}</span>
      {children}
    </label>
  );
}

export default function AjustesPage() {
  const [cfg, setCfg] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [borrando, setBorrando] = useState(false);

  async function cargar() {
    try {
      const [c, t] = await Promise.all([api.config(), api.tiposCita()]);
      setCfg(c); setTipos(t);
    } catch (e) {
      setError(e.message || MSG_ERROR);
    }
  }
  useEffect(() => { cargar(); }, []);

  function avisar(t) {
    setAviso(t);
    setTimeout(() => setAviso(null), 4000);
  }

  if (!cfg) {
    return error
      ? <p className={cls.error}>{error}</p>
      : <p className={`py-8 text-center text-sm ${cls.dim}`}>Cargando…</p>;
  }

  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value });
  const setTipo = (id, k, v) => setTipos(tipos.map((t) => (t.id === id ? { ...t, [k]: v } : t)));

  async function guardarTodo() {
    setGuardando(true);
    setError('');
    try {
      await api.guardarConfig(cfg);
      for (const t of tipos) await api.guardarTipo(t.id, t);
      avisar('Guardado.');
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setGuardando(false);
    }
  }

  async function restablecer() {
    setBorrando(true);
    setError('');
    try {
      await api.restablecer();
      setConfirmando(false);
      setTextoConfirmacion('');
      await cargar();
      avisar('Datos del negocio borrados. Los servicios se conservan.');
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className={cls.error}>{error}</p>}
      {aviso && <div className={cls.ok}>{aviso}</div>}

      <section className={`space-y-2 ${cls.card}`}>
        <h2 className="text-sm font-bold">Negocio</h2>
        <Campo label="Nombre (sale en los mensajes)">
          <input value={cfg.negocio_nombre} onChange={set('negocio_nombre')} className="inp mt-1" />
        </Campo>
        <Campo label="Teléfono para el Bizum de las señales">
          <input value={cfg.negocio_telefono} onChange={set('negocio_telefono')} className="inp mt-1" />
        </Campo>
      </section>

      <section className={`space-y-2 ${cls.card}`}>
        <h2 className="text-sm font-bold">Cadena de avisos</h2>
        <div className="grid grid-cols-3 gap-2">
          <Campo label="Recordatorio (h)">
            <input type="number" value={cfg.horas_recordatorio} onChange={set('horas_recordatorio')} className="inp mt-1" />
          </Campo>
          <Campo label="2º aviso (h)">
            <input type="number" value={cfg.horas_segundo_aviso} onChange={set('horas_segundo_aviso')} className="inp mt-1" />
          </Campo>
          <Campo label="Alerta (h)">
            <input type="number" value={cfg.horas_alerta} onChange={set('horas_alerta')} className="inp mt-1" />
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Campo label="Plantones para ser reincidente">
            <input type="number" value={cfg.umbral_reincidente} onChange={set('umbral_reincidente')} className="inp mt-1" />
          </Campo>
          <Campo label="Ofertas por hueco libre">
            <input type="number" value={cfg.ofertas_por_hueco} onChange={set('ofertas_por_hueco')} className="inp mt-1" />
          </Campo>
        </div>
      </section>

      <section className={`space-y-2 ${cls.card}`}>
        <h2 className="text-sm font-bold">Política de señal por servicio</h2>
        {tipos.map((t) => (
          <div key={t.id} className="rounded-lg border border-paper-card bg-paper-card p-2 dark:border-ink-card dark:bg-ink-card">
            <p className="text-sm font-bold">{t.nombre} · {eur(t.precio)}</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <select
                value={t.politica_deposito}
                onChange={(e) => setTipo(t.id, 'politica_deposito', e.target.value)}
                className="inp"
              >
                <option value="ninguno">Sin señal</option>
                <option value="reincidentes">Solo reincidentes</option>
                <option value="siempre">Siempre</option>
              </select>
              <input
                type="number"
                value={t.importe_deposito}
                onChange={(e) => setTipo(t.id, 'importe_deposito', Number(e.target.value))}
                className="inp"
                placeholder="€"
              />
            </div>
          </div>
        ))}
      </section>

      <section className={`space-y-2 ${cls.card}`}>
        <h2 className="text-sm font-bold">Texto de la política de señal</h2>
        <p className={`text-xs ${cls.dim}`}>Para tu web, tu escaparate o para responder a quien pregunte por qué pides señal.</p>
        <textarea value={cfg.texto_politica} onChange={set('texto_politica')} rows={6} className="inp mt-1" />
      </section>

      <button disabled={guardando || borrando} onClick={guardarTodo} className={cls.btnLg}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>

      <section className="space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-800/40 dark:bg-red-950/30">
        <h2 className="flex items-center gap-2 font-bold text-red-700 dark:text-red-300">Zona de peligro
 </h2>
        <p className="text-xs text-red-700 dark:text-red-300">
          Borra clientes, citas, confirmaciones, señales, lista de espera, historial y mensajes,
          y deja en blanco el nombre y el teléfono del negocio. Los servicios se conservan
          (aquí se editan, pero no se pueden volver a crear desde cero) y no se recarga la demo.
          {' '}<b>No se puede deshacer.</b>
        </p>
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            className="w-full rounded-xl border border-red-300 py-2.5 text-sm font-semibold text-red-700 dark:border-red-800/50 dark:text-red-300"
          >
            Empezar de cero…
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-red-700 dark:text-red-300">Escribe <b>BORRAR</b> para confirmar:</p>
            <input
              className="inp border-red-300 dark:border-red-800/50"
              value={textoConfirmacion}
              onChange={(e) => setTextoConfirmacion(e.target.value)}
              placeholder="BORRAR"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setConfirmando(false); setTextoConfirmacion(''); }}
                className="flex-1 rounded-xl border border-paper-card py-2.5 text-sm text-paper-muted dark:border-ink-card dark:text-ink-muted"
              >
                Cancelar
              </button>
              <button
                onClick={restablecer}
                disabled={textoConfirmacion !== 'BORRAR' || borrando}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {borrando ? 'Borrando…' : 'Borrar todo'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
