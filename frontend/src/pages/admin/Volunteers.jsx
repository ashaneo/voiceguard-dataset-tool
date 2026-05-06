import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch } from '../../api'

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState([])
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState({ full_name: '', email: '', password: '', has_android: false, notes: '' })
  const [error, setError]           = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const data = await apiGet('/api/admin/volunteers')
    if (data) setVolunteers(data)
  }

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function create() {
    setError('')
    const res = await apiPost('/api/admin/volunteers', form)
    if (!res) return
    if (res.ok) {
      setModal(false)
      setForm({ full_name: '', email: '', password: '', has_android: false, notes: '' })
      load()
      alert(`Volunteer created!\nParticipant ID: ${res.data.participant_id}`)
    } else {
      setError(res.data.detail || 'Failed to create volunteer.')
    }
  }

  async function toggleConsent(id, val) {
    await apiPatch(`/api/admin/volunteers/${id}`, { consent_signed: val })
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Volunteers</div>
          <div className="page-sub">Manage research participants</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Add volunteer</button>
        </div>
      </div>
      <div className="content">
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Participant ID</th><th>Name</th><th>Email</th><th>Android</th>
                <th>Consent</th><th>Assigned</th><th>Completed</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {!volunteers.length && (
                  <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No volunteers yet</td></tr>
                )}
                {volunteers.map(v => (
                  <tr key={v.id}>
                    <td className="mono" style={{ fontSize: 12, color: 'var(--blue)' }}>{v.participant_id}</td>
                    <td>{v.full_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{v.email}</td>
                    <td style={{ textAlign: 'center' }}>{v.has_android ? '✓' : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      {v.consent_signed
                        ? <span style={{ color: 'var(--teal)' }}>✓</span>
                        : <span style={{ color: 'var(--coral)' }}>✗</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>{v.assignments_total}</td>
                    <td style={{ textAlign: 'center' }}>{v.assignments_completed}</td>
                    <td><span className={`badge ${v.is_active ? 'badge-approved' : 'badge-rejected'}`}>{v.is_active ? 'active' : 'inactive'}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => toggleConsent(v.id, !v.consent_signed)}>
                        {v.consent_signed ? 'Revoke consent' : 'Mark consented'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Add Volunteer</span>
              <button className="modal-close" onClick={() => { setModal(false); setError('') }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Full name <span>*</span></label>
                <input type="text" className="form-input" placeholder="e.g. Ashan Perera" value={form.full_name} onChange={set('full_name')} /></div>
              <div className="form-group"><label className="form-label">Email address <span>*</span></label>
                <input type="email" className="form-input" placeholder="volunteer@email.com" value={form.email} onChange={set('email')} /></div>
              <div className="form-group"><label className="form-label">Temporary password <span>*</span></label>
                <input type="text" className="form-input" placeholder="They can change this later" value={form.password} onChange={set('password')} /></div>
              <div className="form-group">
                <div className="checkbox-row">
                  <input type="checkbox" id="vol-android" checked={form.has_android} onChange={set('has_android')} />
                  <label htmlFor="vol-android">Has Android phone (for call recording)</label>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label>
                <textarea className="form-textarea" placeholder="Optional internal notes..." value={form.notes} onChange={set('notes')} /></div>
              {error && <div className="alert alert-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setModal(false); setError('') }}>Cancel</button>
              <button className="btn btn-primary" onClick={create}>Add volunteer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
