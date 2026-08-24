import SidebarIcon from '../../components/SidebarIcon.jsx'
import AdminProfileCard from '../admin/AdminProfileCard.jsx'

const items = [
  ['overview', 'dashboard', 'Overview'],
  ['classes', 'classes', 'Classes'],
  ['students', 'classroom', 'Students'],
  ['assessments', 'checklist', 'Assessments'],
  ['results', 'results', 'Results'],
]

export default function FacultySidebar({ activePage, collapsed, onNavigate, onToggle, settings }) {
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-brand">
        <span>Trigger3D</span><small>FACULTY</small>
        <button aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} className="sidebar-toggle" onClick={onToggle} type="button">☰</button>
      </div>
      {!collapsed && <AdminProfileCard roleLabel="Faculty" />}
      <nav aria-label="Faculty dashboard sections" className="admin-navigation">
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
