import AdminProfileCard from './AdminProfileCard.jsx'

const items = [
  ['overview', '⌂', 'Overview'],
  ['accounts', '♙', 'Accounts'],
  ['firearms', '⌁', 'Firearm content'],
  ['imports', '⇧', 'Import bundle'],
  ['layout', '⌘', 'Exploded view'],
]

export default function AdminSidebar({ activePage, collapsed, onNavigate, onToggle }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span>Trigger3D</span><small>ADMIN</small>
        <button aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} className="sidebar-toggle" onClick={onToggle} type="button">☰</button>
      </div>
      {!collapsed && <AdminProfileCard />}
      <nav aria-label="Admin dashboard sections" className="admin-navigation">
        {items.map(([id, icon, label]) => (
          <button className={activePage === id ? 'active' : ''} key={id} onClick={() => onNavigate(id)} type="button">
            <span aria-hidden="true">{icon}</span><b>{label}</b>
          </button>
        ))}
      </nav>
    </aside>
  )
}
