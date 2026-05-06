import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Assignments from './Assignments'
import Recordings from './Recordings'
import Guide from './Guide'
import Consent from './Consent'
import About from './About'
import Account from './Account'
import { apiGet, logout } from '../../api'

const NAV = [
  { section: 'My Work', items: [
    { id: 'assignments', icon: '📋', label: 'My Assignments' },
    { id: 'recordings',  icon: '🎙️', label: 'My Recordings' },
  ]},
  { section: 'Resources', items: [
    { id: 'guide',   icon: '📖', label: 'Recording Guide' },
    { id: 'consent', icon: '📝', label: 'Consent Agreement' },
    { id: 'about',   icon: '🔬', label: 'About the Research' },
  ]},
  { section: 'Account', items: [
    { id: 'account', icon: '🔑', label: 'Change Password' },
  ]},
]

export default function VolunteerPortal() {
  const [page, setPage] = useState('assignments')
  const [me, setMe] = useState(null)
  const navigate = useNavigate()
  const name = localStorage.getItem('name') || '?'
  const pid  = localStorage.getItem('pid')  || '—'

  useEffect(() => { fetchMe() }, [])

  async function fetchMe() {
    const data = await apiGet('/api/auth/me')
    if (data) setMe(data)
  }

  function handleLogout() { logout() }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="wordmark">VOICEGUARD</div>
          <div className="subtitle">Volunteer Portal</div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(({ section, items }) => (
            <div key={section}>
              <div className="nav-section" style={{ marginTop: section !== 'My Work' ? 12 : 0 }}>{section}</div>
              {items.map(({ id, icon, label }) => (
                <div key={id} className={`nav-item${page === id ? ' active' : ''}`} onClick={() => setPage(id)}>
                  <span className="icon">{icon}</span> {label}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-avatar">{name[0]?.toUpperCase()}</div>
          <div className="user-info">
            <div className="name">{name}</div>
            <div className="pid">{pid}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">⏻</button>
        </div>
      </aside>

      <div className="main">
        {page === 'assignments' && <Assignments me={me} onConsentUpdate={fetchMe} />}
        {page === 'recordings'  && <Recordings />}
        {page === 'guide'       && <Guide />}
        {page === 'consent'     && <Consent me={me} onConsentUpdate={fetchMe} />}
        {page === 'about'       && <About />}
        {page === 'account'     && <Account />}
      </div>
    </div>
  )
}
