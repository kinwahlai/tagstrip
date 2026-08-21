// The theme lives on <html data-theme>, which is what ts-modernist.css keys off
// and what index.css points Tailwind's `dark:` variant at. Resolving the OS
// preference to an explicit attribute at startup — rather than leaving it unset
// and letting a media query decide — is what lets the header toggle beat the OS
// setting in both directions.
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'tagstrip:theme'

export function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function storedTheme(): Theme | null {
  const value = localStorage.getItem(STORAGE_KEY)
  return value === 'light' || value === 'dark' ? value : null
}

export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}
