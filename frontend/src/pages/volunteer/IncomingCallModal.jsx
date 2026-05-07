import { useEffect, useState } from 'react'

const RING_TONES = [440, 480]

export default function IncomingCallModal({ call, onAccept, onReject }) {
  const [secondsLeft, setSecondsLeft] = useState(60)

  useEffect(() => {
    if (!call) return
    setSecondsLeft(60)

    let stopped = false
    let ctx = null
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch (_) {
      ctx = null
    }

    async function ring() {
      while (!stopped && ctx) {
        for (const f of RING_TONES) {
          if (stopped) return
          let osc, gain
          try {
            osc  = ctx.createOscillator()
            gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = f
            gain.gain.value = 0.12
            osc.connect(gain).connect(ctx.destination)
            osc.start()
          } catch (_) { return }
          await new Promise(r => setTimeout(r, 450))
          try { osc.stop() } catch (_) {}
        }
        await new Promise(r => setTimeout(r, 900))
      }
    }
    ring().catch(() => {})

    const tickId = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(tickId)
          onReject('timeout')
          return 0
        }
        return s - 1
      })
    }, 1000)

    return () => {
      stopped = true
      clearInterval(tickId)
      try { ctx?.close() } catch (_) {}
    }
  }, [call?.room_id])

  if (!call) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal" style={{ maxWidth: 380, width: '90%' }}>
        <div style={{ padding: '32px 28px 24px', textAlign: 'center' }}>
          <div style={{
            fontSize: 56, marginBottom: 12,
            animation: 'ring-shake 1.4s ease-in-out infinite',
          }}>📞</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>
            Incoming call
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {call.from_name}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
            {call.script_title}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 24 }}>
            Auto-decline in {secondsLeft}s
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button
              onClick={() => onReject('user')}
              className="btn"
              style={{ background: 'var(--coral)', color: '#fff', border: 'none', padding: '10px 22px', minWidth: 120, justifyContent: 'center' }}
            >
              ✕ Decline
            </button>
            <button
              onClick={onAccept}
              className="btn"
              style={{ background: 'var(--teal)', color: '#fff', border: 'none', padding: '10px 22px', minWidth: 120, justifyContent: 'center' }}
            >
              ✓ Accept
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ring-shake {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(-12deg); }
          30% { transform: rotate(12deg); }
          45% { transform: rotate(-8deg); }
          60% { transform: rotate(8deg); }
          75% { transform: rotate(0deg); }
        }
      `}</style>
    </div>
  )
}
