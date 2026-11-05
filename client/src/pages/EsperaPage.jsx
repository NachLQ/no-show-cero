import { useEffect, useState } from 'react';
import { api, MSG_ERROR } from '../api.js';
import { NIVELES_FIABILIDAD, cls } from '../ui.js';

export default function EsperaPage() {
  const [lista, setLista] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [clienteId, setClienteId] = useState('');
  const [tipoId, setTipoId] = useState('');
  const [preferencia, setPreferencia] = useState('');
  const [error, setError] = useState('');
  const [procesando, setProcesando] = useState('');

  async function cargar() {
    try {
      const [le, cl, tp] = await Promise.all([api.listaEspera(), api.clientes(), api.tiposCita()]);
      setLista(le); setClientes(cl); setTipos(tp);
    } catch (e) {
      setError(e.message || MSG_ERROR);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function anadir() {
    setProcesando('anadir');
    setError('');
    try {
      await api.crearEspera({
        cliente_id: Number(clienteId),
        tipo_cita_id: tipoId ? Number(tipoId) : null,
        preferencia: preferencia || null,
      });
      setClienteId(''); setTipoId(''); setPreferencia('');
      await cargar();
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setProcesando('');
    }
  }

  async function quitar(id) {
    setProcesando(`quitar:${id}`);
    setError('');
    try {
      await api.borrarEspera(id);
      await cargar();
    } catch (e) {
      setError(e.message || MSG_ERROR);
    } finally {
      setProcesando('');
    }
  }

  return (
    <div className="space-y-3">
      <p className={cls.muted}>
        Quien quiere hueco antes, apuntado aquí. Al cancelarse una cita, el hueco se ofrece por orden:
        primero los clientes más fiables.
      </p>

      {error && <p className={cls.error}>{error}</p>}

      <div className={`space-y-2 ${cls.card}`}>
        <p className="text-sm font-bold">Apuntar a alguien</p>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="inp">
          <option value="">Cliente...</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={tipoId} onChange={(e) => setTipoId(e.target.value)} className="inp">
          <option value="">Cualquier servicio</option>
          {tipos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <input
          placeholder="Preferencia (mañanas, tardes...)"
          value={preferencia}
          onChange={(e) => setPreferencia(e.target.value)}
          className="inp"
        />
        <button disabled={!clienteId || !!procesando} onClick={anadir} className={cls.btnLg + ' py-2 text-sm'}>
          {procesando === 'anadir' ? 'Añadiendo…' : 'Añadir a la lista'}
        </button>
      </div>

      {lista.length === 0 && <p className={`py-8 text-center text-sm ${cls.dim}`}>La lista de espera está vacía.</p>}
      {lista.map((e) => {
        const nivel = NIVELES_FIABILIDAD[e.fiabilidad.nivel];
        const ocupado = procesando === `quitar:${e.id}`;
        return (
          <div key={e.id} className={cls.card}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{e.cliente_nombre}</p>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${nivel.clase}`}>
                  {nivel.label} · {e.fiabilidad.score}
                </span>
                <button disabled={!!procesando} onClick={() => quitar(e.id)} className={cls.btnSec}>
                  {ocupado ? 'Quitando…' : 'Quitar'}
                </button>
              </div>
            </div>
            <p className={cls.muted}>{e.servicio || 'Cualquier servicio'}{e.preferencia ? ` · ${e.preferencia}` : ''}</p>
          </div>
        );
      })}
    </div>
  );
}
