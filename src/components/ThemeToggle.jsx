import { useEffect, useState } from 'react'

const storageKey = 'trigger3d-theme'

function getInitialTheme() {
  const savedTheme = localStorage.getItem(storageKey)
  if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme

  return 'dark'
}

export default function ThemeToggle({ compact = false }) {
  const [theme, setTheme] = useState(getInitialTheme)
  const isDark = theme === 'dark'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    localStorage.setItem(storageKey, theme)
  }, [theme])

  return (
    <button
      className={`theme-toggle${compact ? ' theme-toggle--nav' : ''}`}
      type="button"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? (
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4.25v1.5m0 12.5v1.5m7.75-7.75h-1.5m-12.5 0h-1.5m13.08-5.08-1.06 1.06M6.73 17.27l-1.06 1.06m12.66 0-1.06-1.06M6.73 6.73 5.67 5.67M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" /></svg>
      ) : (
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M20.4 15.1A8.25 8.25 0 0 1 8.9 3.6 8.25 8.25 0 1 0 20.4 15.1Z" /></svg>
      )}
      {!compact && <span>{isDark ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
