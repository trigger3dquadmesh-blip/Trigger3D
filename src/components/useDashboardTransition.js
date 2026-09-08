import { useEffect, useRef, useState } from 'react'
import { saveDashboardPage } from './dashboard-location.js'

export default function useDashboardTransition(activePage, setActivePage, storageKey, delay = 300) {
  const [pendingPage, setPendingPage] = useState('')
  const timerRef = useRef(null)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  function navigate(page) {
    if (page === activePage && !pendingPage) return false
    window.clearTimeout(timerRef.current)
    setPendingPage(page)
    saveDashboardPage(localStorage, storageKey, page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    timerRef.current = window.setTimeout(() => {
      setActivePage(page)
      setPendingPage('')
    }, delay)
    return true
  }

  return { navigate, pendingPage }
}
