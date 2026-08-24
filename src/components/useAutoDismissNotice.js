import { useEffect } from 'react'

export default function useAutoDismissNotice(notice, clearNotice, delay = 3000) {
  useEffect(() => {
    if (!notice) return undefined

    const timeoutId = window.setTimeout(clearNotice, delay)
    return () => window.clearTimeout(timeoutId)
  }, [clearNotice, delay, notice])
}
