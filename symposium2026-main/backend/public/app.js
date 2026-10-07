const $ = (id) => document.getElementById(id)
const DURATION = 60 * 60 * 1000
const SESSION = 'examSession'

let team = '', examId = null, locked = false
let stopSecurity = () => {}
let timerId = null
let lockPoll = null

async function api(path, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined
  const r = await fetch(path, opts)
  return r.json()
}

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => (s.hidden = s.id !== id))
}

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

/* ---------- security: detect switching ---------- */
function startSecurity(onViolation) {
  const onVisibility = () => document.hidden && onViolation('tab-switch')
  // Clicking the preview iframe moves focus into it. That is NOT leaving the exam, so only
  // report a blur when the whole page (including the iframe) has really lost focus.
  const onBlur = () =>
    setTimeout(() => {
      if (document.activeElement && document.activeElement.tagName === 'IFRAME') return
      if (document.hasFocus()) return
      onViolation('window-blur')
    }, 0)
  const onMessage = (e) => {
    const m = e.data && e.data.examGuard
    if (!m) return
    if (m === 'iframe-blur') setTimeout(() => !document.hasFocus() && onViolation('window-blur'), 0)
    else onViolation(m)
  }
  const onFullscreen = () => !document.fullscreenElement && onViolation('fullscreen-exit')
  const onKey = (e) => {
    const k = e.key
    if (k === 'Meta' || k === 'Escape' || (e.altKey && k === 'Tab')) {
      e.preventDefault()
      onViolation('key:' + (e.altKey ? 'Alt+' : '') + k)
    }
    const devtools =
      k === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k.toUpperCase())) ||
      (e.ctrlKey && k.toLowerCase() === 'u')
    if (devtools) e.preventDefault()
  }
  const noMenu = (e) => e.preventDefault()
  const beforeUnload = (e) => { e.preventDefault(); e.returnValue = '' }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  document.addEventListener('fullscreenchange', onFullscreen)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('message', onMessage)
  document.addEventListener('contextmenu', noMenu)
  window.addEventListener('beforeunload', beforeUnload)
  if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => {})

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('fullscreenchange', onFullscreen)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('message', onMessage)
    document.removeEventListener('contextmenu', noMenu)
    window.removeEventListener('beforeunload', beforeUnload)
    if (navigator.keyboard && navigator.keyboard.unlock) navigator.keyboard.unlock()
  }
}

/* ---------- login screen ---------- */
async function checkStatus() {
  try {
    const r = await api('/api/exam/status')
    $('status').textContent = r.started
      ? 'The exam is open. Enter the code from the invigilator.'
      : 'Waiting for the admin to start the exam…'
    $('startBtn').disabled = !r.started
  } catch { /* ignore */ }
}
checkStatus()
const poll = setInterval(checkStatus, 3000)

$('startBtn').onclick = async () => {
  team = $('team').value.trim()
  const code = $('code').value.trim()
  if (!team || !code) return ($('err').textContent = 'Enter team name and exam code')
  try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
  const r = await api('/api/exam/join', { team, code }).catch(() => ({ ok: false, reason: 'Cannot reach server' }))
  if (!r.ok) {
    $('err').textContent = r.reason
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    return
  }
  clearInterval(poll)
  examId = r.examId
  localStorage.setItem(SESSION, JSON.stringify({ team, examId }))
  // convert server start time to this PC's clock
  const offset = Date.now() - r.serverNow
  startExam(r.startedAt + DURATION + offset)
}

/* ---------- exam screen ---------- */
const GUARD_SCRIPT = `<script>
addEventListener('keydown',function(e){var k=e.key;
if(k==='Meta'||k==='Escape'||(e.altKey&&k==='Tab')){e.preventDefault();parent.postMessage({examGuard:'key:'+(e.altKey?'Alt+':'')+k},'*')}
if(k==='F12'||(e.ctrlKey&&e.shiftKey&&'IJC'.indexOf(k.toUpperCase())>-1)||(e.ctrlKey&&k.toLowerCase()==='u'))e.preventDefault()},true);
addEventListener('blur',function(){parent.postMessage({examGuard:'iframe-blur'},'*')});
addEventListener('contextmenu',function(e){e.preventDefault()});
<\/script>`
const getCode = () => ({ html: $('html').value, css: $('css').value, js: $('js').value })
const codeKey = () => 'code:' + team + ':' + examId

function render() {
  const c = getCode()
  localStorage.setItem(codeKey(), JSON.stringify(c))
  $('preview').srcdoc = GUARD_SCRIPT + '<style>' + c.css + '</style>' + c.html + '<script>' + c.js + '<\/script>'
}

document.querySelectorAll('.editor nav button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.editor nav button').forEach((x) => x.classList.toggle('on', x === b))
    ;['html', 'css', 'js'].forEach((id) => ($(id).hidden = id !== b.dataset.tab))
  }
})
;['html', 'css', 'js'].forEach((id) => ($(id).oninput = render))
;['html', 'css', 'js'].forEach((id) => attachSuggest($(id), () => id)) // code suggestions

function startExam(end) {
  show('exam')
  $('teamName').textContent = team

  const saved = JSON.parse(localStorage.getItem(codeKey()) || 'null')
  if (saved) { $('html').value = saved.html; $('css').value = saved.css; $('js').value = saved.js }
  render()

  api('/api/questions').then((qs) => {
    $('questions').innerHTML = qs.map((q) => '<section><h3>' + q.title + '</h3><p>' + q.description + '</p></section>').join('')
  })

  stopSecurity = startSecurity((type) => {
    if (locked) return
    locked = true
    $('lock').hidden = false
    // retry until the server records the lock, then poll (otherwise we'd unlock instantly)
    const record = () =>
      api('/api/violation', { team, examId, type }).then(startLockPoll).catch(() => setTimeout(record, 2000))
    record()
  })

  timerId = setInterval(() => {
    const left = end - Date.now()
    $('timer').textContent = fmt(left)
    $('timer').classList.toggle('warn', left < 5 * 60 * 1000)
    if (left <= 0) finalize() // time up: auto-submit
  }, 1000)
}

/* ---------- unlock (after Alt+Tab etc.) ---------- */
// Admin can unlock remotely from the admin page: we poll the server while locked.
function startLockPoll() {
  clearInterval(lockPoll)
  lockPoll = setInterval(async () => {
    const r = await api('/api/lock/status?team=' + encodeURIComponent(team)).catch(() => null)
    if (r && r.locked === false) releaseLock()
  }, 2000)
}

async function releaseLock() {
  clearInterval(lockPoll)
  locked = false
  $('lock').hidden = true
  try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
}

/* ---------- submit (click twice to confirm) ---------- */
async function finalize() {
  const r = await api('/api/submit', { team, examId, ...getCode() }).catch(() => ({
    ok: false,
    reason: 'Cannot reach server',
  }))
  if (!r.ok) return r
  clearInterval(timerId)
  stopSecurity()
  if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
  $('doneTeam').textContent = team
  show('done')
  return r
}

let sure = false
$('submitBtn').onclick = async () => {
  if (!sure) {
    sure = true
    $('submitBtn').textContent = 'Click again to confirm'
    return setTimeout(() => { sure = false; $('submitBtn').textContent = 'Submit' }, 5000)
  }
  const r = await finalize()
  if (!r.ok) {
    sure = false
    $('submitBtn').textContent = 'Submit'
    alert(r.reason || 'Submit failed, try again')
  }
}

/* ---------- page reloaded: go back to the running exam instead of the login page ---------- */
async function tryResume() {
  let saved = null
  try { saved = JSON.parse(localStorage.getItem(SESSION) || 'null') } catch { /* ignore */ }
  if (!saved) return
  show('resume')
  const r = await api('/api/exam/resume', saved).catch(() => null)
  if (!r) {
    $('resumeMsg').textContent = ''
    $('resumeErr').textContent = 'Cannot reach server. Retrying…'
    return setTimeout(tryResume, 3000)
  }
  if (!r.ok) {
    localStorage.removeItem(SESSION)
    return show('login')
  }
  team = saved.team
  examId = saved.examId
  if (r.submitted) { $('doneTeam').textContent = team; return show('done') }
  clearInterval(poll)
  const end = r.startedAt + DURATION + (Date.now() - r.serverNow)
  $('resumeErr').textContent = ''
  $('resumeTitle').textContent = 'Welcome back, ' + team
  $('resumeMsg').textContent = 'Your exam is still running and your code was saved. Press Continue to return in fullscreen.'
  $('resumeBtn').hidden = false
  $('resumeBtn').onclick = async () => {
    try { await document.documentElement.requestFullscreen() } catch { /* ignore */ }
    startExam(end)
  }
}
tryResume()
