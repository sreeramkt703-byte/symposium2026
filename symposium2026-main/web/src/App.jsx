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
    <div className="center">
      <h1>Submitted</h1>
      <p>Thank you, {team}. Your work was saved.</p>
      <p>Going back to the login page in {Math.max(left, 0)} seconds…</p>
      <button onClick={onBack}>Back to login now</button>
    </div>
  )
}

export default function App() {
  const saved = readSession()
  const [team, setTeam] = useState(saved?.team || '')
  const [examId, setExamId] = useState(saved?.examId || null)
  const [endAt, setEndAt] = useState(0)
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

  const resume = async () => {
    setErr('')
    const s = readSession()
    if (!s) return setStage('login')
    const r = await api.post('/api/exam/resume', s).catch(() => null)
    if (!r) return setErr('Cannot reach server')
    if (!r.ok) { localStorage.removeItem(SESSION); return setStage('login') }
    setTeam(s.team)
    setExamId(s.examId)
    if (r.submitted) return setStage('done')
    setEndAt(r.startedAt + 60 * 60 * 1000 + (Date.now() - r.serverNow))
    setStage('resume')
  }

  useEffect(() => {
    if (stage === 'resuming') resume()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // fullscreen needs a click, so after a reload the student presses Continue
  const continueExam = async () => {
    try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
    setStage('exam')
  }

  if (stage === 'resuming')
    return (
      <div className="center">
        <h1>Restoring your exam…</h1>
        <p className="err">{err}</p>
        {err && <button onClick={resume}>Retry</button>}
      </div>
    )
  if (stage === 'resume')
    return (
      <div className="center">
        <h1>Welcome back, {team}</h1>
        <p>Your exam is still running and your code was saved. Press Continue to return in fullscreen.</p>
        <button onClick={continueExam}>Continue exam</button>
      </div>
    )
  if (stage === 'login')
    return (
      <Login
        onStart={(t, id, end) => {
          localStorage.setItem(SESSION, JSON.stringify({ team: t, examId: id }))
          setTeam(t); setExamId(id); setEndAt(end); setStage('exam')
        }}
      />
    )
  if (stage === 'exam') return <Exam team={team} examId={examId} endAt={endAt} onDone={() => setStage('done')} />
  return <Done team={team} onBack={goLogin} />
}