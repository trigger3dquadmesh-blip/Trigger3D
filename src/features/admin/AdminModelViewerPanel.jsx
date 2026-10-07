import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import AdminIcon from './AdminIcon.jsx'
import { modelCreditHref } from './import/firearm-metadata.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'
import { getFirearmModelUrl } from '../shared/firearm-model-url.js'
import { getBundledFirearmComponents } from '../shared/bundled-firearm-components.js'

const loadFirearmCanvas = () => import('../student/viewer/FirearmCanvas.jsx')
const FirearmCanvas = lazy(loadFirearmCanvas)

export default function AdminModelViewerPanel({ dataLoading = false, firearms, headerActions = null, headerLeading = null, initialFirearmId = '', lockSelection = false }) {
  const [firearmId, setFirearmId] = useState(initialFirearmId)
  const [details, setDetails] = useState(null)
  const [components, setComponents] = useState([])
  const [modelUrl, setModelUrl] = useState('')
  const [selectedName, setSelectedName] = useState(null)
  const [tab, setTab] = useState('components')
  const [query, setQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const [exploded, setExploded] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const activeFirearmId = firearmId || initialFirearmId || firearms[0]?.id || ''
  const suppliedFirearm = firearms.find((item) => item.id === activeFirearmId)

  useEffect(() => {
    if (!activeFirearmId) return undefined
    let current = true
    async function load() {
      setLoading(true)
      setError('')
      setSelectedName(null)
      setModelUrl('')
      void loadFirearmCanvas()
      const suppliedModelUrl = suppliedFirearm
        ? getFirearmModelUrl(suppliedFirearm.glb_storage_path, suppliedFirearm.identifier, suppliedFirearm.name)
        : null
      const [firearmResult, componentsResult] = await Promise.all([
        suppliedFirearm
          ? Promise.resolve({ data: suppliedFirearm, error: null })
          : supabase.from('firearms').select('id, identifier, name, caliber, description, firearm_type, tutorial_url, model_credit, status, created_at, glb_storage_path').eq('id', activeFirearmId).single(),
        supabase.from('firearm_components').select('id, mesh_name, category, purpose, description, display_order, explode_x, explode_y, explode_z, explode_order, assembly_group').eq('firearm_id', activeFirearmId).order('display_order'),
      ])
      if (!current) return
      if (firearmResult.error) {
        setError(firearmResult.error.message)
        setLoading(false)
        return
      }
      try {
        const databaseComponents = componentsResult.error ? [] : (componentsResult.data ?? [])
        const resolvedComponents = databaseComponents.length
          ? databaseComponents
          : await getBundledFirearmComponents(firearmResult.data.identifier, firearmResult.data.name)
        const signedUrl = await (suppliedModelUrl || getFirearmModelUrl(firearmResult.data.glb_storage_path, firearmResult.data.identifier, firearmResult.data.name))
        if (!current) return
        setDetails(firearmResult.data)
        setComponents(resolvedComponents)
        setModelUrl(signedUrl)
      } catch (loadError) {
        if (current) setError(loadError.message)
      }
      if (current) setLoading(false)
    }
    void load()
    return () => { current = false }
  }, [activeFirearmId, suppliedFirearm])

  const selected = components.find((item) => item.mesh_name === selectedName)
  const visible = components.filter((item) => item.mesh_name.replaceAll('_', ' ').toLowerCase().includes(query.toLowerCase()))
  const groups = useMemo(() => [...new Set(visible.map((item) => item.assembly_group || item.category || 'Components'))], [visible])
  const creditHref = modelCreditHref(details?.model_credit || '')

  function choose(name) {
    setSelectedName(name)
    setTab('details')
  }

  if (dataLoading) return <section className="admin-live-model-viewer p-6"><DashboardLoading label="Loading firearms…" /></section>

  return (
    <section className="admin-live-model-viewer flex h-[calc(100dvh-54px)] flex-col overflow-hidden bg-[#f5f7f6] p-6 text-[#172019]">
      <header className="flex h-11 shrink-0 items-center gap-3 border border-[#b8c1bb] bg-white px-4">
        {headerLeading}
        {!lockSelection && <div className="relative"><button aria-expanded={pickerOpen} aria-haspopup="listbox" className="flex h-8 min-w-[230px] items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-card)] px-3 text-left text-sm font-semibold text-[var(--admin-text)] hover:border-[#109d1a]" disabled={!activeFirearmId} onClick={() => setPickerOpen((value) => !value)} type="button"><AdminIcon className="h-4 w-4 shrink-0 text-[#109d1a]" name="cube" /><span className="min-w-0 flex-1 truncate">{details?.name || firearms.find((item) => item.id === activeFirearmId)?.name || 'Choose a firearm'}</span><AdminIcon className={'h-3.5 w-3.5 shrink-0 transition-transform ' + (pickerOpen ? 'rotate-180' : '')} name="chevronDown" /></button>{pickerOpen && <div className="absolute left-0 top-full z-30 mt-1 min-w-[280px] overflow-hidden rounded-[10px] border border-[var(--admin-border)] bg-[var(--admin-card)] py-1 shadow-xl" role="listbox">{firearms.map((item) => <button aria-selected={item.id === activeFirearmId} className={'grid w-full gap-0.5 px-3 py-2 text-left hover:bg-[var(--admin-muted-surface)] ' + (item.id === activeFirearmId ? 'text-[#109d1a]' : 'text-[var(--admin-text)]')} key={item.id} onClick={() => { setFirearmId(item.id); setPickerOpen(false) }} role="option" type="button"><strong className="text-sm">{item.name}</strong><span className="text-xs text-[var(--admin-muted)]">{item.caliber || 'Caliber not provided'} · {item.identifier}</span></button>)}</div>}</div>}
        <div className="ml-auto flex items-center gap-2">{headerActions}<button aria-label={panelOpen ? 'Close information panel' : 'Show information panel'} className="viewer-panel-toggle grid h-8 w-8 place-items-center rounded-lg text-[var(--admin-muted)] hover:bg-[var(--admin-muted-surface)] hover:text-[var(--admin-text)]" onClick={() => setPanelOpen((value) => !value)} type="button"><AdminIcon name={panelOpen ? 'close' : 'panelOpen'} /></button></div>
      </header>
      {!activeFirearmId ? <div className="grid flex-1 place-items-center border border-[#b8c1bb] bg-[#171717] text-sm text-[#aeb8b2]">No uploaded firearm models are available.</div> : error ? <div className="grid flex-1 place-items-center border border-red-300 bg-red-50 p-6 text-sm text-red-700">{error}</div> : <div className="flex min-h-0 flex-1 border-x border-b border-[#b8c1bb]">
        <div className="relative min-w-0 flex-1 overflow-hidden bg-[#171717]">
          {loading || !modelUrl ? <DashboardLoading className="viewer-model-preparing" label={`Loading ${details?.name || '3D model'}…`} /> : <div className="admin-live-viewer-canvas h-full"><Suspense fallback={<DashboardLoading className="viewer-model-preparing" label="Preparing 3D viewer…" />}><FirearmCanvas components={components} exploded={exploded} modelUrl={modelUrl} onSelect={(name) => name ? choose(name) : setSelectedName(null)} resetKey={resetKey} selectedName={selectedName} /></Suspense></div>}
          <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#aab3ae] bg-[#d7dad8]/90 p-1.5 text-[#46534c] shadow"><button aria-label="Toggle exploded view" className={'grid h-10 w-10 place-items-center rounded-lg hover:bg-white/70 ' + (exploded ? 'bg-[#109d1a] text-white' : '')} onClick={() => setExploded((value) => !value)} title={exploded ? 'Reassemble model' : 'Exploded view'} type="button"><AdminIcon className="h-[18px] w-[18px]" name="explode" /></button><button aria-label="Reset model view" className="grid h-10 w-10 place-items-center rounded-lg hover:bg-white/70" onClick={() => { setExploded(false); setSelectedName(null); setResetKey((value) => value + 1) }} title="Reset view" type="button"><AdminIcon className="h-[18px] w-[18px]" name="reset" /></button></div>
        </div>
        <aside className={'min-h-0 shrink-0 overflow-hidden bg-white transition-[width] ' + (panelOpen ? 'w-[300px] border-l border-[#b8c1bb]' : 'w-0')}>
          {panelOpen && <div className="flex h-full flex-col"><nav className="grid h-9 shrink-0 grid-cols-2 border-b border-[#b8c1bb]">{[['components', 'Components'], ['details', 'Details']].map(([id, label]) => <button className={'text-xs font-semibold ' + (tab === id ? 'border-b-2 border-[#109d1a] text-[#109d1a]' : 'text-[#5f6b63]')} key={id} onClick={() => setTab(id)} type="button">{label}</button>)}</nav>
            {tab === 'components' ? <div className="flex min-h-0 flex-1 flex-col"><div className="px-3 pb-2 pt-3"><input className="h-9 w-full rounded-md border border-transparent bg-[#edf0ee] px-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => setQuery(event.target.value)} placeholder="Search parts..." type="search" value={query} /></div><div className="min-h-0 flex-1 overflow-y-auto pb-2">{groups.map((group) => <section className="mb-1" key={group}><h2 className="mb-1 mt-0 px-4 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7f8982]">{group}</h2><div className="px-2">{visible.filter((item) => (item.assembly_group || item.category || 'Components') === group).map((component) => <button className={'mb-px w-full rounded-md px-3 py-2 text-left text-[13px] ' + (selectedName === component.mesh_name ? 'bg-green-50 font-medium text-[#109d1a]' : 'hover:bg-[#edf0ee]')} key={component.id} onClick={() => choose(component.mesh_name)} type="button">{component.mesh_name.replaceAll('_', ' ')}</button>)}</div></section>)}</div></div> : <div className="h-full overflow-y-auto">{selected ? <div className="flex h-full flex-col gap-5 p-5"><div><p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#7f8982]">{selected.assembly_group || selected.category}</p><h2 className="m-0 text-lg font-bold capitalize leading-6">{selected.mesh_name.replaceAll('_', ' ')}</h2></div><div><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#7f8982]">Description</h3><p className="m-0 text-sm leading-6">{selected.description || 'No description provided.'}</p></div><div><h3 className="mb-2 text-xs font-bold uppercase tracking-[0.08em] text-[#7f8982]">Function</h3><p className="m-0 text-sm leading-6">{selected.purpose || 'No function provided.'}</p></div></div> : <div className="admin-firearm-details"><span className="admin-firearm-details-icon">ⓘ</span><div><strong>{details?.name || 'Firearm details'}</strong><p>{details?.description || 'No firearm description provided.'}</p></div>{details?.model_credit && <p className="admin-model-credit"><strong>Model source / credits:</strong> {creditHref ? <a href={creditHref} rel="noreferrer" target="_blank">{details.model_credit}</a> : <span>{details.model_credit}</span>}</p>}{details?.tutorial_url && <a href={details.tutorial_url} rel="noreferrer" target="_blank"><AdminIcon name="play" /> Watch YouTube tutorial</a>}<dl>{[['Identifier', details?.identifier], ['Classification', details?.firearm_type?.replace('_', ' ')], ['Caliber', details?.caliber], ['Status', details?.status], ['Parts', components.length]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Not available'}</dd></div>)}</dl><small>Select a component to view its description and function.</small></div>}</div>}
          </div>}
        </aside>
      </div>}
    </section>
  )
}
