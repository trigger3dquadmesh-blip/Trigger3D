function DashboardIcon({ name, className = 'h-4 w-4' }) {
  const paths = {
    accounts: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    firearms: <><path d="m21 8-9 5-9-5 9-5 9 5Z" /><path d="m3 8 9 5 9-5v8l-9 5-9-5V8Z" /><path d="M12 13v8" /></>,
    classes: <><path d="M3 21V7l9-4 9 4v14" /><path d="M9 21v-6h6v6M7 9h2m6 0h2M7 12h2m6 0h2" /></>,
    assessments: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2h6v2M9 9h6m-6 4h6m-6 4h4" /></>,
    alert: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5m0 3h.01" /></>,
    account: <><path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M19 8v6m3-3h-6" /></>,
  }

  return <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">{paths[name]}</svg>
}

function RoleBadge({ children }) {
  return <span className="shrink-0 rounded-full border border-[#b8c1bb] bg-[#edf0ee] px-2 py-0.5 text-[11px] leading-4 text-[#172019]">{children}</span>
}

function formatDate(value) {
  if (!value) return 'Date unavailable'
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export default function AdminOverviewPanel({ data, error, loading, onNavigate }) {
  const archivedProfiles = data.profiles.filter((profile) => profile.disabled_at)
  const readyFirearms = data.firearms.filter((firearm) => firearm.status === 'ready')
  const activeClasses = data.classes.filter((item) => !item.archived_at)
  const recentAccountEvents = data.auditEvents.filter((item) => item.entity_type === 'profile').slice(0, 4)
  const recentFirearmEvents = data.auditEvents.filter((item) => item.entity_type === 'firearm').slice(0, 3)
  const activeProfiles = data.profiles.filter((profile) => !profile.disabled_at)
  const roleCounts = ['student', 'faculty', 'admin'].map((role) => ({ role, count: activeProfiles.filter((profile) => profile.role === role).length }))
  const draftFirearms = data.firearms.filter((firearm) => firearm.status !== 'ready').length
  const archivedClasses = data.classes.length - activeClasses.length
  const inProgressAttempts = (data.attempts || []).filter((attempt) => attempt.status !== 'submitted').length
  const latestActivity = data.auditEvents[0]?.created_at
  const stats = [
    { label: 'Total Accounts', value: data.profiles.length, detail: archivedProfiles.length + ' archived', icon: 'accounts' },
    { label: 'Active Firearms', value: readyFirearms.length, detail: data.firearms.length + ' total', icon: 'firearms' },
    { label: 'Active Classes', value: activeClasses.length, detail: data.classes.length + ' total', icon: 'classes' },
    { label: 'Submitted Assessments', value: data.assessmentCount, detail: 'Recorded results', icon: 'assessments' },
  ]

  return (
    <section className="admin-overview-page w-full p-6 text-[#172019]" aria-labelledby="admin-overview-title">
      <nav className="mb-2 flex items-center gap-1 text-xs text-[#5f6b63]" aria-label="Breadcrumb">
        <span>Admin</span><span className="text-[#9ca69f]">›</span><span>Dashboard</span>
      </nav>
      <h1 className="mb-6 text-xl font-semibold leading-none tracking-[-0.02em]" id="admin-overview-title">System Overview</h1>

      {error && <div className="mb-5 rounded-[7px] border border-red-300 bg-red-50 px-4 py-3 text-xs text-red-700" role="alert">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <article className="flex min-h-[136px] flex-col gap-3 rounded-[10px] border border-[#b8c1bb] bg-white p-5" key={stat.label}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-[#5f6b63]">{stat.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#edf0ee] text-[#5f6b63]"><DashboardIcon name={stat.icon} /></span>
            </div>
            <div className="mt-auto">
              <strong className="block text-2xl font-semibold leading-none">{loading ? '—' : stat.value}</strong>
              {stat.detail && <span className="mt-1 block text-xs text-[#5f6b63]">{stat.detail}</span>}
            </div>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-[10px] border border-[#b8c1bb] bg-white lg:col-span-2">
          <header className="flex min-h-[53px] items-center justify-between border-b border-[#b8c1bb] px-5 py-4">
            <h2 className="text-sm font-semibold">Recent Account Activity</h2>
            <button className="flex items-center gap-1 border-0 bg-transparent text-xs text-[#109d1a]" onClick={() => onNavigate('accounts')} type="button">Manage <span aria-hidden="true">›</span></button>
          </header>
          <div className="divide-y divide-[#b8c1bb]">
            {recentAccountEvents.map((item) => (
              <div className="flex min-h-[59px] items-start gap-3 px-5 py-3" key={item.id}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf0ee] text-[#5f6b63]"><DashboardIcon className="h-[13px] w-[13px]" name="account" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-4"><span className="font-medium">{item.record_label}</span>{' '}<span className="text-[#5f6b63]">{item.event_type}</span></p>
                  <p className="mt-0.5 text-[11px] leading-4 text-[#5f6b63]">{formatDate(item.created_at)}</p>
                </div>
                <RoleBadge>Account</RoleBadge>
              </div>
            ))}
            {!loading && recentAccountEvents.length === 0 && <p className="m-0 p-5 text-xs text-[#5f6b63]">No account records found.</p>}
          </div>
        </section>

        <section className="self-start overflow-hidden rounded-[10px] border border-[#b8c1bb] bg-white">
          <header className="flex min-h-[53px] items-center justify-between border-b border-[#b8c1bb] px-5 py-4">
            <h2 className="text-sm font-semibold">Firearm Activity</h2>
            <button className="flex items-center gap-1 border-0 bg-transparent text-xs text-[#109d1a]" onClick={() => onNavigate('firearms')} type="button">Manage <span aria-hidden="true">›</span></button>
          </header>
          <div className="divide-y divide-[#b8c1bb]">
            {recentFirearmEvents.map((item) => (
              <div className="flex min-h-[74px] items-start gap-3 px-5 py-3" key={item.id}>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#edf0ee] text-[#5f6b63]"><DashboardIcon className="h-[13px] w-[13px]" name="firearms" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-4">{item.record_label}</p>
                  <p className="text-[11px] leading-4 text-[#109d1a]">{item.event_type}</p>
                  <p className="text-[11px] leading-4 text-[#5f6b63]">{formatDate(item.created_at)}</p>
                </div>
              </div>
            ))}
            {!loading && recentFirearmEvents.length === 0 && <p className="m-0 p-5 text-xs text-[#5f6b63]">No firearm records found.</p>}
          </div>
        </section>
      </div>

      <div className="admin-overview-insights mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="admin-overview-insight-card">
          <header><div><h2>Active Account Breakdown</h2><p>Current users by assigned role</p></div><button onClick={() => onNavigate('accounts')} type="button">View accounts <span aria-hidden="true">›</span></button></header>
          <dl>{roleCounts.map((item) => <div key={item.role}><dt><span className="admin-overview-role-dot" />{item.role}</dt><dd>{loading ? '—' : item.count}</dd></div>)}</dl>
          <footer><span>Archived accounts</span><strong>{loading ? '—' : archivedProfiles.length}</strong></footer>
        </section>

        <section className="admin-overview-insight-card">
          <header><div><h2>Operational Status</h2><p>Live content and activity indicators</p></div><button onClick={() => onNavigate('audit')} type="button">View audit log <span aria-hidden="true">›</span></button></header>
          <dl>
            <div><dt>Firearm components</dt><dd>{loading ? '—' : data.componentCount}</dd></div>
            <div><dt>Firearms not ready</dt><dd>{loading ? '—' : draftFirearms}</dd></div>
            <div><dt>Archived classes</dt><dd>{loading ? '—' : archivedClasses}</dd></div>
            <div><dt>Unsubmitted attempts</dt><dd>{loading ? '—' : inProgressAttempts}</dd></div>
          </dl>
          <footer><span>Latest recorded activity</span><strong>{loading ? 'Loading…' : formatDate(latestActivity)}</strong></footer>
        </section>
      </div>
    </section>
  )
}
