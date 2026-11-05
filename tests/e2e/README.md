# Pruebas E2E

`node --test tests/e2e/pantallas.test.cjs`

Requiere Playwright y las dependencias del cliente/servidor instaladas para Windows. PLAYWRIGHT_MODULE permite seleccionar el módulo de Playwright, E2E_SERVER_MODULES las dependencias de servidor del entorno de QA y E2E_OUTPUT la carpeta de evidencias. El servidor y la base se aíslan en un directorio temporal. E2E_BROWSER permite seleccionar Chromium/Edge.

Esta prueba recorre pantallas, tamaños, temas y estados; no sustituye las pruebas funcionales de escrituras, cálculos, exportación, PDF e integraciones. Las exclusiones quedan registradas en matriz-pantallas.json.

interfaz.test.cjs: ocho combinaciones; ajustes, nueva cita y cliente, señal, mover/confirmar/asistencia, plantón y pérdida neta, espera, cancelación/oferta/aceptación, copiar y preparar WhatsApp (apertura interceptada: sin envío), filtros, quitar espera, avisos y cancelación/confirmación del reset. calculos.test.cjs: matemática del seed, cascada idempotente/reprogramación, separación de señales de cancelaciones y plantones, total y desglose netos. El estado vacío de la matriz usa el reset real y conserva el catálogo.
