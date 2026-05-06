import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiDelete } from '../../api'

const roleLabel = r => r === 'scammer' ? 'Speaker 1' : 'Speaker 2'
const RolePill  = ({ role }) => <span className={role === 'scammer' ? 'pill-scammer' : 'pill-victim'}>{roleLabel(role)}</span>

export default function AdminAssignments() {
  const [assignments, setAssignments] = useState([])
  const [volunteers, setVolunteers]   = useState([])
  const [scripts, setScripts]         = useState([])
  const [modal, setModal]             = useState(false)
  const [form, setForm]               = useState({ volunteer_id: '', script_id: '', role: 'scammer' })
  const [capacity, setCapacity]       = useState('')
  const [error, setError]             = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const [a, v, s] = await Promise.all([
      apiGet('/api/admin/assignments'),
      apiGet('/api/admin/volunteers'),
      apiGet('/api/admin/scripts'),
    ])
    if (a) setAssignments(a)
    if (v) setVolunteers(v)
    if (s) setScripts(s)
  }

  async function openModal() {
    setForm({ volunteer_id: '', script_id: '', role: 'scammer' })
    setCapacity(''); setError('')
    setModal(true)
  }

  function onScriptChange(e) {
    const sid = e.target.value
    setForm(f => ({ ...f, script_id: sid }))
    if (!sid) { setCapacity(''); return }
    const s = scripts.find(s => String(s.id) === sid)
    if (!s) return
    const count = s.assignment_count || 0
    if (count >= 2) {
      setCapacity('⚠ This script is full (2/2 volunteers assigned)')
    } else {
      const existing = (s.assignees || []).map(a => `${a.participant_id} (${a.role})`).join(', ')
      setCapacity(`${count}/2 slots filled${existing ? ' — ' + existing : ''}`)
    }
  }

  async function create() {
    setError('')
    const body = {
      volunteer_id: parseInt(form.volunteer_id),
      script_id:    parseInt(form.script_id),
      role:         form.role,
    }
    if (!body.volunteer_id || !body.script_id) { setError('Select both volunteer and script.'); return }
    const res = await apiPost('/api/admin/assignments', body)
    if (!res) return
    if (res.ok) { setModal(false); load() }
    else setError(res.data.detail || 'Failed to create assignment.')
  }

  async function remove(id) {
    if (!confirm('Remove this assignment? The volunteer will no longer see this script.')) return
    await apiDelete(`/api/admin/assignments/${id}`)
    load()
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Assignments</div>
          <div className="page-sub">Assign scripts to volunteers</div>
        </div>
        <div className="topbar-right">
          <button className="btn btn-primary btn-sm" onClick={openModal}>+ Assign script</button>
        </div>
      </div>
      <div className="content">
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Volunteer</th><th>Script</th><th>Category</th><th>Role</th>
                <th>Assigned</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {!assignments.length && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No assignments yet. Click "+ Assign script" to create one.</td></tr>
                )}
                {assignments.map(a => (
                  <tr key={a.id}>
                    <td>
                      <span className="mono" style={{ fontSize: 12, color: 'var(--blue)' }}>{a.volunteer.participant_id}</span><br />
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{a.volunteer.full_name}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{a.script.title}<br /><span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{a.script.script_id}</span></td>
                    <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{a.script.category.replace('_', ' ')}</span></td>
                    <td><RolePill role={a.role} /></td>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(a.assigned_date).toLocaleDateString()}</td>
                    <td><span className={`badge ${a.completed ? 'badge-approved' : 'badge-gray'}`}>{a.completed ? 'completed' : 'pending'}</span></td>
                    <td><button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => remove(a.id)}>Remove</button></td>
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
              <span className="modal-title">Assign Script to Volunteer</span>
              <button className="modal-close" onClick={() => setModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Volunteer <span>*</span></label>
                <select className="form-select" value={form.volunteer_id} onChange={e => setForm(f => ({ ...f, volunteer_id: e.target.value }))}>
                  <option value="">— select volunteer —</option>
                  {volunteers.map(v => <option key={v.id} value={v.id}>{v.participant_id} — {v.full_name}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Script <span>*</span></label>
                <select className="form-select" value={form.script_id} onChange={onScriptChange}>
                  <option value="">— select script —</option>
                  {scripts.map(s => {
                    const slots = s.assignment_count || 0
                    return <option key={s.id} value={s.id} disabled={slots >= 2}>{s.script_id} — {s.title} [{slots}/2]</option>
                  })}
                </select>
                {capacity && <div style={{ fontSize: 12, marginTop: 6, color: capacity.startsWith('⚠') ? 'var(--coral)' : 'var(--text3)' }}>{capacity}</div>}
              </div>
              <div className="form-group"><label className="form-label">Role <span>*</span></label>
                <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="scammer">Speaker 1 (Scammer)</option>
                  <option value="victim">Speaker 2 (Victim)</option>
                </select>
              </div>
              {error && <div className="alert alert-error">{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={create}>Assign</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
