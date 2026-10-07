import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { startSecurity, GUARD_SCRIPT } from './security/examSecurity.js'
import { attachSuggest } from './suggest.js'
import LockScreen from './LockScreen.jsx'
import './Exam.css'

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

export default function Exam({ team, examId, endAt, onDone }) {
  const [questions, setQuestions] = useState([])
  const [left, setLeft] = useState(Math.max(0, endAt - Date.now()))
  const [locked, setLocked] = useState(false)
  const [sure, setSure] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [tab, setTab] = useState('html')
  const codeKey = 'code:' + team + ':' + examId
  const [code, setCode] = useState(
    () => JSON.parse(localStorage.getItem(codeKey) || 'null') || { html: '<h1>Hello</h1>', css: '', js: '' }
  )
  const lockedRef = useRef(false)
  const stopRef = useRef(() => {})
  const codeRef = useRef(code)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const taRef = useRef(null)
  const tabRef = useRef('html')

  // code suggestions in the editor (current tab decides html / css / js suggestions)
  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => attachSuggest(taRef.current, () => tabRef.current), [])

  useEffect(() => {
    codeRef.current = code
    localStorage.setItem(codeKey, JSON.stringify(code))
  }, [code, codeKey])

  // Only finishes the exam when the SERVER confirms it saved the work.
  const finalize = async () => {
    if (busyRef.current) return { ok: false, reason: 'Please wait…' }
    busyRef.current = true
    const r = await api
      .post('/api/submit', { team, examId, ...codeRef.current })
      .catch(() => ({ ok: false, reason: 'Cannot reach server' }))
    busyRef.current = false
    if (!r.ok) return r
    clearInterval(timerRef.current)
    clearInterval(pollRef.current)
    stopRef.current()
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    onDone()
    return r
  }

  // First click asks "Click again to confirm", second click submits.
  const onSubmitClick = async () => {
    if (!sure) {
      setSure(true)
      setTimeout(() => setSure(false), 5000)
      return
    }
    const r = await finalize()
    if (!r.ok) { setSubmitErr(r.reason || 'Submit failed, try again'); setSure(false) }
  }

  useEffect(() => {
    api.get('/api/questions').then(setQuestions).catch(() => {})

    // Locked until the admin unlocks this team from the admin dashboard.
    const startPoll = () => {
      clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        const r = await api.get('/api/lock/status?team=' + encodeURIComponent(team)).catch(() => null)
        if (r && r.locked === false) unlock()
      }, 2000)
    }

    // Record the violation on the server (retry until it works, so the lock can never be skipped),
    // and only then start polling, otherwise we'd unlock instantly.
    const recordViolation = (type) =>
      api.post('/api/violation', { team, examId, type })
        .then(startPoll)
        .catch(() => setTimeout(() => recordViolation(type), 2000))

    // If the page was refreshed while locked, stay locked.
    api.get('/api/lock/status?team=' + encodeURIComponent(team))
      .then((r) => {
        if (r && r.locked) { lockedRef.current = true; setLocked(true); startPoll() }
      })
      .catch(() => {})

    stopRef.current = startSecurity((type) => {
      if (lockedRef.current) return
      lockedRef.current = true
      setLocked(true)
      recordViolation(type)
    })

    timerRef.current = setInterval(() => {
      const l = endAt - Date.now()
      setLeft(l)
      if (l <= 0) finalize() // time up: auto-submit, retried every second until the server accepts it
    }, 1000)

    return () => { clearInterval(timerRef.current); clearInterval(pollRef.current); stopRef.current() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unlock = async () => {
    clearInterval(pollRef.current)
    lockedRef.current = false
    setLocked(false)
    try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
  }

  const preview = GUARD_SCRIPT + `<style>${code.css}</style>${code.html}<script>${code.js}<\/script>`

  return (
    <div className="exam">
      <header>
        <b>{team}</b>
        <span className={left < 5 * 60 * 1000 ? 'timer warn' : 'timer'}>{fmt(left)}</span>
        <span className="err">{submitErr}</span>
        <button className="submit" onClick={onSubmitClick}>
          {sure ? 'Click again to confirm' : 'Submit'}
        </button>
      </header>

      <aside>
        {questions.map((q) => (
          <section key={q.id}>
            <h3>{q.title}</h3>
            <p>{q.description}</p>
          </section>
        ))}
      </aside>

      <div className="editor">
        <nav>
          {['html', 'css', 'js'].map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t.toUpperCase()}</button>
          ))}
          <span style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: '#7d8a9c' }}>
            Suggestions: ↑ ↓ choose · Enter / Tab accept · Ctrl+Space open
          </span>
        </nav>
        <textarea
          ref={taRef}
          spellCheck={false}
          value={code[tab]}
          onChange={(e) => setCode({ ...code, [tab]: e.target.value })}
        />
      </div>

      <iframe title="preview" sandbox="allow-scripts" srcDoc={preview} />

      {locked && <LockScreen />}
    </div>
  )
}
