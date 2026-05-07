import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { apiGet } from '../../api'

const STUN_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

const roleLabel = r => r === 'scammer' ? 'Speaker 1' : 'Speaker 2'

function fmt(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = (sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function CallRoom() {
  const { roomId }            = useParams()
  const [searchParams]        = useSearchParams()
  const navigate              = useNavigate()
  const assignmentId          = searchParams.get('aid')
  const scriptId              = roomId?.split('-')[1]

  const [status, setStatus]   = useState('connecting') // connecting|waiting|in-call|ended|error
  const [isMuted, setIsMuted] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [roomInfo, setRoomInfo] = useState(null)
  const [script, setScript]   = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  const wsRef           = useRef(null)
  const pcRef           = useRef(null)
  const localStreamRef  = useRef(null)
  const remoteAudioRef  = useRef(null)
  const timerRef        = useRef(null)
  const closingRef      = useRef(false) // set to true when we intentionally close

  // ── Load room info + script ───────────────────────────────────────────────
  useEffect(() => {
    if (assignmentId && scriptId) {
      Promise.all([
        apiGet(`/api/call/room/${assignmentId}`),
        apiGet(`/api/volunteer/scripts/${scriptId}`),
      ]).then(([room, sc]) => {
        if (room) setRoomInfo(room)
        if (sc)   setScript(sc)
      })
    }
    connectWS()
    return doCleanup
  }, [])

  // ── WebSocket connection ──────────────────────────────────────────────────
  function connectWS() {
    const token = localStorage.getItem('token')
    if (!token) { setStatus('error'); setErrorMsg('Not authenticated.'); return }

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url   = `${proto}//${window.location.host}/api/call/ws/${roomId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = async (e) => {
      try { await handleSignal(JSON.parse(e.data)) } catch (_) {}
    }

    ws.onerror = () => {
      if (!closingRef.current) {
        setStatus('error')
        setErrorMsg('Could not connect to the call server. Please try again.')
      }
    }

    ws.onclose = () => {
      if (!closingRef.current) {
        setStatus('ended')
        stopTimer()
      }
    }
  }

  function send(msg) {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }

  // ── WebRTC signaling handler ──────────────────────────────────────────────
  async function handleSignal(msg) {
    switch (msg.type) {

      case 'waiting':
        setStatus('waiting')
        break

      case 'peer_joined':
        // We were waiting; partner just joined. Set up media but don't create offer.
        setStatus('in-call')
        await setupMedia(false)
        startTimer()
        break

      case 'peer_present':
        // We're the second to connect — we create the offer.
        setStatus('in-call')
        await setupMedia(true)
        startTimer()
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
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        }
        break

      case 'ice-candidate':
        if (pcRef.current && msg.candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(msg.candidate)) } catch (_) {}
        }
        break

      case 'peer_left':
        setStatus('ended')
        stopTimer()
        break

      case 'error':
        setStatus('error')
        setErrorMsg(msg.message || 'An error occurred.')
        break
    }
  }

  // ── Media + peer connection ───────────────────────────────────────────────
  async function setupMedia(initiator) {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (_) {
      setStatus('error')
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.')
      return
    }

    const pc = new RTCPeerConnection(STUN_CONFIG)
    pcRef.current = pc

    localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = e.streams[0]
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) send({ type: 'ice-candidate', candidate: e.candidate })
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatus('ended')
        stopTimer()
      }
    }

    if (initiator) {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      send({ type: 'offer', sdp: offer })
    }
  }

  // ── Timer ────────────────────────────────────────────────────────────────
  function startTimer() {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  function doCleanup() {
    closingRef.current = true
    stopTimer()
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop())
    if (pcRef.current)          pcRef.current.close()
    if (wsRef.current)          wsRef.current.close()
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled) }
  }

  function endCall() {
    doCleanup()
    setStatus('ended')
  }

  function goBack() {
    doCleanup()
    navigate('/volunteer')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Header bar */}
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
              Partner:&nbsp;<strong style={{ color: 'var(--text2)' }}>{roomInfo.partner.full_name}</strong>
              &nbsp;·&nbsp;{roleLabel(roomInfo.partner.role)}
            </div>
          )}
        </div>
        <div style={{
          fontFamily: 'var(--mono)', fontSize: 22, letterSpacing: 2,
          color: status === 'in-call' ? 'var(--teal)' : 'var(--text3)',
        }}>
          {fmt(elapsed)}
        </div>
      </div>

      {/* Body: script + controls side-by-side */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Script panel */}
        <div style={{
          flex: 1, padding: '24px 28px', overflowY: 'auto',
          borderRight: '1px solid var(--border)',
        }}>
          <div style={{
            fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase',
            letterSpacing: 1.5, marginBottom: 14,
          }}>
            Script
          </div>
          {script?.content ? (
            <pre style={{
              whiteSpace: 'pre-wrap', fontSize: 13.5, lineHeight: 2,
              color: 'var(--text2)', fontFamily: 'var(--sans)',
            }}>
              {script.content}
            </pre>
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>
              {script === null ? 'Loading script…' : 'No script content available.'}
            </div>
          )}
        </div>

        {/* Call controls panel */}
        <div style={{
          width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32,
        }}>

          {status === 'connecting' && (
            <>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--surface2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>⏳</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>Connecting…</div>
            </>
          )}

          {status === 'waiting' && (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--surface2)', border: '2px dashed var(--border2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>⏳</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Waiting for partner</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Share this room with your partner.<br />The call will start automatically.
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={goBack}>Cancel</button>
            </>
          )}

          {status === 'in-call' && (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#0EA98A18', border: '2px solid var(--teal)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>📞</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, color: 'var(--teal)', marginBottom: 4 }}>Call in progress</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {roomInfo?.partner?.full_name ?? 'Partner connected'}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                {/* Mute button */}
                <button
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                  style={{
                    width: 52, height: 52, borderRadius: '50%', border: '1px solid var(--border2)',
                    background: isMuted ? 'var(--coral)' : 'var(--surface2)',
                    cursor: 'pointer', fontSize: 20, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isMuted ? '🔇' : '🎤'}
                </button>

                {/* End call button */}
                <button
                  onClick={endCall}
                  title="End call"
                  style={{
                    width: 60, height: 60, borderRadius: '50%', border: 'none',
                    background: 'var(--coral)', cursor: 'pointer', fontSize: 22,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  📵
                </button>
              </div>

              {isMuted && (
                <div style={{ fontSize: 11, color: 'var(--coral)', textAlign: 'center' }}>
                  Microphone muted
                </div>
              )}
            </>
          )}

          {status === 'ended' && (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--surface2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>📵</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Call ended</div>
                <div style={{ fontSize: 13, color: 'var(--teal)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
                  {fmt(elapsed)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  Go back to your assignments to submit the recording.
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={goBack}>
                Back to assignments
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#E05C4A18', border: '2px solid var(--coral)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
              }}>⚠️</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: 'var(--coral)', fontWeight: 600, marginBottom: 8 }}>
                  Connection error
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{errorMsg}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={goBack}>Go back</button>
            </>
          )}

        </div>
      </div>

      {/* Hidden audio element plays the remote stream */}
      <audio ref={remoteAudioRef} autoPlay />
    </div>
  )
}
