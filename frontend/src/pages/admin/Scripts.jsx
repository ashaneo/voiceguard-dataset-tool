import { useState, useEffect } from 'react'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api'

const roleLabel = r => r === 'scammer' ? 'Speaker 1' : 'Speaker 2'
const RolePill  = ({ role }) => <span className={role === 'scammer' ? 'pill-scammer' : 'pill-victim'} style={{ fontSize: 10 }}>{roleLabel(role)}</span>

const CATEGORIES = [
  { value: 'irs',             label: 'IRS / Tax fraud' },
  { value: 'bank',            label: 'Bank suspension' },
  { value: 'tech_support',    label: 'Tech support' },
  { value: 'social_security', label: 'Social security' },
  { value: 'prize',           label: 'Prize / Lottery' },
  { value: 'utility',         label: 'Utility disconnection' },
  { value: 'benign',          label: 'Benign' },
]

const EMPTY_FORM = {
  script_id: '', title: '', category: 'irs', call_type: 'vishing',
  description: '', content: '',
  estimated_duration_sec: '', expected_t_greeting: '', expected_t_setup: '',
  expected_t_escalation: '', expected_t_harvest: '',
}

export default function Scripts() {
  const [scripts, setScripts]     = useState([])
  const [volunteers, setVols]     = useState([])
  const [category, setCategory]   = useState('')
  const [modal, setModal]         = useState(null) // null | { mode: 'add' } | { mode: 'edit', script }
  const [form, setForm]           = useState(EMPTY_FORM)
  const [addVol, setAddVol]       = useState('')
  const [addRole, setAddRole]     = useState('scammer')
  const [assignErr, setAssignErr] = useState('')
  const [scriptErr, setScriptErr] = useState('')

  useEffect(() => { load() }, [category])

  async function load() {
    const url = `/api/admin/scripts${category ? `?category=${category}` : ''}`
    const data = await apiGet(url)
    if (data) setScripts(data)
  }

  async function loadVols() {
    if (volunteers.length) return
    const data = await apiGet('/api/admin/volunteers')
    if (data) setVols(data)
  }

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  function openAdd() {
    setForm(EMPTY_FORM); setScriptErr('')
    setModal({ mode: 'add' })
  }

  async function openEdit(s) {
    setForm({
      script_id: s.script_id, title: s.title, category: s.category,
      call_type: s.call_type, description: s.description || '', content: s.content || '',
      estimated_duration_sec: s.estimated_duration_sec || '',
      expected_t_greeting: s.expected_t_greeting || '',
      expected_t_setup: s.expected_t_setup || '',
      expected_t_escalation: s.expected_t_escalation || '',
      expected_t_harvest: s.expected_t_harvest || '',
    })
    setScriptErr(''); setAssignErr('')
    setModal({ mode: 'edit', script: s })
    await loadVols()
  }

  async function save() {
    setScriptErr('')
    const body = {
      title: form.title, category: form.category, call_type: form.call_type,
      description: form.description, content: form.content,
      estimated_duration_sec: parseInt(form.estimated_duration_sec) || null,
      expected_t_greeting:    parseInt(form.expected_t_greeting)    || null,
      expected_t_setup:       parseInt(form.expected_t_setup)       || null,
      expected_t_escalation:  parseInt(form.expected_t_escalation)  || null,
      expected_t_harvest:     parseInt(form.expected_t_harvest)     || null,
    }
    if (modal.mode === 'add') {
      body.script_id = form.script_id
      const res = await apiPost('/api/admin/scripts', body)
      if (!res) return
      if (res.ok) { setModal(null); load() }
      else setScriptErr(res.data.detail || 'Failed.')
    } else {
      const res = await apiPatch(`/api/admin/scripts/${modal.script.id}`, body)
      if (!res) return
      if (res.ok) { setModal(null); load() }
      else setScriptErr(res.data.detail || 'Failed.')
    }
  }

  async function del(id) {
    if (!confirm('Delete this script? This cannot be undone.')) return
    await apiDelete(`/api/admin/scripts/${id}`)
    load()
  }

  async function addAssignee() {
    setAssignErr('')
    if (!addVol) { setAssignErr('Select a volunteer.'); return }
    const res = await apiPost('/api/admin/assignments', {
      volunteer_id: parseInt(addVol),
      script_id:    modal.script.id,
      role:         addRole,
    })
    if (!res) return
    if (res.ok) {
      const updated = await apiGet(`/api/admin/scripts`)
      if (updated) {
        setVols(v => v)
        const s = updated.find(s => s.id === modal.script.id)
        if (s) setModal(m => ({ ...m, script: s }))
        setScripts(updated.filter(s => !category || s.category === category))
      }
      setAddVol('')
    } else {
      setAssignErr(res.data.detail || 'Failed.')
    }
  }

  async function removeAssignee(assignmentId) {
    if (!confirm('Remove this volunteer from the script?')) return
    await apiDelete(`/api/admin/assignments/${assignmentId}`)
    const updated = await apiGet('/api/admin/scripts')
    if (updated) {
      const s = updated.find(s => s.id === modal.script.id)
      if (s) setModal(m => ({ ...m, script: s }))
      setScripts(updated.filter(s => !category || s.category === category))
    }
  }

  const editScript = modal?.script
  const assignedIds = new Set((editScript?.assignees || []).map(a => a.volunteer_id))
  const availableVols = volunteers.filter(v => !assignedIds.has(v.id))
  const slotsLeft = editScript ? 2 - (editScript.assignees?.length || 0) : 0

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Scripts</div>
          <div className="page-sub">Manage vishing and benign scripts</div>
        </div>
        <div className="topbar-right">
          <select className="form-select" style={{ width: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add script</button>
        </div>
      </div>
      <div className="content">
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>Script ID</th><th>Title</th><th>Category</th><th>Type</th>
                <th>Duration</th><th>Assignees (slots)</th><th>Recordings</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {!scripts.length && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>No scripts yet</td></tr>
                )}
                {scripts.map(s => (
                  <tr key={s.id}>
                    <td className="mono" style={{ fontSize: 12 }}>{s.script_id}</td>
                    <td>{s.title}</td>
                    <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{s.category.replace('_', ' ')}</span></td>
                    <td><span className={`badge ${s.call_type === 'vishing' ? 'badge-vishing' : 'badge-benign'}`} style={{ fontSize: 10 }}>{s.call_type}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{s.estimated_duration_sec ? `~${Math.round(s.estimated_duration_sec / 60)} min` : '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ color: s.assignment_count >= 2 ? 'var(--teal)' : 'var(--text3)', fontWeight: 600, marginRight: 6 }}>{s.assignment_count}/2</span>
                      {s.assignees?.map(a => <RolePill key={a.id} role={a.role} />)}
                    </td>
                    <td style={{ fontSize: 12 }}>{s.recording_count}</td>
                    <td style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openEdit(s)}>Edit</button>
                      <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => del(s.id)}>Delete</button>
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
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{modal.mode === 'add' ? 'Add Script' : 'Edit Script'}</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {modal.mode === 'add' && (
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Script ID <span>*</span></label>
                    <input type="text" className="form-input" placeholder="e.g. IRS_001" value={form.script_id} onChange={set('script_id')} /></div>
                  <div className="form-group"><label className="form-label">Title <span>*</span></label>
                    <input type="text" className="form-input" placeholder="e.g. IRS Arrest Warrant" value={form.title} onChange={set('title')} /></div>
                </div>
              )}
              {modal.mode === 'edit' && (
                <div className="form-group"><label className="form-label">Title <span>*</span></label>
                  <input type="text" className="form-input" value={form.title} onChange={set('title')} /></div>
              )}
              <div className="form-row">
                <div className="form-group"><label className="form-label">Category <span>*</span></label>
                  <select className="form-select" value={form.category} onChange={set('category')}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">Call type <span>*</span></label>
                  <select className="form-select" value={form.call_type} onChange={set('call_type')}>
                    <option value="vishing">Vishing</option>
                    <option value="benign">Benign</option>
                  </select></div>
              </div>
              <div className="form-group"><label className="form-label">Description</label>
                <input type="text" className="form-input" placeholder="Brief description of the scenario" value={form.description} onChange={set('description')} /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Est. duration (seconds)</label>
                  <input type="number" className="form-input" placeholder="e.g. 240" value={form.estimated_duration_sec} onChange={set('estimated_duration_sec')} /></div>
                <div className="form-group"><label className="form-label">Expected t_greeting (s)</label>
                  <input type="number" className="form-input" placeholder="e.g. 8" value={form.expected_t_greeting} onChange={set('expected_t_greeting')} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Expected t_setup (s)</label>
                  <input type="number" className="form-input" placeholder="e.g. 40" value={form.expected_t_setup} onChange={set('expected_t_setup')} /></div>
                <div className="form-group"><label className="form-label">Expected t_escalation (s)</label>
                  <input type="number" className="form-input" placeholder="e.g. 105" value={form.expected_t_escalation} onChange={set('expected_t_escalation')} /></div>
              </div>
              <div className="form-group"><label className="form-label">Expected t_harvest (s)</label>
                <input type="number" className="form-input" placeholder="e.g. 195" value={form.expected_t_harvest} onChange={set('expected_t_harvest')} /></div>
              <div className="form-group"><label className="form-label">Script content</label>
                <textarea className="form-textarea" style={{ minHeight: 200, fontFamily: 'var(--mono)', fontSize: 12 }} placeholder="Paste full script here..." value={form.content} onChange={set('content')} /></div>

              {modal.mode === 'edit' && (
                <>
                  <div className="section-divider">Volunteers assigned to this script</div>
                  {editScript.assignees?.length === 0 && (
                    <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 8 }}>No volunteers assigned yet.</div>
                  )}
                  {editScript.assignees?.map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 6, marginBottom: 6 }}>
                      <span className="mono" style={{ fontSize: 13, color: 'var(--blue)' }}>{a.participant_id}</span>
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{a.full_name}</span>
                      <RolePill role={a.role} />
                      {a.completed && <span className="badge badge-approved" style={{ fontSize: 10 }}>completed</span>}
                      <button className="btn btn-danger btn-sm" style={{ fontSize: 11, marginLeft: 'auto' }} onClick={() => removeAssignee(a.id)}>Remove</button>
                    </div>
                  ))}
                  {slotsLeft > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                      <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Add volunteer</label>
                        <select className="form-select" value={addVol} onChange={e => setAddVol(e.target.value)}>
                          <option value="">— select —</option>
                          {availableVols.map(v => <option key={v.id} value={v.id}>{v.participant_id} — {v.full_name}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ width: 130, marginBottom: 0 }}>
                        <label className="form-label">Role</label>
                        <select className="form-select" value={addRole} onChange={e => setAddRole(e.target.value)}>
                          <option value="scammer">Speaker 1</option>
                          <option value="victim">Speaker 2</option>
                        </select>
                      </div>
                      <button className="btn btn-ghost btn-sm" onClick={addAssignee} style={{ marginBottom: 1 }}>+ Assign</button>
                    </div>
                  )}
                  {assignErr && <div className="alert alert-error" style={{ marginTop: 8 }}>{assignErr}</div>}
                </>
              )}

              {scriptErr && <div className="alert alert-error">{scriptErr}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>{modal.mode === 'add' ? 'Add script' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
