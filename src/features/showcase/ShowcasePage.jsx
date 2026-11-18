import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import AdminIcon from '../admin/AdminIcon.jsx'
import ThemeToggle from '../../components/ThemeToggle.jsx'
import logoForLightTheme from '../../assets/showcase/brand-logo-light.webp'
import logoForDarkTheme from '../../assets/showcase/brand-logo-dark.webp'
import { SHOWCASE_PARTS } from './showcase-parts.js'
import { resolveShowcaseSession, stripShowcaseEntryParam } from './showcase-session.js'
import useViewActionCooldown from './useViewActionCooldown.js'

const FirearmCanvas = lazy(() => import('../student/viewer/FirearmCanvas.jsx'))

// Public, QR-only showcase of the M1911 model for enrollment booths.
// No login and no database: the model and part layout ship with the site.
// Shows part names only, never "how it works" or assembly steps.
const MODEL_URL = '/showcase/m1911-showcase.glb'
const SESSION_CHECK_MS = 15 * 1000
const LOW_TIME_MS = 5 * 60 * 1000
const DISCLAIMER = 'Non-functional educational 3D model. It contains no instructions for assembling or operating a firearm.'

const partLabel = (name) => name.replaceAll('_', ' ')
const groupLabel = (group) => {
  const text = String(group || 'Components').replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function safeLocalStorage() {
  try {
    return window.localStorage
  } catch {
    return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  }
}

function useShowcaseSession() {
  const [session, setSession] = useState(() => resolveShowcaseSession({
    search: window.location.search, now: Date.now(), storage: safeLocalStorage(),
  }))

  // Remove the QR marker so refreshing or sharing the address can't restart the hour.
  useEffect(() => {
    if (session.cameFromScan) window.history.replaceState(null, '', stripShowcaseEntryParam(window.location.href))
  }, [session.cameFromScan])

  useEffect(() => {
    const refresh = () => setSession(resolveShowcaseSession({ search: '', now: Date.now(), storage: safeLocalStorage() }))
    const interval = window.setInterval(refresh, SESSION_CHECK_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return session
}

// Keeps this page out of search results and gives the tab a clear title.
function useShowcaseDocumentMeta() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'M1911 in 3D · Trigger3D'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => {
      document.title = previousTitle
      robots.remove()
    }
  }, [])
}

function Brand() {
  return (
    <span className="flex min-w-0 items-center">
      <img alt="Trigger3D" className="showcase-logo-light h-9 w-auto" src={logoForLightTheme} />
      <img alt="Trigger3D" className="showcase-logo-dark h-9 w-auto" src={logoForDarkTheme} />
    </span>
  )
}

function MessageScreen({ title, children }) {
  return (
    <main className="showcase-page grid min-h-dvh place-items-center bg-[var(--page-bg)] px-6 text-[var(--text)]">
      <div className="grid max-w-sm justify-items-center gap-5 text-center">
        <Brand />
        <div className="grid h-16 w-16 place-items-center rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <svg aria-hidden="true" className="h-8 w-8" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2" />
          </svg>
        </div>
        <h1 className="m-0 text-2xl font-black tracking-tight">{title}</h1>
        <p className="m-0 text-sm leading-6 text-[var(--text-muted)]">{children}</p>
      </div>
    </main>
  )
}

function formatMinutes(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60000))
  return `${minutes} min left`
}

function ShowcaseViewer({ remainingMs }) {
  const [introOpen, setIntroOpen] = useState(true)
  const [exploded, setExploded] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [selectedName, setSelectedName] = useState(null)
  const [partsOpen, setPartsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [cooling, runViewAction] = useViewActionCooldown(SHOWCASE_PARTS)

  const visibleParts = useMemo(() => {
    const term = query.trim().toLowerCase()
    return SHOWCASE_PARTS
      .filter((part) => partLabel(part.mesh_name).toLowerCase().includes(term))
      .sort((a, b) => a.display_order - b.display_order)
  }, [query])
  const groups = useMemo(() => [...new Set(visibleParts.map((part) => part.assembly_group))], [visibleParts])
  const selectedPart = SHOWCASE_PARTS.find((part) => part.mesh_name === selectedName)
  const lowTime = remainingMs <= LOW_TIME_MS

  function choosePart(name) {
    setSelectedName(name)
    setPartsOpen(false)
    // Parts are easiest to find and spin when the model is spread out.
    if (!exploded) runViewAction(() => setExploded(true))
  }

  return (
    <main className="showcase-page flex h-dvh flex-col overflow-hidden bg-[var(--page-bg)] text-[var(--text)]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4">
        <Brand />
        <div className="flex items-center gap-2">
          <span className={`showcase-timer ${lowTime ? 'showcase-timer--low' : ''}`} role="timer" aria-live="polite">
            {formatMinutes(remainingMs)}
          </span>
          <ThemeToggle compact />
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <section className="relative min-w-0 flex-1" aria-label="M1911 3D model">
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-[var(--text-muted)]">Loading 3D model…</div>}>
            <FirearmCanvas
              components={SHOWCASE_PARTS}
              exploded={exploded}
              modelUrl={MODEL_URL}
              onSelect={(name) => setSelectedName(name || null)}
              resetKey={resetKey}
              selectedName={selectedName}
            />
          </Suspense>

          <p className="pointer-events-none absolute left-1/2 top-3 m-0 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">
            Drag to rotate · Pinch to zoom · Tap a part
          </p>

          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/90 p-1.5 shadow-lg">
            <button
              aria-label={exploded ? 'Reassemble model' : 'Explode model'}
              aria-pressed={exploded}
              className={`showcase-tool ${exploded ? 'showcase-tool--active' : ''}`}
              disabled={cooling}
              onClick={() => runViewAction(() => setExploded((value) => !value))}
              title={cooling ? 'Please wait…' : exploded ? 'Reassemble' : 'Explode'}
              type="button"
            >
              <AdminIcon className="h-5 w-5" name="explode" />
            </button>
            <button
              aria-label="Reset view"
              className="showcase-tool"
              disabled={cooling}
              onClick={() => runViewAction(() => { setExploded(false); setSelectedName(null); setResetKey((value) => value + 1) })}
              title={cooling ? 'Please wait…' : 'Reset view'}
              type="button"
            >
              <AdminIcon className="h-5 w-5" name="reset" />
            </button>
          </div>

          <div className="absolute inset-x-3 bottom-3 z-10 flex items-end justify-between gap-3">
            {selectedPart ? (
              <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 py-2 pl-4 pr-2 shadow-lg" aria-live="polite">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--showcase-brand-text)]">{groupLabel(selectedPart.assembly_group)}</span>
                  <strong className="block truncate text-base">{partLabel(selectedPart.mesh_name)}</strong>
                </span>
                <button aria-label="Clear selection" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--page-bg)]" onClick={() => setSelectedName(null)} type="button">
                  <AdminIcon name="close" />
                </button>
              </div>
            ) : <span />}
            <button className="showcase-primary shrink-0 lg:hidden" onClick={() => setPartsOpen(true)} type="button">
              Parts ({SHOWCASE_PARTS.length})
            </button>
          </div>
        </section>

        <aside
          aria-label="Parts list"
          className={`${partsOpen ? 'flex' : 'hidden'} showcase-parts fixed inset-x-0 bottom-0 z-30 max-h-[70dvh] flex-col rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] shadow-2xl lg:static lg:z-auto lg:flex lg:max-h-none lg:w-80 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none`}
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
            <h2 className="m-0 text-base font-black">Parts</h2>
            <button aria-label="Close parts list" className="grid h-9 w-9 place-items-center rounded-lg text-[var(--text-muted)] lg:hidden" onClick={() => setPartsOpen(false)} type="button">
              <AdminIcon name="close" />
            </button>
          </div>
          <div className="px-4 pb-3">
            <label className="sr-only" htmlFor="showcase-part-search">Search parts</label>
            <input
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--showcase-brand-ring)]"
              id="showcase-part-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search parts…"
              type="search"
              value={query}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {groups.map((group) => (
              <section className="mb-2" key={group}>
                <h3 className="m-0 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{groupLabel(group)}</h3>
                {visibleParts.filter((part) => part.assembly_group === group).map((part) => (
                  <button
                    aria-pressed={selectedName === part.mesh_name}
                    className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm ${selectedName === part.mesh_name ? 'bg-[var(--showcase-brand-soft)] font-bold text-[var(--showcase-brand-text)]' : 'hover:bg-[var(--page-bg)]'}`}
                    key={part.mesh_name}
                    onClick={() => choosePart(part.mesh_name)}
                    type="button"
                  >
                    {partLabel(part.mesh_name)}
                  </button>
                ))}
              </section>
            ))}
            {!visibleParts.length && <p className="px-3 text-sm text-[var(--text-muted)]">No parts match “{query}”.</p>}
          </div>
          <p className="m-0 border-t border-[var(--border)] px-4 py-3 text-[11px] leading-4 text-[var(--text-muted)]">{DISCLAIMER}</p>
        </aside>
        {partsOpen && <button aria-label="Close parts list" className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setPartsOpen(false)} type="button" />}
      </div>

      {introOpen && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/55 px-5" role="dialog" aria-modal="true" aria-labelledby="showcase-intro-title">
          <div className="grid max-w-sm gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-2xl">
            <h1 className="m-0 text-2xl font-black tracking-tight" id="showcase-intro-title">Meet the M1911 in 3D</h1>
            <p className="m-0 text-sm leading-6 text-[var(--text-muted)]">
              Rotate it, explode it into its parts, and tap any part to see its name. This is the 3D model BS Criminology students use in Trigger3D, built by BS Information Technology students.
            </p>
            <button autoFocus className="showcase-primary w-full" onClick={() => setIntroOpen(false)} type="button">Start exploring</button>
            <p className="m-0 text-[11px] leading-4 text-[var(--text-muted)]">{DISCLAIMER}</p>
          </div>
        </div>
      )}
    </main>
  )
}

export default function ShowcasePage() {
  useShowcaseDocumentMeta()
  const session = useShowcaseSession()

  if (session.status === 'not-started') {
    return <MessageScreen title="Scan the QR code to start">This 3D showcase opens from the QR code at the Trigger3D booth. Scan it with your phone camera to explore the model.</MessageScreen>
  }
  if (session.status === 'expired') {
    return <MessageScreen title="Your demo session has ended">Thanks for exploring! Each visit lasts one hour. Scan the QR code at the booth again to keep exploring.</MessageScreen>
  }
  return <ShowcaseViewer remainingMs={session.remainingMs} />
}
