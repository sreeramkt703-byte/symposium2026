import { useEffect, useState } from 'react'
import { api } from './api.js'

export default function Login({ onStart }) {
  const [team, setTeam] = useState('')
  const [code, setCode] = useState('')
  const [started, setStarted] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const load = () => api.get('/api/exam/status').then((r) => setStarted(r.started)).catch(() => {})
    load()
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [])

  const start = async () => {
    if (!team.trim() || !code.trim()) return setErr('Enter team name and exam code')
    try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
    const r = await api
      .post('/api/exam/join', { team: team.trim(), code: code.trim() })
      .catch(() => ({ ok: false, reason: 'Cannot reach server' }))
    if (!r.ok) {
      setErr(r.reason)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
      return
    }
    // end time from the SERVER start time, converted to this PC's clock (can't be reset by clearing storage)
    const offset = Date.now() - r.serverNow
    onStart(team.trim(), r.examId, r.startedAt + 60 * 60 * 1000 + offset)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-intro">
          <div className="brand-row">
            <span className="brand-mark">W</span>
               <span>Web Coding</span>
          </div>
          <p className="eyebrow">Coding challenge</p>
          <h1>Web Development Competition</h1>
          <p className="subtitle">Access your exam, stay focused, and submit your work with confidence.</p>
          <ul className="feature-list">
            <li>60-minute timed challenge</li>
            <li>Fullscreen exam mode with secure monitoring</li>
            <li>Locked screen protection for tab switches and keyboard shortcuts</li>
            <li>Review and submit once your work is complete</li>
          </ul>
        </div>

        <div className="auth-panel">
          <div className="status-row">
            <span className={`status-pill ${started ? 'live' : 'waiting'}`}>
              {started ? 'Exam open' : 'Waiting room'}
            </span>
          </div>
          <h2>Enter your exam</h2>
          <p className="panel-copy">
            {started ? 'The exam is open. Enter the code from the invigilator.' : 'Waiting for the admin to start the exam…'}
          </p>

          <label className="field">
            <span>Team name</span>
            <input placeholder="Team name or ID" value={team} onChange={(e) => setTeam(e.target.value)} />
          </label>

          <label className="field">
            <span>Exam code</span>
            <input placeholder="Exam code" value={code} onChange={(e) => setCode(e.target.value)} />
          </label>

          <button className="primary-button" onClick={start} disabled={!started}>Start exam</button>
          <p className="err">{err}</p>
        </div>
      </div>
    </div>
  )
}