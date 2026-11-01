import { useEffect, useState } from 'react'
import Login from './Login.jsx'
import Exam from './Exam.jsx'
import { api } from './api.js'
import './App.css'

const SESSION = 'examSession'
const readSession = () => {
  try { return JSON.parse(localStorage.getItem(SESSION) || 'null') } catch { return null }
}

// Shown after submitting. Goes back to the login page by itself (or when the button is pressed).
function Done({ team, onBack }) {
  const [left, setLeft] = useState(10)
  useEffect(() => {
    const id = setInterval(() => setLeft((n) => n - 1), 1000)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (left <= 0) onBack()
  }, [left, onBack])
  return (
    <div className="center app-status">
      <div className="status-card">
        <span className="eyebrow success">Submission received</span>
        <h1>Submitted</h1>
        <p>Thank you, {team}. Your work was saved.</p>
        <p className="supporting-text">Going back to the login page in {Math.max(left, 0)} seconds…</p>
        <button onClick={onBack}>Back to login now</button>
      </div>
    </div>
  )
}

export default function App() {
  const [saved] = useState(readSession)
  const [team, setTeam] = useState(saved?.team || '')
  const [examId, setExamId] = useState(saved?.examId || null)
  const [endAt, setEndAt] = useState(0)
  const [remainingAtStart, setRemainingAtStart] = useState(0)
  const [resumeAttempt, setResumeAttempt] = useState(0)
  // 'resuming' = page was reloaded, asking the server whether this team still has a running exam
  const [stage, setStage] = useState(saved ? 'resuming' : 'login')
  const [err, setErr] = useState('')

  // forget this team on this computer and show the login page again
  const goLogin = () => {
    localStorage.removeItem(SESSION)
    if (team && examId) localStorage.removeItem('code:' + team + ':' + examId)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    setTeam('')
    setExamId(null)
    setEndAt(0)
    setErr('')
    setStage('login')
  }

  useEffect(() => {
    if (stage !== 'resuming' || !saved) return

    let active = true
    api.post('/api/exam/resume', saved).catch(() => null).then((r) => {
      if (!active) return
      if (!r) return setErr('Cannot reach server')
      if (!r.ok) {
        localStorage.removeItem(SESSION)
        setStage('login')
        return
      }

      setTeam(saved.team)
      setExamId(saved.examId)
      if (r.submitted) {
        setStage('done')
        return
      }
      const resumedEndAt = r.startedAt + 60 * 60 * 1000 + (Date.now() - r.serverNow)
      setEndAt(resumedEndAt)
      setRemainingAtStart(Math.max(0, resumedEndAt - Date.now()))
      setStage('resume')
    })

    return () => { active = false }
  }, [stage, resumeAttempt, saved])

  // fullscreen needs a click, so after a reload the student presses Continue
  const continueExam = async () => {
    try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
    setRemainingAtStart(Math.max(0, endAt - Date.now()))
    setStage('exam')
  }

  if (stage === 'resuming')
    return (
      <div className="center app-status">
        <div className="status-card">
          <span className="eyebrow">Secure restore</span>
          <h1>Restoring your exam…</h1>
          <p className="err">{err}</p>
          {err && <button onClick={() => { setErr(''); setResumeAttempt((attempt) => attempt + 1) }}>Retry</button>}
        </div>
      </div>
    )
  if (stage === 'resume')
    return (
      <div className="center app-status">
        <div className="status-card">
          <span className="eyebrow info">Welcome back</span>
          <h1>Welcome back, {team}</h1>
          <p>Your exam is still running and your code was saved. Press Continue to return in fullscreen.</p>
          <button onClick={continueExam}>Continue exam</button>
        </div>
      </div>
    )
  if (stage === 'login')
    return (
      <Login
        onStart={(t, id, end) => {
          localStorage.setItem(SESSION, JSON.stringify({ team: t, examId: id }))
          setTeam(t); setExamId(id); setEndAt(end)
          setRemainingAtStart(Math.max(0, end - Date.now()))
          setStage('exam')
        }}
      />
    )
  if (stage === 'exam') return <Exam team={team} examId={examId} endAt={endAt} initialRemaining={remainingAtStart} onDone={() => setStage('done')} />
  return <Done team={team} onBack={goLogin} />
}