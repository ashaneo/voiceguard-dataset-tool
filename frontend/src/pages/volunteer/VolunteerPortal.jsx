import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import IncomingCallModal from './IncomingCallModal'
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
  const [me, setMe] = useState(null)
  const [incomingCall, setIncomingCall] = useState(null)
  const presenceWsRef = useRef(null)
  const navigate = useNavigate()
  const name = localStorage.getItem('name') || '?'
  const pid  = localStorage.getItem('pid')  || '—'

  useEffect(() => { fetchMe() }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url   = `${proto}//${window.location.host}/api/call/ws/presence?token=${token}`
    const ws    = new WebSocket(url)
    presenceWsRef.current = ws

    ws.onmessage = (e) => {
      let msg
      try { msg = JSON.parse(e.data) } catch (_) { return }
      if (msg.type === 'incoming_call') {
        setIncomingCall(msg)
      } else if (msg.type === 'call_cancelled') {
        setIncomingCall(curr => (curr && curr.room_id === msg.room_id) ? null : curr)
      }
    }
    ws.onclose = () => { presenceWsRef.current = null }

    return () => {
      try { ws.close() } catch (_) {}
      presenceWsRef.current = null
    }
  }, [])

  async function fetchMe() {
    const data = await apiGet('/api/auth/me')
    if (data) setMe(data)
  }

  function handleLogout() { logout() }

  function acceptCall() {
    const c = incomingCall
    setIncomingCall(null)
    if (c) navigate(`/call/${c.room_id}?aid=${c.assignment_id}`)
  }

  function rejectCall() {
    const c = incomingCall
    setIncomingCall(null)
    const ws = presenceWsRef.current
    if (c && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'reject', room_id: c.room_id }))
    }
  }

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
          <div className="user-avatar">{name[0]?.toUpperCase()}</div>
          <div className="user-info">
            <div className="name">{name}</div>
            <div className="pid">{pid}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">⏻</button>
        </div>
      </aside>

      <div className="main">
        <Outlet context={{ me, fetchMe }} />
      </div>

      <IncomingCallModal call={incomingCall} onAccept={acceptCall} onReject={rejectCall} />
    </div>
  )
}
