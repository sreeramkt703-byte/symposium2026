const $ = (id) => document.getElementById(id)
let pw = ''
let current = null

async function api(path, body) {
  const headers = {}
  if (pw) headers.Authorization = `Bearer ${pw}`
  if (body) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)
  return result
}

api('/api/admin/configured')
  .then((result) => {
    $('hint').hidden = result.configured
  })
  .catch((error) => {
    $('err').textContent = error.message
  })

$('loginBtn').onclick = async () => {
  pw = $('pw').value
  try {
    const result = await api('/api/unlock', { password: pw })
    if (!result.ok) {
      $('err').textContent = result.error || 'Invalid admin secret.'
      return
    }
    $('login').hidden = true
    $('panel').hidden = false
    await load().catch(showDashboardError)
    setInterval(() => load().catch(showDashboardError), 3000)
  } catch (error) {
    $('err').textContent = error.message
  }
}
$('pw').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') $('loginBtn').click()
})

const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString() : '-')
const fmtDur = (ms) => `${Math.floor(ms / 60000)}m ${Math.floor(ms / 1000) % 60}s`

const LABEL = {
  submitted: 'Submitted',
  'time-up': 'Time up (auto-submitted)',
  over: 'Time over, not submitted',
  'in-progress': 'In progress',
}
const statusOf = (team) => LABEL[team.state] || team.state

function fill(tbodyId, rows, clicks) {
  const body = $(tbodyId)
  body.replaceChildren()
  rows.forEach((cells, index) => {
    const row = document.createElement('tr')
    if (clicks && clicks[index]) {
      row.className = 'clickable'
      row.onclick = clicks[index]
    }
    cells.forEach((value) => {
      const cell = document.createElement('td')
      if (value instanceof Node) cell.appendChild(value)
      else cell.textContent = value
      row.appendChild(cell)
    })
    body.appendChild(row)
  })
}

async function unlockTeam(team) {
  await api('/api/lock/unlock', { team })
  await load()
}

function unlockCell(team, locked) {
  if (!locked) return '-'
  const button = document.createElement('button')
  button.textContent = 'Unlock'
  button.onclick = (event) => {
    event.stopPropagation()
    button.disabled = true
    unlockTeam(team).catch(showDashboardError)
  }
  return button
}

function showDashboardError(error) {
  $('dashboardErr').textContent = error.message
}

async function load() {
  const [violations, exam, teams] = await Promise.all([
    api('/api/violations'),
    api('/api/exam/status'),
    api('/api/teams'),
  ])
  $('dashboardErr').textContent = ''
  $('state').textContent = exam.started ? 'running' : 'not started'
  $('codeRow').hidden = !exam.started
  $('code').textContent = exam.code || ''
  $('startBtn').hidden = exam.started
  $('stopBtn').hidden = !exam.started

  const count = (state) => teams.filter((team) => team.state === state).length
  $('nJoined').textContent = teams.length
  $('nDone').textContent = count('submitted') + count('time-up')
  $('nRun').textContent = count('in-progress')
  $('nOver').textContent = count('over')

  fill(
    'teamRows',
    teams.map((team) => [
      team.team,
      fmtTime(team.startedAt),
      fmtTime(team.submittedAt),
      team.timeTaken != null ? fmtDur(team.timeTaken) : '-',
      statusOf(team),
      team.violations,
      team.locked ? unlockCell(team.team, true) : '-',
    ]),
    teams.map((team) => (team.hasSubmission ? () => openViewer(team) : null))
  )

  $('count').textContent = violations.length
  const lockedTeams = new Set(teams.filter((team) => team.locked).map((team) => team.team))
  fill(
    'rows',
    violations.map((violation) => [
      violation.team,
      violation.type,
      new Date(violation.time).toLocaleTimeString(),
      unlockCell(violation.team, lockedTeams.has(violation.team)),
    ])
  )
}

function showCode(tab) {
  document.querySelectorAll('#viewer nav button').forEach((button) => {
    button.classList.toggle('on', button.dataset.v === tab)
  })
  $('codeView').textContent = current ? current[tab] : ''
}

document.querySelectorAll('#viewer nav button').forEach((button) => {
  button.onclick = () => showCode(button.dataset.v)
})

async function openViewer(team) {
  const query = new URLSearchParams({ team: team.team, examId: team.examId })
  const submission = await api(`/api/submission?${query}`).catch((error) => {
    showDashboardError(error)
    return { ok: false }
  })
  if (!submission.ok) return alert(`No submission found for ${team.team}`)
  current = submission
  $('viewTitle').textContent = submission.team
  showCode('html')
  $('viewPreview').srcdoc = `<style>${submission.css}</style>${submission.html}<script>${submission.js}</script>`
  $('viewer').hidden = false
}

$('closeViewer').onclick = () => {
  $('viewer').hidden = true
  $('viewPreview').srcdoc = ''
}

$('startBtn').onclick = () => api('/api/exam/start', {}).then(load).catch(showDashboardError)
$('stopBtn').onclick = () => api('/api/exam/stop', {}).then(load).catch(showDashboardError)
