import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiGet, apiFetch, authHdr } from '../../api'

const roleLabel = r => r === 'scammer' ? 'Speaker 1' : 'Speaker 2'
const STATUS_CLS = { pending: 'badge-pending', reviewed: 'badge-reviewed', rejected: 'badge-rejected' }

export default function Assignments({ me }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [scriptModal, setScriptModal] = useState(null)
  const [submitModal, setSubmitModal] = useState(null)
  const navigate = useNavigate()

  
  useEffect(() => {
    load()
    // Re-fetch when the tab/window regains focus (covers returning from call room)
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  async function load() {
    setLoading(true)
    const data = await apiGet('/api/volunteer/assignments')
    if (data) setAssignments(data)
    setLoading(false)
  }

  async function viewScript(scriptId, title) {
    const data = await apiGet(`/api/volunteer/scripts/${scriptId}`)
    if (data) setScriptModal({ title, content: data.content || 'Script content not available.' })
  }

  const pending   = assignments.filter(a => !a.completed)
  const completed = assignments.filter(a =>  a.completed)

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">My Assignments</div>
          <div className="page-sub">Scripts assigned to you by the research team</div>
        </div>
      </div>
      <div className="content">
        {me && !me.consent_signed && (
          <div className="alert alert-warn">
            ⚠️ Your consent form has not been marked as signed. Please contact the research team before recording.
          </div>
        )}
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading...</div>}
        {!loading && !assignments.length && (
          <div className="empty-state">
            <div className="icon">📭</div>
            <p>No scripts assigned yet.<br />The research team will assign scripts shortly.</p>
          </div>
        )}
        {pending.length > 0 && (
          <>
            <div className="section-divider">Pending ({pending.length})</div>
            {pending.map(a => (
              <ScriptCard key={a.id} a={a} onView={viewScript} onSubmit={setSubmitModal} onCall={(assignmentId, scriptId) => navigate(`/call/script-${scriptId}?aid=${assignmentId}`)} />
            ))}
          </>
        )}
        {completed.length > 0 && (
          <>
            <div className="section-divider" style={{ marginTop: 28 }}>Completed ({completed.length})</div>
            {completed.map(a => (
              <ScriptCard key={a.id} a={a} onView={viewScript} onSubmit={setSubmitModal} onCall={(assignmentId, scriptId) => navigate(`/call/script-${scriptId}?aid=${assignmentId}`)} />
            ))}
          </>
        )}
      </div>

      {scriptModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setScriptModal(null) }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{scriptModal.title}</span>
              <button className="modal-close" onClick={() => setScriptModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }}>
                {scriptModal.content}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setScriptModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {submitModal && (
        <SubmitModal
          {...submitModal}
          onClose={() => setSubmitModal(null)}
          onSuccess={() => { setSubmitModal(null); load() }}
        />
      )}
    </>
  )
}

function ScriptCard({ a, onView, onSubmit, onCall }) {
  const s = a.script
  const rec = a.recording
  const isVishing = s.call_type === 'vishing'
  const categoryLabel = s.category.replace('_', ' ').toUpperCase()

  let statusBadge
  if (a.completed) {
    statusBadge = <span className="badge badge-approved">completed</span>
  } else if (rec) {
    const cls = STATUS_CLS[rec.status] || 'badge-gray'
    statusBadge = <span className={`badge ${cls}`}>{rec.status}</span>
  } else {
    statusBadge = <span className="badge badge-gray">not submitted</span>
  }

  return (
    <div className="script-card">
      <div className="script-card-header">
        <div>
          <div className="script-card-title">{s.title}</div>
          <div className="script-card-meta">
            <span className="mono" style={{ color: 'var(--text3)' }}>{s.script_id}</span>
            &nbsp;·&nbsp;{categoryLabel}
            &nbsp;·&nbsp;{s.estimated_duration_sec ? `~${Math.round(s.estimated_duration_sec / 60)} min` : 'duration TBD'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <span className={a.role === 'scammer' ? 'pill-scammer' : 'pill-victim'}>{roleLabel(a.role)}</span>
          {statusBadge}
        </div>
      </div>

      {a.partner ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)' }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Call partner:</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.partner.full_name}</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>{a.partner.participant_id}</span>
          <span className={a.partner.role === 'scammer' ? 'pill-scammer' : 'pill-victim'} style={{ marginLeft: 4 }}>{roleLabel(a.partner.role)}</span>
        </div>
      ) : (
        <div style={{ marginTop: 10, padding: '9px 12px', background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 'var(--r)', fontSize: 12, color: 'var(--text3)' }}>
          No partner assigned yet — the research team will assign your call partner.
        </div>
      )}

      {isVishing ? (
        <div className="script-phase-bar">
          <span className="phase-greeting" style={{ flex: 2 }} title="Greeting" />
          <span className="phase-setup" style={{ flex: 2 }} title="Setup" />
          <span className="phase-escalation" style={{ flex: 2 }} title="Escalation" />
          <span className="phase-harvest" style={{ flex: 2 }} title="Harvest" />
        </div>
      ) : (
        <div style={{ height: 3, background: 'var(--teal)', borderRadius: 2, margin: '10px 0', opacity: 0.5 }} />
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div>
          <span className={`badge ${isVishing ? 'badge-vishing' : 'badge-benign'}`}>{s.call_type}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {s.has_content && (
            <button className="btn btn-ghost btn-sm" onClick={() => onView(s.id, s.title)}>📄 View script</button>
          )}
          {a.partner && !a.completed && (!rec || rec.status === 'rejected') && (
            <button className="btn btn-sm" style={{ background: 'var(--teal)', color: '#fff', border: 'none' }}
              onClick={() => onCall(a.id, s.id)}>
              📞 Join call
            </button>
          )}
          {!rec && !a.completed && (
            <button className="btn btn-primary btn-sm" onClick={() => onSubmit({ assignmentId: a.id, title: s.title, callType: s.call_type })}>
              🎙️ Submit recording
            </button>
          )}
          {rec?.status === 'rejected' && (
            <button className="btn btn-primary btn-sm" onClick={() => onSubmit({ assignmentId: a.id, title: s.title, callType: s.call_type })}>
              🔄 Resubmit
            </button>
          )}
        </div>
      </div>

      {rec?.admin_notes && (
        <div className="alert alert-warn" style={{ marginTop: 12, fontSize: 12 }}>
          <strong>Admin note:</strong> {rec.admin_notes}
        </div>
      )}
    </div>
  )
}

function SubmitModal({ assignmentId, title, callType, onClose, onSuccess }) {
  const [form, setForm] = useState({
    audioFile: null, recordingDate: '', durationSec: '', audioQuality: '',
    offScript: false, offScriptNotes: '', volunteerNotes: '',
    tGreeting: '', tSetup: '', tEscalation: '', tHarvest: '',
  })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const set = field => e => setForm(f => ({
    ...f,
    [field]: e.target.type === 'checkbox' ? e.target.checked
            : e.target.type === 'file'    ? e.target.files[0]
            : e.target.value,
  }))

  async function submit() {
    if (!form.audioFile) { setError('Please select an audio file.'); return }
    setLoading(true); setError('')
    const fd = new FormData()
    fd.append('assignment_id', assignmentId)
    fd.append('audio_file', form.audioFile)
    if (form.durationSec)    fd.append('duration_sec',     form.durationSec)
    if (form.audioQuality)   fd.append('audio_quality',    form.audioQuality)
    fd.append('off_script',       form.offScript)
    fd.append('off_script_notes', form.offScriptNotes)
    fd.append('volunteer_notes',  form.volunteerNotes)
    if (form.recordingDate)  fd.append('recording_date',   form.recordingDate)
    if (callType === 'vishing') {
      if (form.tGreeting)    fd.append('t_greeting',   form.tGreeting)
      if (form.tSetup)       fd.append('t_setup',      form.tSetup)
      if (form.tEscalation)  fd.append('t_escalation', form.tEscalation)
      if (form.tHarvest)     fd.append('t_harvest',    form.tHarvest)
    }
    try {
      const res  = await apiFetch('/api/volunteer/recordings/submit', { method: 'POST', headers: authHdr(), body: fd })
      if (!res) return
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Submission failed')
      onSuccess()
    } catch (ex) {
      setError(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-header">
          <span className="modal-title">Submit Recording</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="alert alert-info" style={{ marginBottom: 16 }}>Submitting recording for: {title}</div>

          <div className="section-divider">Recording file</div>
          <div className="form-group">
            <label className="form-label">Audio file <span>*</span></label>
            <input type="file" className="form-input" accept=".wav,.mp3,.m4a,.ogg" onChange={set('audioFile')} />
            <div className="form-hint">Accepted: .wav .mp3 .m4a — Max 500MB</div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Recording date</label>
              <input type="date" className="form-input" value={form.recordingDate} onChange={set('recordingDate')} />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (seconds)</label>
              <input type="number" className="form-input" placeholder="e.g. 240" min="0" value={form.durationSec} onChange={set('durationSec')} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Audio quality</label>
            <select className="form-select" value={form.audioQuality} onChange={set('audioQuality')}>
              <option value="">— select —</option>
              <option value="good">Good — clear audio</option>
              <option value="acceptable">Acceptable — some noise</option>
              <option value="poor">Poor — significant issues</option>
            </select>
          </div>

          {callType === 'vishing' && (
            <>
              <div className="section-divider">Phase timestamps</div>
              <div className="alert alert-info">Listen back to your recording and note approximately when each phase started (in seconds from the start of the call).</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Greeting started (seconds)</label>
                  <input type="number" className="form-input" placeholder="e.g. 8" min="0" value={form.tGreeting} onChange={set('tGreeting')} />
                  <div className="form-hint" style={{ color: 'var(--teal)' }}>Normal opener, introduction</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Setup started (seconds)</label>
                  <input type="number" className="form-input" placeholder="e.g. 40" min="0" value={form.tSetup} onChange={set('tSetup')} />
                  <div className="form-hint" style={{ color: 'var(--amber)' }}>Problem / issue introduced</div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Escalation started (seconds)</label>
                  <input type="number" className="form-input" placeholder="e.g. 105" min="0" value={form.tEscalation} onChange={set('tEscalation')} />
                  <div className="form-hint" style={{ color: '#E07A30' }}>Threats, urgency, pressure</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Harvest started (seconds)</label>
                  <input type="number" className="form-input" placeholder="e.g. 195" min="0" value={form.tHarvest} onChange={set('tHarvest')} />
                  <div className="form-hint" style={{ color: 'var(--coral)' }}>Asking for payment / details</div>
                </div>
              </div>
            </>
          )}

          <div className="section-divider">Quality notes</div>
          <div className="form-group">
            <div className="checkbox-row">
              <input type="checkbox" id="off-script" checked={form.offScript} onChange={set('offScript')} />
              <label htmlFor="off-script">I deviated significantly from the script</label>
            </div>
          </div>
          {form.offScript && (
            <div className="form-group">
              <label className="form-label">Describe what changed</label>
              <textarea className="form-textarea" placeholder="Briefly describe what was different..." value={form.offScriptNotes} onChange={set('offScriptNotes')} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Additional notes for the researcher</label>
            <textarea className="form-textarea" placeholder="Any technical issues, background noise, etc." value={form.volunteerNotes} onChange={set('volunteerNotes')} />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Uploading...</> : 'Submit recording'}
          </button>
        </div>
      </div>
    </div>
  )
}
