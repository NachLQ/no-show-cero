# 🛡️ No-Show Cero

## Paquete e instrucciones de arranque

La tienda ofrece autoservicio (69 €) e instalación asistida (199 €). Las instrucciones de Node.js, npm e INICIAR.bat de este README corresponden al kit de código fuente. Para el instalador Windows, sigue la guía incluida en el paquete; no necesitas instalar Node.js por separado.

Sistema anti-plantones para negocios de citas (coaches, clínicas, estética, peluquerías, fisioterapia).

Calcula las pérdidas según el precio de cada cita y la señal registrada. Prepara recordatorios y ofertas para gestionar huecos; el envío y la aceptación se registran manualmente.

## Arranque (sin terminal)

Doble click en **INICIAR.bat**. La primera vez instala dependencias (el tiempo depende del equipo y la conexión); después abre el navegador en `http://localhost:5173`. La base de datos se crea sola con los datos de demo de la peluquería *Sala Bruna*.

Para desarrolladores: `npm run install:all` y `npm run dev` (cliente en 5173, API en 4000). `npm run seed` reinicia los datos demo (también desde Ajustes → "Reiniciar datos de demo").

## Qué hace

- Cascada de avisos por cita: prepara el aviso de 48 h, el siguiente de 24 h y la alerta interna según tus ajustes. El motor se ejecuta al arrancar el servidor o al pulsar «Procesar avisos»; no hay envío automático ni programador en segundo plano.
- **Mensajes listos para WhatsApp**: el envío automático es fase 2, pero cada mensaje generado se abre en WhatsApp con el texto ya escrito (`wa.me`) — un toque y enviado, sin API ni coste. Usable desde el día uno.
- **Política de señal (depósito) por servicio**: sin señal / solo reincidentes / siempre, con importe propio y texto legal-comercial editable. Registrar la señal confirma la cita; si el cliente no viene, la señal se queda en caja y descuenta la pérdida del panel.
- **Ranking de fiabilidad por cliente** con sugerencia automática: a los reincidentes, señal obligatoria en su próxima cita.
- **Lista de espera inteligente**: al cancelarse una cita se generan ofertas del hueco por orden (clientes más fiables primero). Aceptar una oferta crea la cita en el hueco y cuenta como dinero recuperado.
- **Panel de pérdidas**: dinero perdido en 30 días (gordo y en rojo), **proyección anual**, tasa de asistencia, huecos recuperados y desglose de cada plantón.

## La matemática del seed (calculada a mano)

| Plantón | Servicio | Importe |
|---|---|---|
| Vanesa Ortiz ×2 | Color y mechas | 60 € + 60 € |
| Iván Castro | Corte + Keratina | 25 € + 45 € |
| Lorena Gil | Keratina | 45 € |
| Raquel Peña | Corte | 25 € |
| **Total 30 días** | | **260 €** → proyección anual 3.120 € |

34 asistencias → tasa de asistencia 34/40 = **85 %**. Huecos recuperados: 2 (**105 €**). El seed es 100 % determinista: el panel siempre cuadra con esta tabla.

## Fórmula de fiabilidad

Se parte de 100 puntos sobre los eventos de los últimos 6 meses: **plantón −30 · cancelación tardía (<24 h) −10 · asistencia +5** (tope 100, suelo 0). Clasificación: ≥80 fiable · 50-79 atención · <50 puntos o ≥2 plantones (umbral configurable) **reincidente → señal recomendada**. En el seed: Vanesa e Iván salen reincidentes, Lorena y Raquel en atención, el resto fiables.

## Decisiones de diseño

- **Sin cron**: el motor de avisos corre al arrancar el servidor y con el botón "Procesar avisos" de la agenda. Es idempotente (cada paso se genera una sola vez por cita) y avanza un paso por pasada para respetar el orden de la cascada.
- **Fechas en ISO local** (`YYYY-MM-DDTHH:mm`), sin zonas horarias: la agenda muestra exactamente lo que se escribió.
- **Citas próximas del seed relativas en horas** (no "hoy a las 20:00"): la demo enseña los tres pasos de la cascada arranques a la hora que arranques.
- **Reprogramar reinicia la cascada**: la cita movida vuelve a "sin confirmar" y sus avisos empiezan de cero.
- **La señal pagada confirma**: nadie deja una señal para no venir; registrar el pago pasa la cita a confirmada sin más avisos.
- **Cancelación tardía** = a menos de 24 h de la cita; puntúa en contra del cliente y retiene la señal si la había.

## Estructura

```
no-show-cero/
├── INICIAR.bat
├── client/          React 18 + Vite + Tailwind (puerto 5173)
│   └── src/pages/   Agenda · Panel · Mensajes · Espera · Ajustes
└── server/          Express + better-sqlite3 ^12 (puerto 4000)
    ├── db.js        esquema y config
    ├── motor.js     cascada de avisos y lista de espera
    ├── fiabilidad.js
    ├── mensajes.js  copy de los 5 mensajes
    └── seed.js      demo determinista de Sala Bruna
```

## Fase 2

Cobro real de la señal (Stripe/Bizum API), envío automático por WhatsApp Business API, recordatorios con cron real, multi-empleado y sincronización con Google Calendar.
