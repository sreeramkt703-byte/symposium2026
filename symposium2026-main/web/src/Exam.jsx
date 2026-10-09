import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { startSecurity, GUARD_SCRIPT } from './security/examSecurity.js'
import CodeEditor from './CodeEditor.jsx'
import LockScreen from './LockScreen.jsx'
import './Exam.css'

// Plain keyword / snippet autocomplete. It is NOT an AI: it only knows a fixed list of HTML, CSS and
// JavaScript words, and nothing is sent anywhere. Set this to false to switch suggestions off completely.
const ENABLE_SUGGESTIONS = true

const FILES = [
  { id: 'html', name: 'index.html', label: 'HTML', badge: '<>', color: '#e37933' },
  { id: 'css', name: 'style.css', label: 'CSS', badge: '#', color: '#519aba' },
  { id: 'js', name: 'script.js', label: 'JavaScript', badge: 'JS', color: '#cbcb41' },
]

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

const ExplorerIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d="M8 3h8l4 4v10a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M5 7v13a1 1 0 0 0 1 1h10" />
  </svg>
)
const ProblemIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
)

export default function Exam({ team, examId, endAt, onDone }) {
  const [questions, setQuestions] = useState([])
  const [left, setLeft] = useState(Math.max(0, endAt - Date.now()))
  const [locked, setLocked] = useState(false)
  const [sure, setSure] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [saved, setSaved] = useState(false)

  // editor layout
  const [view, setView] = useState('explorer') // side bar: 'explorer' | 'problem' | null (hidden)
  const [tabs, setTabs] = useState(['html', 'css', 'js'])
  const [tab, setTab] = useState('html')
  const [pos, setPos] = useState({ ln: 1, col: 1 })

  const codeKey = 'code:' + team + ':' + examId
  const [code, setCode] = useState(
    () => JSON.parse(localStorage.getItem(codeKey) || 'null') || { html: '<h1>Hello</h1>', css: '', js: '' }
  )
  const [shown, setShown] = useState(code) // what the output panel shows (updated a moment after typing)

  const lockedRef = useRef(false)
  const stopRef = useRef(() => {})
  const codeRef = useRef(code)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => {
    codeRef.current = code
    localStorage.setItem(codeKey, JSON.stringify(code))
    const t = setTimeout(() => setShown(code), 400)
    return () => clearTimeout(t)
  }, [code, codeKey])

  // Ctrl+S would open the browser's "save page" window and lock the screen, so it just shows "Saved"
  // (the code is saved automatically anyway). Ctrl+P and Ctrl+O are blocked for the same reason.
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'p' || k === 'o')) {
        e.preventDefault()
        if (k === 's') {
          setSaved(true)
          setTimeout(() => setSaved(false), 1500)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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

  // open / close editor tabs
  const openFile = (id) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]))
    setTab(id)
  }
  const closeTab = (id) => {
    if (tabs.length === 1) return // always keep one file open
    const next = tabs.filter((t) => t !== id)
    setTabs(next)
    if (tab === id) setTab(next[next.length - 1])
  }
  const toggleView = (v) => setView((cur) => (cur === v ? null : v))

  const current = FILES.find((f) => f.id === tab)
  const preview = GUARD_SCRIPT + `<style>${shown.css}</style>${shown.html}<script>${shown.js}<\/script>`

  return (
    <div className="vs">
      {/* title bar */}
      <div className="titlebar">
        <span className="brand">{'{ }'}</span>
        <span className="title">{current.name} — {team}</span>
        <span className="titleright">
          <span className="err">{submitErr}</span>
          <span className={left < 5 * 60 * 1000 ? 'clock warn' : 'clock'}>⏱ {fmt(left)}</span>
          <button className={sure ? 'submit sure' : 'submit'} onClick={onSubmitClick}>
            {sure ? 'Click again to confirm' : 'Submit'}
          </button>
        </span>
      </div>

      <div className="main">
        {/* activity bar */}
        <div className="activity">
          <button className={view === 'explorer' ? 'on' : ''} title="Explorer" onClick={() => toggleView('explorer')}>
            <ExplorerIcon />
          </button>
          <button className={view === 'problem' ? 'on' : ''} title="Problem statement" onClick={() => toggleView('problem')}>
            <ProblemIcon />
          </button>
        </div>

        {/* side bar */}
        {view && (
          <div className="sidebar">
            {view === 'explorer' ? (
              <>
                <div className="sbtitle">EXPLORER</div>
                <div className="folder">▾ WEBSITE</div>
                {FILES.map((f) => (
                  <div key={f.id} className={'file' + (tab === f.id ? ' sel' : '')} onClick={() => openFile(f.id)}>
                    <span className="badge" style={{ color: f.color }}>{f.badge}</span>
                    {f.name}
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="sbtitle">PROBLEM STATEMENT</div>
                <div className="problem">
                  {questions.length === 0 && <p>Loading…</p>}
                  {questions.map((q) => (
                    <section key={q.id}>
                      <h3>{q.title}</h3>
                      <p>{q.description}</p>
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* editor */}
        <div className="editorgroup">
          <div className="tabs">
            {tabs.map((id) => {
              const f = FILES.find((x) => x.id === id)
              return (
                <div key={id} className={'tabitem' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
                  <span className="badge" style={{ color: f.color }}>{f.badge}</span>
                  {f.name}
                  {tabs.length > 1 && (
                    <span
                      className="x"
                      title="Close"
                      onClick={(e) => { e.stopPropagation(); closeTab(id) }}
                    >×</span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="editors">
            {FILES.map((f) => (
              <div key={f.id} className="pane" style={{ display: tab === f.id ? 'block' : 'none' }}>
                <CodeEditor
                  lang={f.id}
                  value={code[f.id]}
                  onChange={(v) => setCode((c) => ({ ...c, [f.id]: v }))}
                  onCursor={setPos}
                  visible={tab === f.id}
                  suggestions={ENABLE_SUGGESTIONS}
                />
              </div>
            ))}
          </div>
        </div>

        {/* output */}
        <div className="output">
          <div className="outhead">OUTPUT</div>
          <iframe title="Output" sandbox="allow-scripts" srcDoc={preview} />
        </div>
      </div>

      {/* status bar */}
      <div className="statusbar">
        <span>{saved ? '✓ Saved' : 'Auto-save on'}</span>
        <span className="sbright">
          {ENABLE_SUGGESTIONS && <span>Autocomplete: ↑ ↓ Enter / Tab</span>}
          <span>Ln {pos.ln}, Col {pos.col}</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>{current.label}</span>
        </span>
      </div>

      {locked && <LockScreen />}
    </div>
  )
}