import { useEffect, useState } from 'react';
import { api, MSG_ERROR } from '../api.js';
import { eur, fechaCorta, NIVELES_FIABILIDAD, cls } from '../ui.js';

function Tarjeta({ titulo, valor, detalle, clase = '' }) {
  return (
    <div className={`${cls.card} ${clase}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${cls.dim}`}>{titulo}</p>
      <p className="text-2xl font-extrabold">{valor}</p>
      {detalle && <p className={`text-xs ${cls.dim}`}>{detalle}</p>}
    </div>
  );
}

export default function PanelPage() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.panel().then(setDatos).catch((e) => setError(e.message || MSG_ERROR));
  }, []);

  if (!datos) {
    return error
      ? <p className={cls.error}>{error}</p>
      : <p className={`py-8 text-center text-sm ${cls.dim}`}>Cargando…</p>;
  }

  return (
    <div className="space-y-4">
      {/* El número que duele: visible y gordo, como pide el spec */}
      <div className="rounded-2xl bg-rose-600 p-5 text-white ">
        <p className="text-sm font-semibold uppercase tracking-wide text-rose-100">
          Dinero perdido en plantones · últimos 30 días
        </p>
        <p className="text-5xl font-black">{eur(datos.perdido_30d)}</p>
        <p className="mt-1 text-sm text-rose-100">
          {datos.no_shows_30d} plantones. A este ritmo son{' '}
          <span className="font-extrabold text-white">{eur(datos.proyeccion_anual)} al año</span>.
        </p>
        {datos.depositos_retenidos_30d > 0 && (
          <p className="mt-1 text-xs text-rose-100">
            (ya descontados {eur(datos.depositos_retenidos_30d)} de señales retenidas)
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tarjeta titulo="Tasa de asistencia" valor={`${datos.tasa_asistencia} %`} detalle={`${datos.asistidas_30d} de ${datos.asistidas_30d + datos.no_shows_30d} citas`} />
        <Tarjeta titulo="Huecos recuperados" valor={datos.huecos_recuperados_30d} detalle={`${eur(datos.importe_recuperado_30d)} salvados con la lista de espera`} />
        <Tarjeta titulo="Sin confirmar ahora" valor={datos.proximas_sin_confirmar} detalle="citas futuras pendientes de respuesta" clase="col-span-2" />
      </div>

      <section>
        <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${cls.dim}`}>Plantones del mes</h2>
        <div className="space-y-2">
          {datos.no_shows_detalle.map((n, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-rose-100 bg-paper-surface p-3  dark:border-rose-800/40 dark:bg-ink-surface">
              <div>
                <p className="text-sm font-bold">{n.cliente}</p>
                <p className={`text-xs ${cls.dim}`}>{n.servicio || 'Cita'} · {fechaCorta(n.fecha)}</p>
              </div>
              <p className="font-extrabold text-rose-600 dark:text-rose-300">−{eur(n.importe)}</p>
            </div>
          ))}
          {datos.no_shows_detalle.length === 0 && (
            <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Cero plantones en 30 días. Así se hace. 
 </p>
          )}
        </div>
      </section>

      <section>
        <h2 className={`mb-2 text-sm font-bold uppercase tracking-wide ${cls.dim}`}>
          Fiabilidad de clientes <span className="font-normal normal-case">(peores primero)</span>
        </h2>
        <div className="space-y-2">
          {datos.ranking.map((c) => {
            const nivel = NIVELES_FIABILIDAD[c.fiabilidad.nivel];
            return (
              <div key={c.id} className={cls.card}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${nivel.punto}`} />
                    <p className="text-sm font-bold">{c.nombre}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${nivel.clase}`}>{nivel.label}</span>
                    <span className="text-sm font-extrabold">{c.fiabilidad.score}</span>
                  </div>
                </div>
                <p className={`mt-1 text-xs ${cls.dim}`}>
                  {c.fiabilidad.asistencias} asistencias · {c.fiabilidad.no_shows} plantones · {c.fiabilidad.cancelaciones_tardias} cancelaciones tardías
                </p>
                {c.fiabilidad.deposito_recomendado && (
                  <p className="mt-1 rounded-lg bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">Sugerencia: pedir señal por adelantado en sus próximas citas
 </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
