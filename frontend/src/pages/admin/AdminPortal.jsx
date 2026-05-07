import { NavLink, Outlet } from 'react-router-dom'
import { logout } from '../../api'

const NAV = [
  { section: 'Overview', items: [{ id: 'dashboard',   icon: '⬛', label: 'Dashboard' }] },
  { section: 'Dataset',  items: [
    { id: 'recordings',  icon: '🎙️', label: 'Recordings' },
    { id: 'scripts',     icon: '📄', label: 'Scripts' },
  ]},
  { section: 'Participants', items: [
    { id: 'volunteers',  icon: '👥', label: 'Volunteers' },
    { id: 'assignments', icon: '🔗', label: 'Assignments' },
  ]},
]

export default function AdminPortal() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">VOICEGUARD</div>
          <div className="subtitle">Admin Portal</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section" style={{ marginTop: section !== 'Overview' ? 8 : 0 }}>{section}</div>
              {items.map(({ id, icon, label }) => (
                <NavLink
                  key={id}
                  to={id}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  <span className="icon">{icon}</span> {label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar" style={{ background: '#3C2A6A' }}>A</div>
          <div className="user-info">
            <div className="name">Admin</div>
            <div className="pid mono">ADMIN</div>
          </div>
          <button className="logout-btn" onClick={logout} title="Sign out">⏻</button>
        </div>
      </aside>

      <div className="main">
        <Outlet />
      </div>
    </div>
  )
}
