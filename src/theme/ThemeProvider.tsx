import { type ReactNode, useEffect, useState } from 'react'
import { ThemeContext, type Theme } from './theme-context'

const storageKey = 'cmac-color-theme'

function getInitialTheme(): Theme {
  if (document.documentElement.dataset.theme === 'light') return 'light'

  try {
    return window.localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
      'content',
      theme === 'light' ? '#e9eceb' : '#050709',
    )

    try {
      window.localStorage.setItem(storageKey, theme)
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  )
}
