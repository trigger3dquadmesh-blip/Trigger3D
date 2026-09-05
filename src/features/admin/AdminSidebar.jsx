import SidebarIcon from '../../components/SidebarIcon.jsx'
import useAuth from '../../auth/useAuth.js'

const items = [
  ['overview', 'dashboard', 'Dashboard'],
  ['firearms', 'cube', 'Firearms'],
  ['viewer', 'layers', 'Model Viewer'],
  ['accounts', 'classroom', 'Accounts'],
  ['audit', 'audit', 'Audit Log'],
]

export default function AdminSidebar({ activePage, collapsed, onNavigate, onToggle, settings }) {
  const { profile } = useAuth()
  const displayName = profile?.full_name || 'Administrator'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <aside className="admin-sidebar role-sidebar admin-reference-sidebar">
      <div className="admin-sidebar-brand">
        <span className="admin-reference-brand"><span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 3v4m0 10v4M3 12h4m10 0h4" /></svg></span>{collapsed ? null : <b>Trigger3D</b>}</span>
        <button aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} className="sidebar-toggle" onClick={onToggle} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M9 5v14m5-9-2 2 2 2" /></svg></button>
      </div>
      {collapsed ? null : <p className="role-sidebar-label">System Administrator</p>}
      {!collapsed && <section className="admin-profile-card" aria-label="Administrator profile"><div className="admin-avatar-stack"><div className="admin-avatar">{profile?.avatar_url ? <img alt="" src={profile.avatar_url} /> : <span>{initials}</span>}</div></div><strong>{displayName}</strong><span>{profile?.email}</span></section>}
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
