import { useState, useEffect } from 'react'
import { apiGet } from '../../api'

export default function Dashboard() {
  const [stats, setStats]   = useState(null)
  const [recent, setRecent] = useState([])

  useEffect(() => { load() }, [])

  async function load() {
    const [s, r] = await Promise.all([
      apiGet('/api/admin/stats'),
      apiGet('/api/admin/recordings?status=pending'),
    ])
    if (s) setStats(s)
    if (r) setRecent(r.slice(0, 5))
  }

  if (!stats) return (
    <>
      <div className="topbar"><div><div className="page-title">Dashboard</div></div></div>
      <div className="content" style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>
    </>
  )

  const total = (stats.class_balance.vishing + stats.class_balance.benign) || 1
  const vPct  = Math.round(stats.class_balance.vishing / total * 100)
  const bPct  = 100 - vPct

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Dataset collection overview</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
        </div>
      </div>
      <div className="content">
        <div className="stat-grid">
          <div className="stat-card blue"><div className="stat-label">Volunteers</div><div className="stat-value">{stats.volunteers}</div></div>
          <div className="stat-card"><div className="stat-label">Total recordings</div><div className="stat-value">{stats.recordings.total}</div><div className="stat-sub">{stats.recordings.pending} pending review</div></div>
          <div className="stat-card teal"><div className="stat-label">Approved</div><div className="stat-value">{stats.recordings.approved}</div></div>
          <div className="stat-card coral"><div className="stat-label">Rejected</div><div className="stat-value">{stats.recordings.rejected}</div></div>
          <div className="stat-card amber"><div className="stat-label">Scripts</div><div className="stat-value">{stats.scripts}</div></div>
          <div className="stat-card"><div className="stat-label">Assignments</div><div className="stat-value">{stats.assignments.total}</div><div className="stat-sub">{stats.assignments.completed} completed</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Class balance</span></div>
            <div className="panel-body">
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span style={{ color: 'var(--coral)' }}>Vishing: {stats.class_balance.vishing}</span>
                  <span style={{ color: 'var(--teal)' }}>Benign: {stats.class_balance.benign}</span>
                </div>
                <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${vPct}%`, background: 'var(--coral)', borderRadius: '4px 0 0 4px' }} />
                  <div style={{ width: `${bPct}%`, background: 'var(--teal)' }} />
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>Target: 50/50 balance. Currently {vPct}% vishing / {bPct}% benign.</div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Recent submissions</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {!recent.length && (
                    <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>No pending reviews</td></tr>
                  )}
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{r.recording_id}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{(r.script?.category || '').replace('_', ' ')}</span></td>
                      <td><span className="badge badge-pending">pending</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
