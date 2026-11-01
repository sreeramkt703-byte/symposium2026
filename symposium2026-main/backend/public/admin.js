const $ = (id) => document.getElementById(id)
const DURATION = 60 * 60 * 1000
let pw = ''
let current = null
let delArmed = ''
let deleteAllArmed = false

async function api(path, body) {
  const opts = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined
  const r = await fetch(path, opts)
  return r.json()
}

/* ---------- login (first time: typed password becomes the admin password) ---------- */
fetch('/api/admin/configured')
  .then((r) => r.json())
  .then((r) => {
    if (!r.configured) {
      $('hint').hidden = false
      $('loginBtn').textContent = 'Set password & open dashboard'
    }
  })
  .catch(() => {})

$('loginBtn').onclick = async () => {
  pw = $('pw').value
  let r
  try { r = await api('/api/unlock', { password: pw }) }
  catch { return ($('err').textContent = 'Cannot reach backend. Is npm start running?') }
  if (!r.ok) {
    return ($('err').textContent = $('hint').hidden
      ? 'Wrong password. Check backend/.env'
      : 'Use at least 4 characters, no quotes. Open this page on the server PC (localhost).')
  }
  $('login').hidden = true
  $('panel').hidden = false
  load()
  setInterval(load, 3000)
}
$('pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('loginBtn').click() })

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString() : '-')
const fmtDur = (ms) => Math.floor(ms / 60000) + 'm ' + (Math.floor(ms / 1000) % 60) + 's'

const LABEL = {
  submitted: 'Submitted',
  'time-up': 'Time up (auto-submitted)',
  over: 'Time over, not submitted',
  'in-progress': 'In progress',
}
const statusOf = (t) => LABEL[t.state] || t.state

function fill(tbodyId, rows, clicks) {
  const body = $(tbodyId)
  body.innerHTML = ''
  rows.forEach((cells, i) => {
    const tr = document.createElement('tr')
    if (clicks && clicks[i]) {
      tr.className = 'clickable'
      tr.onclick = clicks[i]
    }
    cells.forEach((v) => {
      const td = document.createElement('td')
      if (v instanceof Node) td.appendChild(v)
      else td.textContent = v
      tr.appendChild(td)
    })
    body.appendChild(tr)
  })
}

async function unlockTeam(team) {
  await api('/api/lock/unlock', { password: pw, team })
  load()
}

function unlockCell(team, locked) {
  if (!locked) return '-'
  const b = document.createElement('button')
  b.textContent = 'Unlock'
  b.onclick = (e) => {
    e.stopPropagation() // don't open the submission viewer
    b.disabled = true
    unlockTeam(team)
  }
  return b
}

function openCell(t) {
  if (!t.hasSubmission) return '-'
  const b = document.createElement('button')
  b.textContent = 'Open'
  b.onclick = (e) => {
    e.stopPropagation()
    openViewer(t)
  }
  return b
}

function downloadCell(t) {
  if (!t.hasSubmission) return '-'
  const b = document.createElement('button')
  b.textContent = 'Download ZIP'
  b.onclick = (e) => {
    e.stopPropagation()
    const filename = String(t.team).replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^\.+/, '_').slice(0, 60) || 'team'
    downloadZip('/api/zip', { team: t.team, examId: t.examId }, filename + '.zip')
  }
  return b
}

// ---------- delete one team name ----------
function deleteCell(t) {
  const key = t.team + '|' + t.examId
  const b = document.createElement('button')
  b.textContent = delArmed === key ? 'Sure? Click again' : 'Delete'
  b.onclick = async (e) => {
    e.stopPropagation() // don't open the submission viewer
    if (delArmed !== key) {
      delArmed = key
      setTimeout(() => {
        if (delArmed === key) {
          delArmed = ''
          load()
        }
      }, 4000)
      return load()
    }
    delArmed = ''
    b.disabled = true
    const r = await api('/api/team/delete', { password: pw, team: t.team, examId: t.examId }).catch(() => ({ ok: false }))
    if (!r.ok) alert(r.reason || 'Could not delete')
    load()
  }
  return b
}

async function load() {
  const q = encodeURIComponent(pw)
  const [violations, exam, teams] = await Promise.all([
    api('/api/violations?password=' + q),
    api('/api/exam/status?password=' + q),
    api('/api/teams?password=' + q),
  ])

  $('state').textContent = exam.started ? 'running' : 'not started'
  $('state').classList.toggle('running', Boolean(exam.started))
  $('codeRow').hidden = !exam.started
  $('code').textContent = exam.code || ''
  $('startBtn').hidden = exam.started
  $('stopBtn').hidden = !exam.started

  const count = (st) => teams.filter((t) => t.state === st).length
  $('nJoined').textContent = teams.length
  $('nDone').textContent = count('submitted') + count('time-up')
  $('nRun').textContent = count('in-progress')
  $('nOver').textContent = count('over')

  fill(
    'teamRows',
    teams.map((t) => [
      t.team,
      fmtTime(t.startedAt),
      fmtTime(t.submittedAt),
      t.timeTaken != null ? fmtDur(t.timeTaken) : '-',
      statusOf(t),
      t.violations,
      t.locked ? unlockCell(t.team, true) : '-',
      openCell(t),
      downloadCell(t),
      deleteCell(t),
    ])
  )

  $('count').textContent = violations.length
  const lockedTeams = new Set(teams.filter((t) => t.locked).map((t) => t.team))
  fill(
    'rows',
    violations.map((r) => [r.team, r.type, new Date(r.time).toLocaleTimeString(), unlockCell(r.team, lockedTeams.has(r.team))])
  )
}

/* ---------- submitted work viewer ---------- */
function showCode(tab) {
  document.querySelectorAll('#viewer nav button').forEach((b) => b.classList.toggle('on', b.dataset.v === tab))
  $('codeView').textContent = current ? current[tab] : ''
}

document.querySelectorAll('#viewer nav button').forEach((b) => {
  b.onclick = () => showCode(b.dataset.v)
})

async function openViewer(t) {
  const url = '/api/submission?password=' + encodeURIComponent(pw) + '&team=' + encodeURIComponent(t.team) + '&examId=' + t.examId
  const s = await api(url).catch(() => ({ ok: false }))
  if (!s.ok) return alert('No submission found for ' + t.team)
  current = s
  $('viewTitle').textContent = s.team
  showCode('html')
  $('viewPreview').srcdoc = '<style>' + s.css + '</style>' + s.html + '<script>' + s.js + '<\/script>'
  $('viewer').hidden = false
}

$('closeViewer').onclick = () => {
  $('viewer').hidden = true
  $('viewPreview').srcdoc = ''
}

$('startBtn').onclick = () => api('/api/exam/start', { password: pw }).then(load)
$('stopBtn').onclick = () => api('/api/exam/stop', { password: pw }).then(load)

// ---------- download the students' code as .zip ----------
async function downloadZip(url, body, filename) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: pw, ...body }),
  }).catch(() => null)
  if (!r) return alert('Cannot reach the backend')
  if (!(r.headers.get('content-type') || '').includes('zip')) {
    const j = await r.json().catch(() => ({}))
    alert(j.reason || 'No zip available')
    return false
  }
  const a = document.createElement('a')
  const objectUrl = URL.createObjectURL(await r.blob())
  a.href = objectUrl
  const disposition = r.headers.get('content-disposition') || ''
  const serverFilename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  a.download = filename || serverFilename || 'download.zip'
  a.click()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  return true
}

$('zipAll').onclick = () => downloadZip('/api/zip/all', {}, 'all_submissions.zip')

$('deleteAll').onclick = async () => {
  const button = $('deleteAll')
  if (!deleteAllArmed) {
    deleteAllArmed = true
    button.textContent = 'Confirm archive & delete all'
    setTimeout(() => {
      if (deleteAllArmed) {
        deleteAllArmed = false
        button.textContent = 'Archive & delete all'
      }
    }, 5000)
    return
  }

  deleteAllArmed = false
  button.disabled = true
  button.textContent = 'Archiving…'
  const downloaded = await downloadZip('/api/team/delete-all', {}, '')
  button.disabled = false
  button.textContent = 'Archive & delete all'
  if (downloaded) {
    alert('The archive was downloaded and saved on the server. All exam data and the current exam code were cleared.')
    await load()
  }
}