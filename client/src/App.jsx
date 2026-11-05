import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import AgendaPage from './pages/AgendaPage.jsx';
import PanelPage from './pages/PanelPage.jsx';
import MensajesPage from './pages/MensajesPage.jsx';
import EsperaPage from './pages/EsperaPage.jsx';
import AjustesPage from './pages/AjustesPage.jsx';
import { useTheme } from './theme.js';

function NavItem({ to, icono, children }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold ${
          isActive ? 'text-paper-text dark:text-ink-text' : 'text-paper-dim dark:text-ink-dim'
        }`
      }
    >
      <span className="text-xl">{icono}</span>
      {children}
    </NavLink>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="vach-shell mx-auto min-h-screen max-w-3xl bg-paper-bg pb-20 text-paper-text dark:bg-ink-bg dark:text-ink-text">
      <header className="vach-header sticky top-0 z-10 border-b border-paper-card bg-paper-surface/90 px-4 py-3 backdrop-blur dark:border-ink-card dark:bg-ink-surface/90">
        <div className="flex items-center gap-2">
          <span className="text-2xl"></span>
          <h1 className="font-display text-lg font-extrabold tracking-tight">No-show cero</h1>
          <button
            type="button"
            onClick={toggle}
            aria-label="Cambiar tema"
            className="ml-auto rounded-full px-2 py-1 text-lg text-paper-dim hover:text-marca-600 dark:text-ink-dim dark:hover:text-accent-light"
          >
            {theme === 'dark' ? "Claro" : "Oscuro"}
          </button>
        </div>
      </header>

      <main className="vach-main px-4 py-4">
        <Routes>
          <Route path="/" element={<Navigate to="/agenda" replace />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/panel" element={<PanelPage />} />
          <Route path="/mensajes" element={<MensajesPage />} />
          <Route path="/espera" element={<EsperaPage />} />
          <Route path="/ajustes" element={<AjustesPage />} />
          <Route path="*" element={<Navigate to="/agenda" replace />} />
        </Routes>
      </main>

      <nav className="fixed bottom-0 left-1/2 z-10 flex w-full max-w-3xl -translate-x-1/2 border-t border-paper-card bg-paper-surface dark:border-ink-card dark:bg-ink-surface">
        <NavItem to="/agenda" icono="">Agenda</NavItem>
        <NavItem to="/panel" icono="">Panel</NavItem>
        <NavItem to="/mensajes" icono="">Mensajes</NavItem>
        <NavItem to="/espera" icono="">Espera</NavItem>
        <NavItem to="/ajustes" icono="">Ajustes</NavItem>
      </nav>
    </div>
  );
}
