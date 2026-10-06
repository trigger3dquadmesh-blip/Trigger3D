import { useEffect, useMemo, useRef, useState } from 'react'
import { AdminBadge } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'
import { getAuditReason } from './audit-log-reasons.js'
import DashboardLoading from '../../components/DashboardLoading.jsx'

function formatDate(value) {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function AcademicYearScopePicker({ activeTerm, latestTerm, onChange, value, years }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const pickerRef = useRef(null)
  const currentYear = activeTerm?.academic_year || latestTerm?.academic_year
  const currentLabel = activeTerm ? `Current · ${currentYear}` : latestTerm ? `Latest · ${currentYear}` : 'Current academic year'
  const labels = { activity: 'All activity', current: currentLabel, all: 'All academic years', system: 'System-wide events', unassigned: 'Legacy events without a term' }
  const normalizedSearch = search.trim().toLowerCase()
  const currentYearMatches = !normalizedSearch || currentYear?.toLowerCase().includes(normalizedSearch)
  const availableYears = years.filter((year) => year !== currentYear && (!normalizedSearch || year.toLowerCase().includes(normalizedSearch)))
  const visibleYears = normalizedSearch ? availableYears : availableYears.slice(0, 5)
  const academicMatchCount = (currentYearMatches && currentYear ? 1 : 0) + visibleYears.length

  useEffect(() => {
    if (!open) return undefined
    function close(event) { if (!pickerRef.current?.contains(event.target)) setOpen(false) }
    function closeWithKeyboard(event) { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', closeWithKeyboard)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', closeWithKeyboard) }
  }, [open])

  function choose(nextValue) {
    onChange(nextValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <div className="admin-audit-scope-picker" ref={pickerRef}>
      <button aria-expanded={open} aria-haspopup="listbox" className="admin-audit-scope-trigger" onClick={() => setOpen((current) => !current)} type="button">
        <span>{labels[value] || value}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg>
      </button>
      {open && <div className="admin-audit-scope-menu">
        <label><AdminIcon name="search" /><span className="sr-only">Search academic years</span><input autoFocus onChange={(event) => setSearch(event.target.value)} placeholder="Search academic year…" type="search" value={search} /></label>
        <div role="listbox">
          {!normalizedSearch && <button aria-selected={value === 'activity'} className={value === 'activity' ? 'selected' : ''} onClick={() => choose('activity')} role="option" type="button">All activity<span>Complete audit history across every scope</span></button>}
          <small>Academic periods</small>
          {normalizedSearch && academicMatchCount > 0 && <p className="admin-audit-search-status" role="status">{academicMatchCount} academic year{academicMatchCount === 1 ? '' : 's'} found — select one to apply.</p>}
          {currentYearMatches && <button aria-selected={value === 'current'} className={value === 'current' ? 'selected' : ''} onClick={() => choose('current')} role="option" type="button">{currentLabel}<span>{normalizedSearch ? 'Select to apply this academic year' : 'Active or most recent period'}</span></button>}
          {visibleYears.map((year, index) => <button aria-selected={value === year} className={value === year ? 'selected' : ''} key={year} onClick={() => choose(year)} role="option" type="button">{year}<span>{normalizedSearch ? 'Select to apply this academic year' : index < 5 ? 'Recent academic year' : 'Historical academic year'}</span></button>)}
          {!normalizedSearch && availableYears.length > 5 && <p>{availableYears.length - 5} older academic years—use search to find one.</p>}
          {normalizedSearch && academicMatchCount === 0 && <p className="admin-audit-search-status" role="status">No academic year matches “{search.trim()}”.</p>}
          {!normalizedSearch && <>
            <button aria-selected={value === 'all'} className={value === 'all' ? 'selected' : ''} onClick={() => choose('all')} role="option" type="button">All academic years<span>Complete term-linked history</span></button>
            <small>Other records</small>
            <button aria-selected={value === 'system'} className={value === 'system' ? 'selected' : ''} onClick={() => choose('system')} role="option" type="button">System-wide events<span>Accounts and firearm library</span></button>
            <button aria-selected={value === 'unassigned'} className={value === 'unassigned' ? 'selected' : ''} onClick={() => choose('unassigned')} role="option" type="button">Legacy events without a term<span>Records created before term tracking</span></button>
          </>}
        </div>
      </div>}
    </div>
  )
}

export default function AdminAuditLogPanel({ academicTerms = [], auditEvents = [], classes = [], dataError, loading = false }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [academicYear, setAcademicYear] = useState('activity')
  const [semester, setSemester] = useState('all')
  const [classId, setClassId] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const perPage = 8
  const activeTerm = academicTerms.find((term) => term.status === 'active')
  const years = useMemo(() => [...new Set(academicTerms.map((term) => term.academic_year))].sort().reverse(), [academicTerms])
  const latestTerm = academicTerms[0]
  const effectiveYear = academicYear === 'current' ? activeTerm?.academic_year || latestTerm?.academic_year || 'all' : academicYear
  const effectiveSemester = semester === 'current' ? activeTerm?.semester || latestTerm?.semester || 'all' : semester
  const otherYears = years.filter((year) => year !== (activeTerm?.academic_year || latestTerm?.academic_year))
  const termById = useMemo(() => new Map(academicTerms.map((term) => [term.id, term])), [academicTerms])
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes])
  const matchingClasses = useMemo(() => classes.filter((item) => {
    const itemTerm = termById.get(item.academic_term_id)
    if (academicYear === 'activity' || academicYear === 'system' || academicYear === 'unassigned') return false
    if (effectiveYear && effectiveYear !== 'all' && itemTerm?.academic_year !== effectiveYear) return false
    if (effectiveSemester && effectiveSemester !== 'all' && itemTerm?.semester !== effectiveSemester) return false
    return true
  }), [academicYear, classes, effectiveSemester, effectiveYear, termById])
  const events = useMemo(() => auditEvents.map((item) => {
    const relatedClassId = item.class_id || (item.entity_type === 'class' ? item.entity_id : null)
    const relatedClass = classById.get(relatedClassId)
    const relatedTerm = termById.get(item.academic_term_id || relatedClass?.academic_term_id)
    const normalizedCategory = item.entity_type === 'profile' ? 'account' : item.entity_type === 'academic_terms' ? 'term' : item.entity_type === 'classes' || item.entity_type === 'class' ? 'class' : item.entity_type
    const eventGroup = ['term', 'class', 'enrollments'].includes(normalizedCategory)
      ? 'academic'
      : ['assessment_releases', 'assessment_attempts'].includes(normalizedCategory)
        ? 'assessment'
        : normalizedCategory === 'account'
          ? 'account'
          : normalizedCategory === 'firearm'
            ? 'content'
            : 'other'
    const typeLabels = { account: 'Account', term: 'Academic term', class: 'Class', enrollments: 'Enrollment', assessment_releases: 'Assessment availability', assessment_attempts: 'Assessment attempt', firearm: 'Firearm content' }
    return { id: item.id, event: item.event_type, actor: item.actor?.full_name || item.actor?.email || 'System', record: item.record_label || 'Unknown record', type: typeLabels[normalizedCategory] || normalizedCategory, reason: getAuditReason(item), date: formatDate(item.created_at), category: normalizedCategory, group: eventGroup, timestamp: item.created_at, academicTermId: relatedTerm?.id || null, academicYear: relatedTerm?.academic_year || '', semester: relatedTerm?.semester || '', classId: relatedClassId, className: relatedClass?.name || '' }
  }), [auditEvents, classById, termById])
  const filtered = useMemo(() => events.filter((event) => {
    const isTrueSystemEvent = !event.academicTermId && ['account', 'firearm'].includes(event.category)
    const isUnassignedLegacyEvent = !event.academicTermId && !isTrueSystemEvent
    const matchesTerm = academicYear === 'activity'
      ? true
      : academicYear === 'system'
      ? isTrueSystemEvent
      : academicYear === 'unassigned'
        ? isUnassignedLegacyEvent
        : Boolean(event.academicTermId)
          && (effectiveYear === 'all' || event.academicYear === effectiveYear)
          && (effectiveSemester === 'all' || !effectiveSemester || event.semester === effectiveSemester)
    const matchesClass = classId === 'all' || event.classId === classId
    const matchesType = type === 'all' || event.group === type
    const matchesQuery = !query || `${event.event} ${event.actor} ${event.record} ${event.reason} ${event.className} ${event.academicYear} ${event.semester}`.toLowerCase().includes(query.toLowerCase())
    return matchesTerm && matchesClass && matchesType && matchesQuery
  }), [academicYear, classId, effectiveSemester, effectiveYear, events, query, type])
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const rows = filtered.slice((page - 1) * perPage, page * perPage)

  function changeAcademicScope(nextScope) {
    setAcademicYear(nextScope)
    setSemester(['activity', 'all', 'system', 'unassigned'].includes(nextScope) ? 'all' : 'current')
    setClassId('all')
    setPage(1)
    setExpandedId(null)
  }

  if (loading) return <section className="admin-audit-page w-full p-6"><DashboardLoading label="Loading audit log…" /></section>

  return (
    <section className="admin-audit-page w-full p-6 text-[#172019]">
      <nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Audit Log</span></nav>
      <div className="admin-audit-heading"><div><h1>Audit Log</h1><p>Review activity by academic year, semester, and class while preserving the complete system history.</p></div><span>{activeTerm ? `${activeTerm.semester}, AY ${activeTerm.academic_year}` : 'No active term'}</span></div>
      {dataError && <div className="alert alert-error" role="alert">{dataError}</div>}
      <div className="admin-audit-term-filters">
        <div className="admin-audit-term-filter"><span>Academic Year / Scope</span><AcademicYearScopePicker activeTerm={activeTerm} latestTerm={latestTerm} onChange={changeAcademicScope} value={academicYear} years={[activeTerm?.academic_year || latestTerm?.academic_year, ...otherYears].filter(Boolean)} /></div>
        <label><span>Semester</span><select aria-label="Filter audit log by semester" disabled={academicYear === 'activity' || academicYear === 'system' || academicYear === 'unassigned'} onChange={(event) => { setSemester(event.target.value); setClassId('all'); setPage(1); setExpandedId(null) }} value={semester}><option value="current">Current semester</option><option value="all">All semesters</option><option value="1st Semester">1st Semester</option><option value="2nd Semester">2nd Semester</option></select></label>
        <label><span>Class / Section</span><select aria-label="Filter audit log by class" disabled={academicYear === 'activity' || academicYear === 'system' || academicYear === 'unassigned'} onChange={(event) => { setClassId(event.target.value); setPage(1); setExpandedId(null) }} value={classId}><option value="all">All classes / sections</option>{matchingClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="admin-search-field"><AdminIcon name="search" /><span className="sr-only">Search audit log</span><input className="h-9 w-72 rounded-[7px] border border-[#b8c1bb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => { setQuery(event.target.value); setPage(1); setExpandedId(null) }} placeholder="Search event, person, class, or record..." type="search" value={query} /></label>
        <label className="admin-audit-filter"><span className="sr-only">Filter audit events</span><select className="h-9 w-52 rounded-[7px] border border-[#b8c1bb] bg-white px-3 pr-9 text-sm" onChange={(event) => { setType(event.target.value); setPage(1); setExpandedId(null) }} value={type}><option value="all">All events</option><option value="academic">Academic / class activity</option><option value="assessment">Assessment activity</option><option value="account">Accounts &amp; access</option><option value="content">Firearm content</option></select><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></label>
        <span className="flex items-center text-xs text-[#5f6b63] sm:ml-auto">▽ &nbsp;{filtered.length} events</span>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[#b8c1bb] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="bg-[#f6f8f7]">{['Event', 'Actor', 'Record', 'Term / Class', 'Type', 'Reason', 'Date'].map((heading) => <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6b63] first:pl-5" key={heading}>{heading}</th>)}</tr></thead>
          {rows.map((event) => {
            const isExpanded = expandedId === event.id
            const detailsId = `audit-details-${event.id}`
            const scopeLabel = event.academicYear ? `${event.semester}, AY ${event.academicYear}` : ['account', 'firearm'].includes(event.category) ? 'System-wide' : 'Legacy · No term assigned'
            return <tbody className={`admin-audit-entry${isExpanded ? ' open' : ''}`} key={event.id}><tr className="admin-audit-summary-row h-[50px] hover:bg-[#f8faf9]"><td className={'pl-5 pr-4 text-xs font-medium ' + (event.event === 'Import error' ? 'text-red-600' : event.event.includes('created') || event.event.includes('restored') || event.event.includes('uploaded') ? 'text-[#109d1a]' : '')}><span className="admin-audit-event-summary"><span>{event.event}</span><small>{event.actor}</small></span><button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${event.event}`} className="admin-audit-expand" onClick={() => setExpandedId((current) => current === event.id ? null : event.id)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button></td><td className="px-4 text-xs">{event.actor}</td><td className="px-4 text-xs">◇ &nbsp;{event.record}</td><td className="px-4 text-xs"><strong>{scopeLabel}</strong><small className="admin-audit-class-label">{event.className || 'No class'}</small></td><td className="px-4"><AdminBadge>{event.type}</AdminBadge></td><td className="max-w-[180px] truncate px-4 text-xs text-[#5f6b63]" title={event.reason}>{event.reason}</td><td className="whitespace-nowrap px-4 text-xs text-[#5f6b63]">{event.date}</td></tr><tr className="admin-audit-mobile-details" id={detailsId}><td colSpan="7"><dl><div><dt>Actor</dt><dd>{event.actor}</dd></div><div><dt>Record</dt><dd>{event.record}</dd></div><div><dt>Term</dt><dd>{scopeLabel}</dd></div><div><dt>Class</dt><dd>{event.className || 'No class'}</dd></div><div><dt>Type</dt><dd>{event.type}</dd></div><div><dt>Reason</dt><dd>{event.reason}</dd></div><div><dt>Date</dt><dd>{event.date}</dd></div></dl></td></tr></tbody>
          })}
        </table>
        {rows.length === 0 && <div className="admin-audit-empty">
          <strong>{query ? `No results for “${query}”` : 'No activity in this scope'}</strong>
          <p>{query
            ? 'Try another keyword or search across All activity. You can search event names such as “Account updated” or “Firearm updated,” a person, class, or record.'
            : academicYear === 'activity'
              ? 'No audit activity has been recorded yet.'
              : 'This selection only includes events linked to this scope. Older records may be under Legacy events, while account and firearm changes are System-wide.'}</p>
          <div>
            {query && <button onClick={() => { setQuery(''); setPage(1) }} type="button">Clear search</button>}
            {academicYear !== 'activity' && <button className="primary" onClick={() => changeAcademicScope('activity')} type="button">Show all activity</button>}
          </div>
        </div>}
        {pages > 1 && <footer className="flex items-center justify-between border-t border-[#b8c1bb] bg-[#f8faf9] px-5 py-3"><span className="text-xs text-[#5f6b63]">Page {page} of {pages}</span><div className="flex gap-1"><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === pages} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></footer>}
      </div>
    </section>
  )
}
