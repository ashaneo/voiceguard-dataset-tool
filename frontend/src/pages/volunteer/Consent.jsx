import { useState } from 'react'
import { apiFetch } from '../../api'

export default function Consent({ me, onConsentUpdate }) {
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const signed = me?.consent_signed

  async function submitConsent() {
    setLoading(true); setError('')
    const res = await apiFetch('/api/volunteer/consent/acknowledge', { method: 'POST' })
    if (!res) return
    if (res.ok) { onConsentUpdate() }
    else { const d = await res.json(); setError(d.detail || 'Failed to record consent.') }
    setLoading(false)
  }

  return (
    <>
      <div className="topbar">
        <div>
          <div className="page-title">Consent Agreement</div>
          <div className="page-sub">Research participation consent form</div>
        </div>
      </div>
      <div className="content">
        {signed === false && (
          <div className="alert alert-warn" style={{ marginBottom: 20 }}>
            ⚠️ Your consent has not yet been confirmed. Please review the agreement below and click "I Agree" to proceed.
          </div>
        )}
        {signed === true && (
          <div className="alert alert-success" style={{ marginBottom: 20 }}>
            ✓ Your consent has been confirmed and is on file with the research team.
          </div>
        )}

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Research Participation Consent Form</span></div>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.9, color: 'var(--text2)' }}>
            <p style={{ marginBottom: 14 }}><strong style={{ color: 'var(--text)' }}>Study title:</strong> VoiceGuard — A Voice Phishing (Vishing) Detection Dataset</p>
            <p style={{ marginBottom: 14 }}><strong style={{ color: 'var(--text)' }}>Principal investigators:</strong> VoiceGuard Research Team</p>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Purpose of the Study</h3>
            <p style={{ marginBottom: 14 }}>
              You are being asked to participate in a research project that aims to create a labelled audio dataset of voice phishing (vishing) and benign phone calls. This dataset will be used to develop and evaluate machine-learning models capable of detecting fraudulent phone calls in real time, helping protect individuals from scam and fraud.
            </p>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>What You Will Be Asked to Do</h3>
            <ul style={{ paddingLeft: 18, marginBottom: 14 }}>
              <li style={{ marginBottom: 6 }}>Read and follow scripted phone-call scenarios assigned to you by the research team.</li>
              <li style={{ marginBottom: 6 }}>Coordinate with a partner volunteer to record the call using a call-recording application (e.g., Cube ACR on Android).</li>
              <li style={{ marginBottom: 6 }}>Upload the recording through this portal along with timing and quality metadata.</li>
              <li style={{ marginBottom: 6 }}>Each recording session is expected to take approximately 5–15 minutes.</li>
            </ul>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Risks and Discomforts</h3>
            <p style={{ marginBottom: 14 }}>
              The scenarios are scripted and role-played. There are no real financial transactions or personal data disclosures involved. The primary risk is mild discomfort from performing scam-related roleplay. You may withdraw at any time without penalty.
            </p>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Confidentiality and Data Use</h3>
            <ul style={{ paddingLeft: 18, marginBottom: 14 }}>
              <li style={{ marginBottom: 6 }}>Recordings will be stored securely and accessible only to the research team.</li>
              <li style={{ marginBottom: 6 }}>You will be identified only by your participant ID (e.g., P001) — your name will not appear in any published dataset.</li>
              <li style={{ marginBottom: 6 }}>Audio data may be released publicly as part of an anonymised research dataset for academic use.</li>
              <li style={{ marginBottom: 6 }}>Metadata (timestamps, quality labels) may be published alongside the audio.</li>
            </ul>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Voluntary Participation</h3>
            <p style={{ marginBottom: 14 }}>
              Your participation is entirely voluntary. You may withdraw at any time by contacting the research team. Withdrawal will not result in any penalty or loss of benefits to which you are otherwise entitled.
            </p>

            <hr className="divider" />
            <h3 style={{ fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>Contact</h3>
            <p style={{ marginBottom: 14 }}>
              If you have questions about this research, please contact the research team. For concerns about your rights as a research participant, contact your institution's research ethics board.
            </p>

            <hr className="divider" />

            {!signed && (
              <div>
                <div className="checkbox-row" style={{ marginBottom: 16 }}>
                  <input type="checkbox" id="consent-check" checked={checked} onChange={e => setChecked(e.target.checked)} />
                  <label htmlFor="consent-check" style={{ fontSize: 13, color: 'var(--text)' }}>
                    I have read and understood the consent agreement above, and I agree to participate in this research study.
                  </label>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={submitConsent}
                  disabled={!checked || loading}
                  style={{ opacity: !checked || loading ? 0.5 : 1 }}
                >
                  {loading ? <><span className="spinner" /> Saving...</> : 'I Agree & Understand'}
                </button>
                {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}
              </div>
            )}

            {signed && (
              <div className="alert alert-success" style={{ marginTop: 4 }}>
                ✓ You have agreed to this consent form. Your acknowledgement is recorded.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
