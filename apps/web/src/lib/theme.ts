import type { AccentColor, ThemeMode } from '@titanapt/shared';

const THEME_KEY = 'titanapt-theme';
const ACCENT_KEY = 'titanapt-accent';

/** localStorage is unavailable in some environments (opaque origin, some
 *  private-browsing modes). Theme must never be the reason the app crashes. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export const themeOptions: Array<{ value: ThemeMode; label: string; description: string }> = [
  { value: 'dark', label: 'Dark', description: 'Deep charcoal surfaces with bright accent contrast.' },
  { value: 'light', label: 'Light', description: 'Warm paper surfaces with deep ink and clear contrast.' },
];

export const accentOptions: Array<{ value: AccentColor; label: string; color: string }> = [
  { value: 'orange', label: 'Titan Orange', color: '#FF7900' },
  { value: 'green', label: 'Signal Green', color: '#1F9D6A' },
  { value: 'purple', label: 'Studio Purple', color: '#7C5CFF' },
  { value: 'blue', label: 'Focus Blue', color: '#2F7DF6' },
];

export function getStoredTheme(): ThemeMode {
  const value = safeStorage()?.getItem(THEME_KEY);
  return value === 'light' ? 'light' : 'dark';
}

export function getStoredAccent(): AccentColor {
  const value = safeStorage()?.getItem(ACCENT_KEY);
  return value === 'green' || value === 'purple' || value === 'blue' ? value : 'orange';
}

export function applyTheme(theme: ThemeMode, accent: AccentColor) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.accent = accent;
  root.style.colorScheme = theme;
  try {
    const storage = safeStorage();
    storage?.setItem(THEME_KEY, theme);
    storage?.setItem(ACCENT_KEY, accent);
  } catch {
    // quota / privacy mode — theme still applies for this page view
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#080808' : '#F4F0E6');
}
