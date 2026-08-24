import SidebarIcon from '../../components/SidebarIcon.jsx'
import AdminProfileCard from './AdminProfileCard.jsx'

const items = [
  ['overview', 'dashboard', 'Overview'],
  ['accounts', 'classroom', 'Accounts'],
  ['firearms', 'cube', 'Firearm content'],
  ['imports', 'upload', 'Import bundle'],
  ['layout', 'layers', 'Exploded view'],
]

export default function AdminSidebar({ activePage, collapsed, onNavigate, onToggle, settings }) {
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
            <span><SidebarIcon name={icon} /></span><b>{label}</b>
          </button>
        ))}
      </nav>
      <div className="sidebar-settings">{settings}</div>
    </aside>
  )
}
