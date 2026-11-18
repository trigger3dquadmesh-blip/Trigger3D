import { useCallback, useEffect, useRef, useState } from 'react'

// Locks explode/reassemble and reset while parts and camera are moving, so
// rapid taps don't make the model jitter. Mirrors the cooldown used by the
// signed-in viewer (AdminModelViewerPanel): part animation (800 ms + 120 ms
// per explode step) plus the 900 ms camera glide, capped at 3 s.
export function viewActionCooldownMs(parts) {
  const maxExplodeOrder = Math.max(0, ...parts.map((part) => Number(part.explode_order) || 0))
  return Math.min(3000, 800 + maxExplodeOrder * 120 + 900)
}

export default function useViewActionCooldown(parts) {
  const [cooling, setCooling] = useState(false)
  const coolingRef = useRef(false) // blocks a double tap that lands before re-render
  const timerRef = useRef(0)

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  const run = useCallback((action) => {
    if (coolingRef.current) return
    action()
    coolingRef.current = true
    setCooling(true)
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      coolingRef.current = false
      setCooling(false)
    }, viewActionCooldownMs(parts))
  }, [parts])

  return [cooling, run]
}
