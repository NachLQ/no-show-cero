import { useEffect, useState } from 'react';

const KEY = 'nsc-theme';

function leerInicial() {
  const guardado = localStorage.getItem(KEY);
  if (guardado === 'dark' || guardado === 'light') return guardado;
  return 'dark';
}

export function useTheme() {
  const [theme, setTheme] = useState(leerInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}
