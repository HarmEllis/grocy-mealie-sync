import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
} from './ThemeProvider';

const themeScript = `
(() => {
  const defaultTheme = ${JSON.stringify(DEFAULT_THEME)};
  const defaultAccent = ${JSON.stringify(DEFAULT_ACCENT)};
  const themeStorageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
  const accentStorageKey = ${JSON.stringify(ACCENT_STORAGE_KEY)};

  try {
    const root = document.documentElement;
    const storedTheme = localStorage.getItem(themeStorageKey);
    const storedAccent = localStorage.getItem(accentStorageKey);

    const theme = storedTheme === 'light' || storedTheme === 'dark'
      ? storedTheme
      : defaultTheme;
    const accent = storedAccent === 'teal' || storedAccent === 'violet' || storedAccent === 'amber'
      ? storedAccent
      : defaultAccent;

    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
  } catch {
    // Ignore localStorage access errors and keep CSS defaults.
  }
})();
`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
