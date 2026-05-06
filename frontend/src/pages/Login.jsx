import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const role  = localStorage.getItem('role')
    if (token) navigate(role === 'admin' ? '/admin' : '/volunteer', { replace: true })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body = new URLSearchParams({ username: email, password })
      const res  = await fetch('/api/auth/token', { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Login failed')
      localStorage.setItem('token', data.access_token)
      localStorage.setItem('role',  data.role)
      localStorage.setItem('name',  data.name)
      localStorage.setItem('pid',   data.participant_id)
      navigate(data.role === 'admin' ? '/admin' : '/volunteer', { replace: true })
    } catch (ex) {
      setError(ex.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-wordmark">VOICEGUARD</div>
          <div className="login-tagline">Dataset Collection Portal · Research Access Only</div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              type="email" className="form-input" placeholder="your@email.com"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password" className="form-input" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)} required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} disabled={loading}>
            {loading ? <><span className="spinner" /> Signing in...</> : 'Sign in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text3)' }}>
          Access is restricted to approved research participants.<br />
          Contact the research team if you need assistance.
        </p>
      </div>
    </div>
  )
}
