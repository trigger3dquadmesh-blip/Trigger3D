import { useMemo, useState } from 'react'
import { AdminBadge } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AdminAuditLogPanel({ auditEvents = [], dataError }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState(null)
  const perPage = 8
  const events = useMemo(() => auditEvents.map((item) => ({ id: item.id, event: item.event_type, actor: item.actor?.full_name || item.actor?.email || 'System', record: item.record_label || 'Unknown record', type: item.entity_type === 'profile' ? 'Account' : item.entity_type, reason: item.reason?.trim() || 'No reason recorded', date: formatDate(item.created_at), category: item.entity_type === 'profile' ? 'account' : item.entity_type, timestamp: item.created_at })), [auditEvents])
  const filtered = useMemo(() => events.filter((event) => (type === 'all' || event.category === type) && (!query || `${event.event} ${event.actor} ${event.record} ${event.reason}`.toLowerCase().includes(query.toLowerCase()))), [events, query, type])
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const rows = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <section className="admin-audit-page w-full p-6 text-[#172019]">
      <nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Audit Log</span></nav>
      <h1 className="mb-6 mt-0 text-xl font-semibold">Audit Log</h1>
      {dataError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{dataError}</div>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="admin-search-field"><AdminIcon name="search" /><span className="sr-only">Search audit log</span><input className="h-9 w-64 rounded-[7px] border border-[#b8c1bb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => { setQuery(event.target.value); setPage(1); setExpandedId(null) }} placeholder="Search actor or record..." type="search" value={query} /></label>
        <label className="admin-audit-filter"><span className="sr-only">Filter audit events</span><select className="h-9 w-44 rounded-[7px] border border-[#b8c1bb] bg-white px-3 pr-9 text-sm" onChange={(event) => { setType(event.target.value); setPage(1); setExpandedId(null) }} value={type}><option value="all">All events</option><option value="account">Account events</option><option value="firearm">Firearm events</option><option value="class">Class events</option></select><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></label>
        <span className="flex items-center text-xs text-[#5f6b63] sm:ml-auto">▽ &nbsp;{filtered.length} events</span>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[#b8c1bb] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="bg-[#f6f8f7]">{['Event', 'Actor', 'Record', 'Type', 'Reason', 'Date'].map((heading) => <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6b63] first:pl-5" key={heading}>{heading}</th>)}</tr></thead>
          {rows.map((event) => {
            const isExpanded = expandedId === event.id
            const detailsId = `audit-details-${event.id}`
            return <tbody className={`admin-audit-entry${isExpanded ? ' open' : ''}`} key={event.id}><tr className="admin-audit-summary-row h-[50px] hover:bg-[#f8faf9]"><td className={'pl-5 pr-4 text-xs font-medium ' + (event.event === 'Import error' ? 'text-red-600' : event.event.includes('created') || event.event.includes('restored') || event.event.includes('uploaded') ? 'text-[#109d1a]' : '')}><span className="admin-audit-event-summary"><span>{event.event}</span><small>{event.actor}</small></span><button aria-controls={detailsId} aria-expanded={isExpanded} aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${event.event}`} className="admin-audit-expand" onClick={() => setExpandedId((current) => current === event.id ? null : event.id)} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" /></svg></button></td><td className="px-4 text-xs">{event.actor}</td><td className="px-4 text-xs">◇ &nbsp;{event.record}</td><td className="px-4"><AdminBadge>{event.type}</AdminBadge></td><td className="max-w-[180px] truncate px-4 text-xs text-[#5f6b63]" title={event.reason}>{event.reason}</td><td className="whitespace-nowrap px-4 text-xs text-[#5f6b63]">{event.date}</td></tr><tr className="admin-audit-mobile-details" id={detailsId}><td colSpan="6"><dl><div><dt>Actor</dt><dd>{event.actor}</dd></div><div><dt>Record</dt><dd>{event.record}</dd></div><div><dt>Type</dt><dd>{event.type}</dd></div><div><dt>Reason</dt><dd>{event.reason}</dd></div><div><dt>Date</dt><dd>{event.date}</dd></div></dl></td></tr></tbody>
          })}
        </table>
        {rows.length === 0 && <p className="m-0 p-12 text-center text-sm text-[#5f6b63]">No events found.</p>}
        {pages > 1 && <footer className="flex items-center justify-between border-t border-[#b8c1bb] bg-[#f8faf9] px-5 py-3"><span className="text-xs text-[#5f6b63]">Page {page} of {pages}</span><div className="flex gap-1"><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === pages} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></footer>}
      </div>
    </section>
  )
}
