import SidebarIcon from '../../components/SidebarIcon.jsx'
import useAuth from '../../auth/useAuth.js'

const items = [
  ['overview', 'dashboard', 'Dashboard'],
  ['classes', 'classroom', 'My Classes'],
  ['results', 'results', 'My Results'],
]

export default function StudentSidebar({ activePage, collapsed, onNavigate, onToggle, settings }) {
  const { profile } = useAuth()
  const displayName = profile?.full_name || 'Student'
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return (
    <aside className="admin-sidebar role-sidebar admin-reference-sidebar student-reference-sidebar">
      <div className="admin-sidebar-brand">
        <span className="admin-reference-brand"><span aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 3v4m0 10v4M3 12h4m10 0h4" /></svg></span><b>Trigger3D</b></span>
        <button aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'} className="sidebar-toggle" onClick={(event) => { if (event.detail > 0) event.currentTarget.blur(); onToggle() }} type="button"><svg aria-hidden="true" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M9 5v14m5-9-2 2 2 2" /></svg></button>
      </div>
      <p className="role-sidebar-label">Student</p>
      <nav aria-label="Student dashboard sections" className="admin-navigation">
        {items.map(([id, icon, label]) => (
          <button className={activePage === id || (id === 'classes' && activePage === 'class') ? 'active' : ''} key={id} onClick={(event) => { if (event.detail > 0 && window.matchMedia('(min-width: 1025px) and (hover: hover)').matches) event.currentTarget.blur(); onNavigate(id) }} type="button">
            <span><SidebarIcon name={icon} /></span><b>{label}</b>
          </button>
        ))}
      </nav>
      <section aria-label="Student profile" className="admin-profile-card"><div className="admin-avatar-stack"><div className="admin-avatar">{profile?.avatar_url ? <img alt="" src={profile.avatar_url} /> : <span>{initials}</span>}</div></div><strong>{displayName}</strong><span>{profile?.email}</span></section>
      <div className="sidebar-settings">{settings}</div>
    </aside>
  )
}
