import { useMemo, useState } from 'react'
import { AdminBadge } from './AdminDesignModal.jsx'
import AdminIcon from './AdminIcon.jsx'

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AdminAuditLogPanel({ dataError, firearms, profiles }) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [page, setPage] = useState(1)
  const perPage = 8
  const events = useMemo(() => [
    ...profiles.map((profile) => ({ id: 'profile-' + profile.id, event: profile.disabled_at ? 'Account archived' : 'Account created', actor: 'System record', record: profile.full_name || profile.email, type: profile.role, reason: '—', date: formatDate(profile.disabled_at || profile.created_at), category: 'account', timestamp: profile.disabled_at || profile.created_at })),
    ...firearms.map((firearm) => ({ id: 'firearm-' + firearm.id, event: 'Firearm uploaded', actor: 'System record', record: firearm.name, type: 'Firearm', reason: '—', date: formatDate(firearm.created_at), category: 'firearm', timestamp: firearm.created_at })),
  ].sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)), [firearms, profiles])
  const filtered = useMemo(() => events.filter((event) => (type === 'all' || event.category === type) && (!query || (event.actor + event.record).toLowerCase().includes(query.toLowerCase()))), [events, query, type])
  const pages = Math.max(1, Math.ceil(filtered.length / perPage))
  const rows = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <section className="admin-audit-page w-full p-6 text-[#172019]">
      <nav className="mb-2 flex gap-1 text-xs text-[#5f6b63]"><span>Admin</span><span>›</span><span>Audit Log</span></nav>
      <h1 className="mb-6 mt-0 text-xl font-semibold">Audit Log</h1>
      {dataError && <div className="mb-4 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{dataError}</div>}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="admin-search-field"><AdminIcon name="search" /><span className="sr-only">Search audit log</span><input className="h-9 w-64 rounded-[7px] border border-[#b8c1bb] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#109d1a]" onChange={(event) => { setQuery(event.target.value); setPage(1) }} placeholder="Search actor or record..." type="search" value={query} /></label>
        <select className="h-9 w-44 rounded-[7px] border border-[#b8c1bb] bg-white px-3 text-sm" onChange={(event) => { setType(event.target.value); setPage(1) }} value={type}><option value="all">All events</option><option value="account">Account events</option><option value="firearm">Firearm events</option></select>
        <span className="flex items-center text-xs text-[#5f6b63] sm:ml-auto">▽ &nbsp;{filtered.length} events</span>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-[#b8c1bb] bg-white">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead><tr className="bg-[#f6f8f7]">{['Event', 'Actor', 'Record', 'Type', 'Reason', 'Date'].map((heading) => <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-[#5f6b63] first:pl-5" key={heading}>{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#b8c1bb]">{rows.map((event) => <tr className="h-[50px] hover:bg-[#f8faf9]" key={event.id}><td className={'pl-5 pr-4 text-xs font-medium ' + (event.event === 'Import error' ? 'text-red-600' : event.event.includes('created') || event.event.includes('restored') || event.event.includes('uploaded') ? 'text-[#109d1a]' : '')}>{event.event}</td><td className="px-4 text-xs">{event.actor}</td><td className="px-4 text-xs">◇ &nbsp;{event.record}</td><td className="px-4"><AdminBadge>{event.type}</AdminBadge></td><td className="max-w-[180px] truncate px-4 text-xs text-[#5f6b63]">{event.reason}</td><td className="whitespace-nowrap px-4 text-xs text-[#5f6b63]">{event.date}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <p className="m-0 p-12 text-center text-sm text-[#5f6b63]">No events found.</p>}
        {pages > 1 && <footer className="flex items-center justify-between border-t border-[#b8c1bb] bg-[#f8faf9] px-5 py-3"><span className="text-xs text-[#5f6b63]">Page {page} of {pages}</span><div className="flex gap-1"><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><button className="rounded-[6px] border border-[#b8c1bb] px-3 py-1.5 text-xs disabled:opacity-40" disabled={page === pages} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></footer>}
      </div>
    </section>
  )
}
