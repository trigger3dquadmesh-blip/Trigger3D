import SidebarIcon from '../../components/SidebarIcon.jsx'
import AdminProfileCard from '../admin/AdminProfileCard.jsx'

const items = [
  ['overview', 'dashboard', 'Overview'],
  ['enrollment', 'classroom', 'Class enrollment'],
  ['models', 'cube', '3D models'],
  ['results', 'results', 'Your results'],
]

export default function StudentSidebar({ activePage, collapsed, onNavigate, onToggle, settings }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span>Trigger3D</span><small>STUDENT</small>
        <button aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} className="sidebar-toggle" onClick={onToggle} type="button">☰</button>
      </div>
      {!collapsed && <AdminProfileCard roleLabel="Student" />}
      <nav aria-label="Student dashboard sections" className="admin-navigation">
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
