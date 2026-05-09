import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { apiGet, apiFetch, authHdr } from '../../api'
import { blobToMp3 } from '../../lib/mp3'

const STUN_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const roleLabel   = r => r === 'scammer' ? 'Speaker 1' : 'Speaker 2'

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function bestMime() {
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

function mimeExt(mime) {
  if (mime.includes('mp4')) return '.m4a'
  if (mime.includes('ogg')) return '.ogg'
  return '.webm'
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CallRoom() {
  const { roomId }         = useParams()
  const [searchParams]     = useSearchParams()
  const navigate           = useNavigate()
  const assignmentId       = searchParams.get('aid')
  const scriptId           = roomId?.split('-')[1]

  const [status, setStatus]       = useState('connecting')
  const [isMuted, setIsMuted]     = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const [roomInfo, setRoomInfo]   = useState(null)
  const [script, setScript]       = useState(undefined) // undefined=loading, null=failed/none
  const [errorMsg, setErrorMsg]   = useState('')
  const [recordingBlob, setRecordingBlob] = useState(null)
  const [recordingUrl,  setRecordingUrl]  = useState(null)
  const [showSubmit,    setShowSubmit]    = useState(false)

  const wsRef          = useRef(null)
  const pcRef          = useRef(null)
  const localStreamRef = useRef(null)
  const remoteAudioRef = useRef(null)
  const timerRef       = useRef(null)
  const closingRef     = useRef(false)
  const audioCtxRef    = useRef(null)
  const destRef        = useRef(null)
  const recorderRef    = useRef(null)
  const chunksRef      = useRef([])
  const mimeRef        = useRef('')

  // ── Bootstrap ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (assignmentId && scriptId) {
      Promise.all([
        apiGet(`/api/call/room/${assignmentId}`),
        apiGet(`/api/volunteer/scripts/${scriptId}`),
      ]).then(([room, sc]) => {
        if (room) setRoomInfo(room)
        setScript(sc ?? null)
      })
    }
    connectWS()
    return doCleanup
  }, [])

  useEffect(() => {
    if (!recordingBlob) return
    const url = URL.createObjectURL(recordingBlob)
    setRecordingUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [recordingBlob])

  // ── WebSocket ───────────────────────────────────────────────────────────────
  function connectWS() {
    const token = localStorage.getItem('token')
    if (!token) { setStatus('error'); setErrorMsg('Not authenticated.'); return }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url   = `${proto}//${window.location.host}/api/call/ws/${roomId}?token=${token}`
    const ws    = new WebSocket(url)
    wsRef.current = ws
    ws.onmessage = async (e) => { try { await handleSignal(JSON.parse(e.data)) } catch (_) {} }
    ws.onerror   = () => { if (!closingRef.current) { setStatus('error'); setErrorMsg('Could not connect to the call server. Please try again.') } }
    ws.onclose   = () => { if (!closingRef.current) { handleCallEnded() } }
  }

  function send(msg) {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(msg))
  }

  // ── Signaling ───────────────────────────────────────────────────────────────
  async function handleSignal(msg) {
    switch (msg.type) {
      case 'waiting':
        setStatus('waiting')
        break
      case 'peer_joined':
        setStatus('in-call'); await setupMedia(false); startTimer()
        break
      case 'peer_present':
        setStatus('in-call'); await setupMedia(true); startTimer()
        break
      case 'offer': {
        if (!pcRef.current) await setupMedia(false)
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        const answer = await pcRef.current.createAnswer()
        await pcRef.current.setLocalDescription(answer)
        send({ type: 'answer', sdp: answer })
        break
      }
      case 'answer':
        if (pcRef.current) await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        break
      case 'ice-candidate':
        if (pcRef.current && msg.candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch (_) {}
        }
        break
      case 'peer_left':
        handleCallEnded()
        break
      case 'call_rejected':
        setStatus('error')
        setErrorMsg(`${msg.by_name || 'Your partner'} declined the call.`)
        closingRef.current = true
        try { wsRef.current?.close() } catch (_) {}
        break
      case 'partner_busy':
        setStatus('error')
        setErrorMsg(`${msg.partner_name || 'Your partner'} is on another call. Try again later.`)
        closingRef.current = true
        try { wsRef.current?.close() } catch (_) {}
        break
      case 'error':
        setStatus('error'); setErrorMsg(msg.message || 'An error occurred.')
        break
    }
  }

  // ── WebRTC + media ──────────────────────────────────────────────────────────
  async function setupMedia(initiator) {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (_) {
      setStatus('error')
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      return
    }

    startRecorder()

    const pc = new RTCPeerConnection(STUN_CONFIG)
    pcRef.current = pc
    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0]
      if (audioCtxRef.current && destRef.current) {
        audioCtxRef.current.createMediaStreamSource(e.streams[0]).connect(destRef.current)
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: 'ice-candidate', candidate: e.candidate })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        handleCallEnded()
      }
    }

    if (initiator) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({ type: 'offer', sdp: offer })
    }
  }

  // ── Recording ───────────────────────────────────────────────────────────────
  function startRecorder() {
    try {
      const mime      = bestMime()
      mimeRef.current = mime

      const audioCtx = new AudioContext()
      const dest     = audioCtx.createMediaStreamDestination()
      audioCtxRef.current = audioCtx
      destRef.current     = dest

      audioCtx.createMediaStreamSource(localStreamRef.current).connect(dest)

      const recorder = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined)
      recorderRef.current = recorder
      chunksRef.current   = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const type = mimeRef.current || 'audio/webm'
        setRecordingBlob(new Blob(chunksRef.current, { type }))
      }

      recorder.start(1000)
    } catch (err) {
      console.warn('MediaRecorder setup failed:', err)
    }
  }

  function stopRecorder() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop() } catch (_) {}
    }
    try { audioCtxRef.current?.close() } catch (_) {}
  }

  // ── Call lifecycle ──────────────────────────────────────────────────────────
  function handleCallEnded() {
    doCleanup()
    setStatus('ended')
  }

  function startTimer() {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function doCleanup() {
    closingRef.current = true
    stopTimer()
    stopRecorder()
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
    wsRef.current?.close()
  }

  // ── Controls ────────────────────────────────────────────────────────────────
  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled) }
  }

  function endCall() {
    doCleanup()
    setStatus('ended')
  }

  function goBack() {
    if (status === 'in-call') {
      endCall() // stay on page so the recording can be saved/submitted
      return
    }
    doCleanup()
    navigate('/volunteer')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        padding: '12px 24px', background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <button className="btn btn-ghost btn-sm" onClick={goBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {roomInfo?.script_title || 'Call Room'}
          </div>
          {roomInfo?.partner && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              Partner:&nbsp;
              <strong style={{ color: 'var(--text2)' }}>{roomInfo.partner.full_name}</strong>
              &nbsp;·&nbsp;{roleLabel(roomInfo.partner.role)}
            </div>
          )}
        </div>
      </div>

      {/* Full-width script — extra bottom padding so card never covers text */}
      <div style={{ flex: 1, padding: '24px 40px 140px', overflowY: 'auto' }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 14 }}>
          Script
        </div>
        {script?.content ? (
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 2, color: 'var(--text2)', fontFamily: 'var(--sans)', margin: 0 }}>
            {script.content}
          </pre>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            {script === undefined ? 'Loading script…' : 'No script content available.'}
          </div>
        )}
      </div>

      {/* Floating call card */}
      <CallCard
        status={status}
        isMuted={isMuted}
        elapsed={elapsed}
        recordingUrl={recordingUrl}
        recordingBlob={recordingBlob}
        roomId={roomId}
        onMute={toggleMute}
        onEnd={endCall}
        onCancel={goBack}
        onSubmit={() => setShowSubmit(true)}
        onBack={goBack}
        errorMsg={errorMsg}
      />

      {/* Remote audio (hidden) */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* Submit modal */}
      {showSubmit && recordingBlob && (
        <SubmitModal
          assignmentId={assignmentId}
          durationSec={elapsed}
          callType={script?.call_type}
          title={roomInfo?.script_title}
          blob={recordingBlob}
          ext={mimeExt(mimeRef.current)}
          onClose={() => setShowSubmit(false)}
          onSuccess={() => { setShowSubmit(false); goBack() }}
        />
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

// ── Floating call card ────────────────────────────────────────────────────────
function CallCard({ status, isMuted, elapsed, recordingUrl, recordingBlob, roomId, onMute, onEnd, onCancel, onSubmit, onBack, errorMsg }) {
  const filename = `voiceguard_${roomId}_${new Date().toISOString().slice(0, 10)}.mp3`
  const [encoding, setEncoding] = useState(false)
  const [encodeError, setEncodeError] = useState('')

  async function downloadMp3() {
    if (!recordingBlob || encoding) return
    setEncoding(true); setEncodeError('')
    try {
      const mp3Blob = await blobToMp3(recordingBlob)
      const url = URL.createObjectURL(mp3Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      setEncodeError('Could not encode MP3. Try again.')
    } finally {
      setEncoding(false)
    }
  }

  const borderColor =
    status === 'in-call' ? 'var(--teal)' :
    status === 'error'   ? 'var(--coral)' :
    'var(--border2)'

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, width: 300,
      background: 'var(--surface)', border: `1px solid ${borderColor}`,
      borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 100,
      overflow: 'hidden',
    }}>
      {/* Card header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: status === 'in-call' ? 'rgba(14,169,138,0.08)' : 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'in-call' && (
            <>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', background: 'var(--coral)',
                boxShadow: '0 0 6px var(--coral)', animation: 'pulse 1.4s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, color: 'var(--coral)', fontFamily: 'var(--mono)', letterSpacing: 1 }}>REC</span>
            </>
          )}
          {status === 'waiting'    && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Waiting for partner</span>}
          {status === 'ended'      && <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>Call ended</span>}
          {status === 'error'      && <span style={{ fontSize: 12, color: 'var(--coral)', fontWeight: 600 }}>Connection error</span>}
          {status === 'connecting' && <span style={{ fontSize: 12, color: 'var(--text3)' }}>Connecting…</span>}
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 18, letterSpacing: 2,
          color: status === 'in-call' ? 'var(--teal)' : 'var(--text3)',
        }}>
          {fmt(elapsed)}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>

        {status === 'connecting' && (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0', textAlign: 'center' }}>
            Connecting to call server…
          </div>
        )}

        {status === 'waiting' && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Waiting for partner</div>
              <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                The call starts automatically when they join.
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onCancel}>
              Cancel
            </button>
          </>
        )}

        {status === 'in-call' && (
          <>
            {isMuted && (
              <div style={{ fontSize: 11, color: 'var(--coral)' }}>Microphone muted</div>
            )}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', padding: '4px 0' }}>
              <button
                onClick={onMute}
                title={isMuted ? 'Unmute' : 'Mute'}
                style={btnCircle(isMuted ? 'var(--coral)' : 'var(--surface2)', 48)}
              >
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button onClick={onEnd} title="End call" style={btnCircle('var(--coral)', 56)}>
                📵
              </button>
            </div>
          </>
        )}

        {status === 'ended' && (
          recordingBlob ? (
            <>
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Recording
                </div>
                <audio controls src={recordingUrl} style={{ width: '100%', accentColor: 'var(--teal)' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={onSubmit}
                >
                  🎙️ Submit to platform
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={downloadMp3}
                  disabled={encoding}
                >
                  {encoding ? <><span className="spinner" /> Encoding MP3…</> : '⬇ Download MP3'}
                </button>
                {encodeError && (
                  <div style={{ fontSize: 11, color: 'var(--coral)', textAlign: 'center' }}>{encodeError}</div>
                )}
                <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={onBack}>
                  Back to assignments
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                Preparing recording…
              </div>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onBack}>
                Back to assignments
              </button>
            </>
          )
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>{errorMsg}</div>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onBack}>
              Go back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function btnCircle(bg, size) {
  return {
    width: size, height: size, borderRadius: '50%',
    background: bg, border: '1px solid transparent',
    cursor: 'pointer', fontSize: size >= 56 ? 22 : 20,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  }
}

// ── Submit modal ──────────────────────────────────────────────────────────────
function SubmitModal({ assignmentId, durationSec, callType, title, blob, ext, onClose, onSuccess }) {
  const isVishing = callType === 'vishing'
  const today     = new Date().toISOString().slice(0, 10)

  const [form, setForm] = useState({
    audioQuality: '', offScript: false, offScriptNotes: '', volunteerNotes: '',
    tGreeting: '', tSetup: '', tEscalation: '', tHarvest: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = field => e => setForm(f => ({
    ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }))

  async function submit() {
    setLoading(true); setError('')
    try {
      const filename = `call_${assignmentId}_${today}${ext}`
      const fd = new FormData()
      fd.append('assignment_id',  assignmentId)
      fd.append('audio_file',     blob, filename)
      fd.append('duration_sec',   durationSec)
      fd.append('recording_date', today)
      fd.append('off_script',     form.offScript)
      if (form.audioQuality)   fd.append('audio_quality',    form.audioQuality)
      if (form.offScriptNotes) fd.append('off_script_notes', form.offScriptNotes)
      if (form.volunteerNotes) fd.append('volunteer_notes',  form.volunteerNotes)
      if (isVishing) {
        if (form.tGreeting)   fd.append('t_greeting',   form.tGreeting)
        if (form.tSetup)      fd.append('t_setup',      form.tSetup)
        if (form.tEscalation) fd.append('t_escalation', form.tEscalation)
        if (form.tHarvest)    fd.append('t_harvest',    form.tHarvest)
      }
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
          <div className="alert alert-info" style={{ marginBottom: 16 }}>
            Submitting: <strong>{title}</strong> &nbsp;·&nbsp; {fmt(durationSec)}
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

          {isVishing && (
            <>
              <div className="section-divider">Phase timestamps (seconds from call start)</div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Greeting</label>
                  <input type="number" className="form-input" min="0" placeholder="e.g. 5" value={form.tGreeting} onChange={set('tGreeting')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Setup</label>
                  <input type="number" className="form-input" min="0" placeholder="e.g. 40" value={form.tSetup} onChange={set('tSetup')} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Escalation</label>
                  <input type="number" className="form-input" min="0" placeholder="e.g. 105" value={form.tEscalation} onChange={set('tEscalation')} />
                </div>
                <div className="form-group">
                  <label className="form-label">Harvest</label>
                  <input type="number" className="form-input" min="0" placeholder="e.g. 195" value={form.tHarvest} onChange={set('tHarvest')} />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <div className="checkbox-row">
              <input type="checkbox" id="off-script" checked={form.offScript} onChange={set('offScript')} />
              <label htmlFor="off-script">I deviated significantly from the script</label>
            </div>
          </div>
          {form.offScript && (
            <div className="form-group">
              <label className="form-label">Describe what changed</label>
              <textarea className="form-textarea" placeholder="Briefly describe…" value={form.offScriptNotes} onChange={set('offScriptNotes')} />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Notes for the researcher</label>
            <textarea className="form-textarea" placeholder="Any technical issues, background noise, etc." value={form.volunteerNotes} onChange={set('volunteerNotes')} />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <><span className="spinner" /> Uploading…</> : 'Submit recording'}
          </button>
        </div>
      </div>
    </div>
  )
}
