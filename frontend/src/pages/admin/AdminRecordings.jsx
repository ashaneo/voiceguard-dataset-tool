import { useState, useEffect } from 'react'
import { apiGet, apiPatch, apiDelete } from '../../api'

const STATUS_CLS = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected', reviewed: 'badge-reviewed' }

function fmt(sec) {
  if (!sec) return '—'
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export default function AdminRecordings() {
  const [recordings, setRecordings] = useState([])
  const [status, setStatus]         = useState('')
  const [category, setCategory]     = useState('')
  const [review, setReview]         = useState(null)
  const [confirm, setConfirm]       = useState(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => { load() }, [status, category])

  async function load() {
    const params = new URLSearchParams()
    if (status)   params.set('status', status)
    if (category) params.set('category', category)
    const data = await apiGet(`/api/admin/recordings${params.toString() ? '?' + params : ''}`)
    if (data) setRecordings(data)
  }

  async function handleDelete(id) {
    const ok = await apiDelete(`/api/admin/recordings/${id}`)
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
          <div className="page-title">Recordings</div>
          <div className="page-sub">Review and approve submissions</div>
        </div>
        <div className="topbar-right">
          <select className="form-select" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            <option value="irs">IRS / Tax fraud</option>
            <option value="bank">Bank suspension</option>
            <option value="tech_support">Tech support</option>
            <option value="social_security">Social security</option>
            <option value="prize">Prize / Lottery</option>
            <option value="utility">Utility</option>
            <option value="benign">Benign</option>
          </select>
          <select className="form-select" style={{ width: 160 }} value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
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
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Recording ID</th><th>Script</th><th>Category</th><th>Type</th>
                <th>Spk 1</th><th>Spk 2</th><th>Duration</th><th>Quality</th>
                <th>Timestamps</th><th>Status</th><th>Submitted</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {!recordings.length && (
                  <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No recordings found</td></tr>
                )}
                {recordings.map(r => {
                  const tsText = r.t_greeting != null
                    ? [r.t_greeting, r.t_setup, r.t_escalation, r.t_harvest].map(t => t ?? '—').join(' / ')
                    : null
                  return (
                    <tr key={r.id}>
                      <td className="mono" style={{ fontSize: 11 }}>{r.recording_id}</td>
                      <td style={{ fontSize: 12 }}>{r.script?.title || '—'}</td>
                      <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{(r.script?.category || '').replace('_', ' ')}</span></td>
                      <td><span className={`badge ${r.script?.call_type === 'vishing' ? 'badge-vishing' : 'badge-benign'}`} style={{ fontSize: 10 }}>{r.script?.call_type || '—'}</span></td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{r.scammer || '—'}</td>
                      <td className="mono" style={{ fontSize: 11, color: 'var(--text2)' }}>{r.victim  || '—'}</td>
                      <td style={{ fontSize: 12 }}>{fmt(r.duration_sec)}</td>
                      <td>{r.audio_quality ? <span className="badge badge-gray" style={{ fontSize: 10 }}>{r.audio_quality}</span> : '—'}</td>
                      <td>
                        {tsText
                          ? <><span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{tsText}</span>{r.timestamps_verified && <span style={{ color: 'var(--teal)', marginLeft: 4 }}>✓</span>}</>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${STATUS_CLS[r.status] || 'badge-gray'}`}>{r.status}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                      <td style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setReview(r)}>Review</button>
                        {r.file_name && (
                          <a href={`/api/admin/recordings/${r.id}/download`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, textDecoration: 'none' }} download>↓</a>
                        )}
                        {confirm === r.id ? (
                          <>
                            <button className="btn btn-sm" style={{ background: 'var(--coral)', color: '#fff', border: 'none', fontSize: 11 }} onClick={() => handleDelete(r.id)}>Confirm</button>
                            <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setConfirm(null)}>✕</button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--text3)' }} onClick={() => { setDeleteError(''); setConfirm(r.id) }}>Delete</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {review && (
        <ReviewModal
          recording={review}
          onClose={() => setReview(null)}
          onSave={() => { setReview(null); load() }}
        />
      )}
    </>
  )
}

function ReviewModal({ recording: r, onClose, onSave }) {
  const [form, setForm] = useState({
    status:              r.status,
    audio_quality:       r.audio_quality || '',
    timestamps_verified: r.timestamps_verified,
    t_greeting:          r.t_greeting  ?? '',
    t_setup:             r.t_setup     ?? '',
    t_escalation:        r.t_escalation ?? '',
    t_harvest:           r.t_harvest   ?? '',
    admin_notes:         r.admin_notes  || '',
  })

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function save() {
    const body = {
      status:              form.status,
      timestamps_verified: form.timestamps_verified,
      admin_notes:         form.admin_notes,
    }
    if (form.audio_quality) body.audio_quality = form.audio_quality
    for (const f of ['t_greeting', 't_setup', 't_escalation', 't_harvest']) {
      if (form[f] !== '') body[f] = parseInt(form[f])
    }
    const res = await apiPatch(`/api/admin/recordings/${r.id}/review`, body)
    if (res?.ok) onSave()
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Review Recording</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Recording: {r.recording_id} · Script: {r.script?.title || '—'}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.status} onChange={set('status')}>
                <option value="pending">Pending</option>
                <option value="reviewed">Reviewed</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Audio quality</label>
              <select className="form-select" value={form.audio_quality} onChange={set('audio_quality')}>
                <option value="">— unchanged —</option>
                <option value="good">Good</option>
                <option value="acceptable">Acceptable</option>
                <option value="poor">Poor</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <div className="checkbox-row">
              <input type="checkbox" id="ts-verified" checked={form.timestamps_verified} onChange={set('timestamps_verified')} />
              <label htmlFor="ts-verified">Timestamps verified by researcher</label>
            </div>
          </div>
          <div className="section-divider">Verified timestamps (override if needed)</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">t_greeting (seconds)</label>
              <input type="number" className="form-input" min="0" value={form.t_greeting} onChange={set('t_greeting')} />
            </div>
            <div className="form-group">
              <label className="form-label">t_setup (seconds)</label>
              <input type="number" className="form-input" min="0" value={form.t_setup} onChange={set('t_setup')} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">t_escalation (seconds)</label>
              <input type="number" className="form-input" min="0" value={form.t_escalation} onChange={set('t_escalation')} />
            </div>
            <div className="form-group">
              <label className="form-label">t_harvest (seconds)</label>
              <input type="number" className="form-input" min="0" value={form.t_harvest} onChange={set('t_harvest')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Admin notes (visible to volunteer)</label>
            <textarea className="form-textarea" placeholder="Feedback, issues, instructions for resubmission..." value={form.admin_notes} onChange={set('admin_notes')} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save}>Save review</button>
        </div>
      </div>
    </div>
  )
}
