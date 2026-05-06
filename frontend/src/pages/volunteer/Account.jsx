import { useState } from 'react'
import { apiFetch, jsonHdr } from '../../api'

export default function Account() {
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

  async function changePassword() {
    setError(''); setSuccess(false)
    if (!current || !newPwd) { setError('Please fill in all fields.'); return }
    if (newPwd !== confirm)  { setError('New passwords do not match.'); return }
    if (newPwd.length < 6)   { setError('New password must be at least 6 characters.'); return }

    const res = await apiFetch('/api/volunteer/change-password', {
      method: 'POST',
      headers: jsonHdr(),
      body: JSON.stringify({ current_password: current, new_password: newPwd }),
    })
    if (!res) return
    if (res.ok) {
      setSuccess(true)
      setCurrent(''); setNewPwd(''); setConfirm('')
    } else {
      const d = await res.json()
      setError(d.detail || 'Failed to change password.')
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Change Password</div>
          <div className="page-sub">Update your account password</div>
        </div>
      </div>
      <div className="content">
        <div className="panel" style={{ maxWidth: 480 }}>
          <div className="panel-body">
            <div className="form-group">
              <label className="form-label">Current password</label>
              <input type="password" className="form-input" placeholder="Enter your current password" value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">New password</label>
              <input type="password" className="form-input" placeholder="At least 6 characters" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm new password</label>
              <input type="password" className="form-input" placeholder="Repeat new password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            {error   && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}
            {success && <div className="alert alert-success" style={{ marginBottom: 12 }}>Password changed successfully.</div>}
            <button className="btn btn-primary" onClick={changePassword}>Update password</button>
          </div>
        </div>
      </div>
    </>
  )
}
