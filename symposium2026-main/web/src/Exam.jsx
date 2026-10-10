import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'
import { startSecurity, GUARD_SCRIPT } from './security/examSecurity.js'
import { loadFiles, checkName, legacy, buildPage, langOf } from './site.js'
import CodeEditor from './codeeditor.jsx'
import LockScreen from './LockScreen.jsx'
import './Exam.css'

// Plain keyword / snippet autocomplete. It is NOT an AI: it only knows a fixed list of HTML, CSS and
// JavaScript words, and nothing is sent anywhere. Set this to false to switch suggestions off completely.
const ENABLE_SUGGESTIONS = true

const LANG = {
  html: { badge: '<>', color: '#e37933', label: 'HTML' },
  css: { badge: '#', color: '#519aba', label: 'CSS' },
  js: { badge: 'JS', color: '#cbcb41', label: 'JavaScript' },
}

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
const NewFileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 1.5h6l4 4v9H3z" />
    <path d="M8 8v4M6 10h4" />
  </svg>
)

export default function Exam({ team, examId, endAt, onDone }) {
  const [questions, setQuestions] = useState([])
  const [left, setLeft] = useState(Math.max(0, endAt - Date.now()))
  const [locked, setLocked] = useState(false)
  const [sure, setSure] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [saved, setSaved] = useState(false)

  // ---- the student's files: [{ id, name, content }] ----
  const codeKey = 'code:' + team + ':' + examId
  const [store] = useState(() => loadFiles(localStorage.getItem(codeKey)))
  const [files, setFiles] = useState(store.files)
  const nextId = useRef(store.nextId)
  const [shown, setShown] = useState(store.files) // what the output panel shows (updated a moment after typing)
  const [page, setPage] = useState('index.html') // which html page the output panel shows

  // ---- layout ----
  const [view, setView] = useState('explorer') // side bar: 'explorer' | 'problem' | null (hidden)
  const [tabs, setTabs] = useState(() => store.files.map((f) => f.id))
  const [tab, setTab] = useState(store.files[0].id)
  const [pos, setPos] = useState({ ln: 1, col: 1 })
  const [edit, setEdit] = useState(null) // creating / renaming a file: { id (null = new), value, err }
  const [delId, setDelId] = useState(null) // file waiting for "Delete?" confirmation
  const [sideW, setSideW] = useState(250)
  const [outW, setOutW] = useState(() => Math.round(window.innerWidth * 0.38))
  const [drag, setDrag] = useState(null) // 'side' | 'out' while a divider is being dragged

  const lockedRef = useRef(false)
  const stopRef = useRef(() => {})
  const codeRef = useRef(files)
  const shownRef = useRef(shown)
  const pollRef = useRef(null)
  const timerRef = useRef(null)
  const busyRef = useRef(false)

  useEffect(() => {
    codeRef.current = files
    localStorage.setItem(codeKey, JSON.stringify({ files, nextId: nextId.current }))
    const t = setTimeout(() => setShown(files), 400)
    return () => clearTimeout(t)
  }, [files, codeKey])

  useEffect(() => { shownRef.current = shown }, [shown])

  // clicking a link to another page inside the output panel opens that page
  useEffect(() => {
    const onMsg = (e) => {
      const h = e.data && e.data.examNav
      if (!h) return
      const n = String(h).split(/[?#]/)[0].replace(/^\.?\//, '').toLowerCase()
      const f = shownRef.current.find((x) => x.name.toLowerCase() === n && langOf(x.name) === 'html')
      if (f) setPage(f.name)
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

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

  // dragging the dividers: left one resizes the side bar, right one resizes the output panel
  useEffect(() => {
    if (!drag) return
    const move = (e) => {
      if (drag === 'side') setSideW(Math.min(480, Math.max(150, e.clientX - 48)))
      else {
        const max = window.innerWidth - 48 - (view ? sideW : 0) - 200
        setOutW(Math.min(max, Math.max(200, window.innerWidth - e.clientX)))
      }
    }
    const up = () => setDrag(null)
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
  }, [drag, view, sideW])

  // Only finishes the exam when the SERVER confirms it saved the work.
  const finalize = async () => {
    if (busyRef.current) return { ok: false, reason: 'Please wait…' }
    busyRef.current = true
    const all = codeRef.current
    const r = await api
      .post('/api/submit', {
        team,
        examId,
        files: all.map(({ name, content }) => ({ name, content })),
        ...legacy(all), // html / css / js too, for older admin pages
      })
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

  // ---- tabs ----
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

  // ---- creating, renaming and deleting files ----
  const startNew = () => {
    setView('explorer')
    setEdit({ id: null, value: '', err: '' })
  }
  const startRename = (f) => {
    if (f.name.toLowerCase() === 'index.html') return // index.html is the main page
    setEdit({ id: f.id, value: f.name, err: '' })
  }
  const commitEdit = () => {
    if (!edit) return
    const err = checkName(edit.value, files, edit.id === null ? undefined : edit.id)
    if (err) return setEdit({ ...edit, err })
    const name = edit.value.trim()
    if (edit.id === null) {
      const id = nextId.current++
      setFiles((fs) => [...fs, { id, name, content: '' }])
      setTabs((t) => [...t, id])
      setTab(id)
    } else {
      setFiles((fs) => fs.map((f) => (f.id === edit.id ? { ...f, name } : f)))
    }
    setEdit(null)
  }
  // first click shows "Delete?", a second click within 3 seconds deletes
  const removeFile = (id) => {
    if (files.length <= 1) return
    if (delId !== id) {
      setDelId(id)
      setTimeout(() => setDelId((d) => (d === id ? null : d)), 3000)
      return
    }
    setDelId(null)
    const next = files.filter((f) => f.id !== id)
    setFiles(next)
    let open = tabs.filter((t) => t !== id)
    if (open.length === 0) open = [next[0].id]
    setTabs(open)
    if (tab === id) setTab(open[open.length - 1])
  }

  const current = files.find((f) => f.id === tab) || files[0]
  const lang = LANG[langOf(current.name)]

  // output panel: pages = every .html file; links between them work
  const pages = shown.filter((f) => langOf(f.name) === 'html').map((f) => f.name)
  const pageNow = pages.find((p) => p.toLowerCase() === page.toLowerCase()) || pages[0]
  const preview = buildPage(shown, pageNow, { prefix: GUARD_SCRIPT })

  const editRow = edit && (
    <div className="editrow">
      <input
        autoFocus
        value={edit.value}
        placeholder="name.html / .css / .js"
        spellCheck={false}
        onChange={(e) => setEdit({ ...edit, value: e.target.value, err: '' })}
        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit() }}
        onBlur={() => setEdit(null)}
      />
      {edit.err && <div className="eerr">{edit.err}</div>}
    </div>
  )

  return (
    <div className={'vs' + (drag ? ' dragging' : '')}>
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
          <>
            <div className="sidebar" style={{ width: sideW }}>
              {view === 'explorer' ? (
                <>
                  <div className="sbtitle">
                    EXPLORER
                    <span className="sbactions">
                      <button title="New file" onClick={startNew}><NewFileIcon /></button>
                    </span>
                  </div>
                  <div className="folder">▾ WEBSITE</div>
                  {files.map((f) => {
                    const L = LANG[langOf(f.name)]
                    if (edit && edit.id === f.id) return <div key={f.id}>{editRow}</div>
                    return (
                      <div
                        key={f.id}
                        className={'file' + (tab === f.id ? ' sel' : '')}
                        title="Click to open, double-click to rename"
                        onClick={() => openFile(f.id)}
                        onDoubleClick={() => startRename(f)}
                      >
                        <span className="badge" style={{ color: L.color }}>{L.badge}</span>
                        <span className="fname">{f.name}</span>
                        {f.name.toLowerCase() !== 'index.html' && (
                          <span
                            className={'del' + (delId === f.id ? ' sure' : '')}
                            title="Delete file"
                            onClick={(e) => { e.stopPropagation(); removeFile(f.id) }}
                          >{delId === f.id ? 'Delete?' : '×'}</span>
                        )}
                      </div>
                    )
                  })}
                  {edit && edit.id === null && editRow}
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
            <div
              className="splitter"
              title="Drag to resize (double-click to reset)"
              onMouseDown={(e) => { e.preventDefault(); setDrag('side') }}
              onDoubleClick={() => setSideW(250)}
            />
          </>
        )}

        {/* editor */}
        <div className="editorgroup">
          <div className="tabs">
            {tabs.map((id) => {
              const f = files.find((x) => x.id === id)
              if (!f) return null
              const L = LANG[langOf(f.name)]
              return (
                <div key={id} className={'tabitem' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
                  <span className="badge" style={{ color: L.color }}>{L.badge}</span>
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
            {files.map((f) => (
              <div key={f.id} className="pane" style={{ display: tab === f.id ? 'block' : 'none' }}>
                <CodeEditor
                  lang={langOf(f.name)}
                  value={f.content}
                  onChange={(v) => setFiles((fs) => fs.map((x) => (x.id === f.id ? { ...x, content: v } : x)))}
                  onCursor={setPos}
                  visible={tab === f.id}
                  suggestions={ENABLE_SUGGESTIONS}
                />
              </div>
            ))}
          </div>
        </div>

        {/* output */}
        <div
          className="splitter"
          title="Drag to resize (double-click to reset)"
          onMouseDown={(e) => { e.preventDefault(); setDrag('out') }}
          onDoubleClick={() => setOutW(Math.round(window.innerWidth * 0.38))}
        />
        <div className="output" style={{ width: outW }}>
          <div className="outhead">
            OUTPUT
            {pages.length > 1 && (
              <span className="pages">
                {pages.map((p) => (
                  <button key={p} className={'pagebtn' + (p === pageNow ? ' on' : '')} onClick={() => setPage(p)}>{p}</button>
                ))}
              </span>
            )}
          </div>
          <iframe title="Output" sandbox="allow-scripts" srcDoc={preview} />
        </div>
      </div>

      {/* status bar */}
      <div className="statusbar">
        <span>{saved ? '✓ Saved' : 'Auto-save on'}</span>
        <span className="sbright">
          {ENABLE_SUGGESTIONS && <span>Autocomplete: ↑ ↓ Enter / Tab</span>}
          <span>Files: {files.length}</span>
          <span>Ln {pos.ln}, Col {pos.col}</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>{lang.label}</span>
        </span>
      </div>

      {locked && <LockScreen />}
    </div>
  )
}