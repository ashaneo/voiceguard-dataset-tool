import { useState, useEffect } from 'react'
import { apiGet, apiDelete } from '../../api'

const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', reviewed: 'badge-reviewed' }

function fmt(sec) {
  if (!sec) return '—'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function Recordings() {
  const [recordings, setRecordings] = useState([])
  const [loading, setLoading]       = useState(true)
  const [confirm, setConfirm]       = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { load() }, [])

  function load() {
    setLoading(true)
    apiGet('/api/volunteer/recordings').then(data => {
      if (data) setRecordings(data)
      setLoading(false)
    })
  }

  async function handleDelete(recording_id) {
    const ok = await apiDelete(`/api/volunteer/recordings/${recording_id}`)
    if (ok) {
      setConfirm(null)
      setDeleteError('')
      load()
    } else {
      setDeleteError('Failed to delete recording. Please try again.')
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">My Recordings</div>
          <div className="page-sub">All recordings you have submitted</div>
        </div>
      </div>
      <div className="content">
        {deleteError && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            {deleteError}
            <button style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => setDeleteError('')}>✕</button>
          </div>
        )}
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Submission history</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Recording ID</th><th>Script</th><th>Category</th>
                <th>Duration</th><th>Quality</th><th>Status</th><th>Submitted</th><th>Notes from admin</th><th></th>
              </tr></thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>Loading...</td></tr>
                )}
                {!loading && !recordings.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No recordings submitted yet</td></tr>
                )}
                {recordings.map(r => (
                  <tr key={r.recording_id}>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--text2)' }}>{r.recording_id}</td>
                    <td>{r.script_title || '—'}</td>
                    <td><span className="badge badge-gray">{(r.script_category || '').replace('_', ' ')}</span></td>
                    <td>{fmt(r.duration_sec)}</td>
                    <td>{r.audio_quality ? <span className="badge badge-gray">{r.audio_quality}</span> : '—'}</td>
                    <td><span className={`badge ${STATUS_CLS[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                    <td style={{ color: 'var(--text3)', fontSize: 12 }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 200 }}>{r.admin_notes || '—'}</td>
                    <td>
                      {confirm === r.recording_id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn btn-sm"
                            style={{ background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 11 }}
                            onClick={() => handleDelete(r.recording_id)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11 }}
                            onClick={() => setConfirm(null)}
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11, color: 'var(--text3)' }}
                          onClick={() => { setDeleteError(''); setConfirm(r.recording_id) }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
