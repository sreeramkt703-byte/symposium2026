const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const { createZip, entriesOf, safeSeg } = require('./zip');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DURATION = 60 * 60 * 1000;
const DATA = path.join(__dirname, 'data');
const VIOLATIONS = path.join(DATA, 'violations.json');
const SUBMISSIONS = path.join(DATA, 'submissions');
const ZIPS = path.join(DATA, 'zips');
const ARCHIVES = path.join(DATA, 'archives');
const EXAM_FILE = path.join(DATA, 'exam.json');
const EXAMS_FILE = path.join(DATA, 'exams.json');
const TEAMS_FILE = path.join(DATA, 'teams.json');
const LOCKS_FILE = path.join(DATA, 'locks.json');
const ENV_FILE = path.join(__dirname, '.env');
fs.mkdirSync(SUBMISSIONS, { recursive: true });
fs.mkdirSync(ZIPS, { recursive: true });
fs.mkdirSync(ARCHIVES, { recursive: true });
if (!fs.existsSync(VIOLATIONS)) fs.writeFileSync(VIOLATIONS, '[]');
if (!fs.existsSync(EXAMS_FILE)) fs.writeFileSync(EXAMS_FILE, '[]');
if (!fs.existsSync(TEAMS_FILE)) fs.writeFileSync(TEAMS_FILE, '[]');
if (!fs.existsSync(LOCKS_FILE)) fs.writeFileSync(LOCKS_FILE, '{}');

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const subKey = (team, examId) => String(team).replace(/[^a-z0-9_-]/gi, '_') + '_' + examId;

/* ---------- admin password ---------- */
const clean = (s) => String(s || '').trim();
const isAdmin = (pw) => clean(pw) !== '' && clean(pw) === clean(process.env.ADMIN_PASSWORD);

console.log('Admin password set:', Boolean(clean(process.env.ADMIN_PASSWORD)), '| length:', clean(process.env.ADMIN_PASSWORD).length);

function savePassword(pw) {
  let env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
  env = env.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('ADMIN_PASSWORD=')).join('\n');
  fs.writeFileSync(ENV_FILE, 'ADMIN_PASSWORD="' + pw + '"\n' + env + '\n');
  process.env.ADMIN_PASSWORD = pw;
}

app.get('/api/admin/configured', (req, res) => res.json({ configured: Boolean(clean(process.env.ADMIN_PASSWORD)) }));

app.post('/api/unlock', (req, res) => {
  const pw = clean(req.body.password);
  if (!clean(process.env.ADMIN_PASSWORD)) {
    // first time: only from the server PC (localhost)
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if (!local || !/^[^"\\\r\n]{4,}$/.test(pw)) return res.json({ ok: false });
    savePassword(pw);
    console.log('Admin password saved to .env');
    return res.json({ ok: true });
  }
  const ok = isAdmin(pw);
  console.log('Login attempt: typed length', pw.length, '| expected length', clean(process.env.ADMIN_PASSWORD).length, '|', ok ? 'OK' : 'WRONG');
  // student PC unlocked with the password: clear that team's lock on the server too
  const team = String(req.body.team || '').trim();
  if (ok && team && locks[team]) {
    delete locks[team];
    saveLocks();
  }
  res.json({ ok });
});

/* ---------- exam state ---------- */
let exam = fs.existsSync(EXAM_FILE) ? readJson(EXAM_FILE) : { started: false, code: null, id: null };
const saveExam = () => fs.writeFileSync(EXAM_FILE, JSON.stringify(exam));
let examHistory = readJson(EXAMS_FILE);
const saveExamHistory = () => fs.writeFileSync(EXAMS_FILE, JSON.stringify(examHistory, null, 2));
if (exam.started && exam.id && !examHistory.some((x) => x.id === exam.id)) {
  examHistory.push({ id: exam.id, code: exam.code, startedAt: exam.id, stoppedAt: null });
  saveExamHistory();
}

let teams = readJson(TEAMS_FILE);
const saveTeams = () => fs.writeFileSync(TEAMS_FILE, JSON.stringify(teams, null, 2));

// Locked teams: { [teamName]: { type, since } }. A team is locked after a violation
// and stays locked until the admin unlocks it (here) or enters the password on the student PC.
let locks = readJson(LOCKS_FILE);
const saveLocks = () => fs.writeFileSync(LOCKS_FILE, JSON.stringify(locks, null, 2));

app.get('/api/questions', (req, res) =>
  res.json(readJson(path.join(__dirname, '..', 'web', 'data', 'questions.json')))
);

app.get('/api/exam/status', (req, res) =>
  res.json({ started: exam.started, code: isAdmin(req.query.password) ? exam.code : undefined })
);

app.post('/api/exam/start', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  exam = { started: true, code: String(crypto.randomInt(100000, 1000000)), id: Date.now() };
  examHistory.push({ id: exam.id, code: exam.code, startedAt: exam.id, stoppedAt: null });
  saveExamHistory();
  saveExam();
  locks = {};
  saveLocks();
  res.json({ ok: true, code: exam.code });
});

app.post('/api/exam/stop', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  const stoppedAt = Date.now();
  const currentRun = examHistory.find((x) => x.id === exam.id);
  if (currentRun) currentRun.stoppedAt = stoppedAt;
  saveExamHistory();
  exam = { started: false, code: null, id: null };
  saveExam();
  locks = {};
  saveLocks();
  res.json({ ok: true });
});

app.post('/api/exam/join', (req, res) => {
  if (!exam.started) return res.json({ ok: false, reason: 'Exam has not started yet' });
  if (String(req.body.code) !== exam.code) return res.json({ ok: false, reason: 'Wrong exam code' });
  const team = String(req.body.team || '').trim().slice(0, 60);
  if (!team) return res.json({ ok: false, reason: 'Team name required' });

  let t = teams.find((x) => x.team === team && x.examId === exam.id);
  if (t && t.submittedAt) return res.json({ ok: false, reason: 'This team has already submitted' });
  if (!t) {
    t = { team, examId: exam.id, startedAt: Date.now(), submittedAt: null, status: 'in-progress' };
    teams.push(t);
    saveTeams();
  }
  res.json({ ok: true, examId: exam.id, startedAt: t.startedAt, serverNow: Date.now() });
});

// Student reloaded the page: let them back into the SAME running exam without the code.
app.post('/api/exam/resume', (req, res) => {
  const team = String(req.body.team || '').trim();
  const examId = Number(req.body.examId);
  if (!exam.started || exam.id !== examId) return res.json({ ok: false, reason: 'Exam is no longer running' });
  const t = teams.find((x) => x.team === team && x.examId === examId);
  if (!t) return res.json({ ok: false, reason: 'Team not found' });
  if (t.submittedAt) return res.json({ ok: true, submitted: true });
  res.json({ ok: true, examId, startedAt: t.startedAt, serverNow: Date.now() });
});

app.post('/api/submit', (req, res) => {
  const { team, examId, html, css, js } = req.body;
  const t = teams.find((x) => x.team === team && x.examId === examId);
  if (!t) return res.json({ ok: false, reason: 'Team not found' });
  if (t.submittedAt) return res.json({ ok: true });

  const timeUp = Date.now() >= t.startedAt + DURATION - 5000;

  t.submittedAt = Date.now();
  t.status = timeUp ? 'time-up' : 'submitted';
  saveTeams();

  const name = String(team).replace(/[^a-z0-9_-]/gi, '_') + '_' + examId;
  fs.writeFileSync(
    path.join(SUBMISSIONS, name + '.json'),
    JSON.stringify({ team, html, css, js, time: new Date().toISOString() }, null, 2)
  );
  // Keep a .zip of the team's code on the server too.
  try {
    fs.writeFileSync(path.join(ZIPS, name + '.zip'), createZip(entriesOf({ files: req.body.files, html, css, js })));
  } catch (e) {
    console.log('Could not save zip:', e.message);
  }
  res.json({ ok: true });
});

app.get('/api/teams', (req, res) => {
  if (!isAdmin(req.query.password)) return res.status(401).json([]);
  const latest = Math.max(0, ...teams.map((t) => t.examId));
  const vio = readJson(VIOLATIONS);
  res.json(
    teams
      .filter((t) => t.examId === latest)
      .map((t) => {
        const file = path.join(SUBMISSIONS, String(t.team).replace(/[^a-z0-9_-]/gi, '_') + '_' + t.examId + '.json');
        const state = t.submittedAt
          ? t.status === 'time-up' ? 'time-up' : 'submitted'
          : Date.now() > t.startedAt + DURATION ? 'over' : 'in-progress';
        return {
          ...t,
          state, // submitted | time-up | over (time ended, nothing received) | in-progress
          timeTaken: t.submittedAt ? t.submittedAt - t.startedAt : null,
          hasSubmission: fs.existsSync(file),
          // only violations from THIS exam run (older runs with the same team name are ignored)
          violations: vio.filter((v) => v.team === t.team && v.examId === t.examId).length,
          locked: Boolean(locks[t.team]),
          lockType: locks[t.team]?.type || null,
        };
      })
  );
});

// ---------- remove ONE team name completely (a test name, a typo, a wrong entry) ----------
// Deletes its record, lock, saved code, zip and violations. The same name can join again afterwards.
app.post('/api/team/delete', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  const team = String(req.body.team || '');
  const examId = Number(req.body.examId);
  const i = teams.findIndex((t) => t.team === team && t.examId === examId);
  if (i === -1) return res.json({ ok: false, reason: 'Team not found' });
  teams.splice(i, 1);
  saveTeams();
  if (locks[team]) { delete locks[team]; saveLocks(); }

  // Saved files are named after the team; keep them if another team shares the same file name.
  if (!teams.some((t) => t.examId === examId && subKey(t.team, examId) === subKey(team, examId))) {
    for (const file of [path.join(SUBMISSIONS, subKey(team, examId) + '.json'), path.join(ZIPS, subKey(team, examId) + '.zip')]) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        if (e.code !== 'ENOENT') {
          console.error('Could not delete team file:', e.message);
          return res.status(500).json({ ok: false, reason: 'Team removed, but a saved file could not be deleted' });
        }
      }
    }
  }
  const left = readJson(VIOLATIONS).filter((v) => !(v.team === team && v.examId === examId));
  fs.writeFileSync(VIOLATIONS, JSON.stringify(left, null, 2));
  console.log('Admin deleted team:', team);
  res.json({ ok: true });
});

app.get('/api/submission', (req, res) => {
  if (!isAdmin(req.query.password)) return res.status(401).json({ ok: false });
  const name = String(req.query.team).replace(/[^a-z0-9_-]/gi, '_') + '_' + Number(req.query.examId);
  const file = path.join(SUBMISSIONS, name + '.json');
  if (!fs.existsSync(file)) return res.json({ ok: false });
  res.json({ ok: true, ...readJson(file) });
});

// ---------- zip export: save and download the students' code as .zip ----------
// One team's code as a .zip. POST, so the password never appears in the address bar.
app.post('/api/zip', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  const file = path.join(SUBMISSIONS, subKey(req.body.team, Number(req.body.examId)) + '.json');
  if (!fs.existsSync(file)) return res.json({ ok: false, reason: 'No submission found for this team' });
  const zip = createZip(entriesOf(readJson(file)));
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="' + safeSeg(req.body.team) + '.zip"',
  });
  res.send(zip);
});

// Every submitted team of the latest exam in ONE .zip (one folder per team).
// A copy is also saved on the server in backend/data/zips/ALL_<examId>.zip
app.post('/api/zip/all', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  const examId = Number(req.body.examId) || Math.max(0, ...teams.map((t) => t.examId));
  const entries = [];
  const folders = new Set();
  teams
    .filter((t) => t.examId === examId && t.submittedAt)
    .forEach((t) => {
      const file = path.join(SUBMISSIONS, subKey(t.team, examId) + '.json');
      if (!fs.existsSync(file)) return;
      let folder = safeSeg(t.team);
      while (folders.has(folder.toLowerCase())) folder += '_';
      folders.add(folder.toLowerCase());
      entriesOf(readJson(file)).forEach((e) => entries.push({ name: folder + '/' + e.name, data: e.data }));
    });
  if (!entries.length) return res.json({ ok: false, reason: 'Nobody has submitted yet' });
  const zip = createZip(entries);
  try { fs.writeFileSync(path.join(ZIPS, 'ALL_' + examId + '.zip'), zip); } catch (e) { console.log('Could not save zip:', e.message); }
  res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="all_submissions.zip"' });
  res.send(zip);
});

// Archive all exam data before clearing it. The archive is retained on the server and downloaded by the admin.
app.post('/api/team/delete-all', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });

  const archivedAt = new Date();
  const archiveName = `all-exams-${archivedAt.toISOString().replace(/[:.]/g, '-')}-${crypto.randomBytes(4).toString('hex')}.zip`;
  const archivePath = path.join(ARCHIVES, archiveName);
  const violations = readJson(VIOLATIONS);
  const archiveDetails = {
    format: 'symposium2026-exam-archive',
    version: 1,
    archivedAt: archivedAt.toISOString(),
    exam,
    examHistory,
    teams,
    locks,
    violations,
  };
  const entries = [
    { name: 'archive-details.json', data: JSON.stringify(archiveDetails, null, 2) },
    { name: 'state/exam.json', data: JSON.stringify(exam, null, 2) },
    { name: 'state/exams.json', data: JSON.stringify(examHistory, null, 2) },
    { name: 'state/teams.json', data: JSON.stringify(teams, null, 2) },
    { name: 'state/locks.json', data: JSON.stringify(locks, null, 2) },
    { name: 'state/violations.json', data: JSON.stringify(violations, null, 2) },
  ];

  const addDirectoryToArchive = (directory, prefix) => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      const source = path.join(directory, item.name);
      const name = prefix + '/' + safeSeg(item.name);
      if (item.isFile()) entries.push({ name, data: fs.readFileSync(source) });
      else if (item.isDirectory()) addDirectoryToArchive(source, name);
      else throw new Error(`Unsupported file type in ${directory}`);
    }
  };

  let zip;
  try {
    addDirectoryToArchive(SUBMISSIONS, 'submissions');
    addDirectoryToArchive(ZIPS, 'zips');
    zip = createZip(entries);
    fs.writeFileSync(archivePath, zip, { flag: 'wx' });
  } catch (e) {
    console.error('Could not archive exam data:', e.message);
    return res.status(500).json({ ok: false, reason: 'Could not create the archive. No data was deleted.' });
  }

  try {
    for (const directory of [SUBMISSIONS, ZIPS]) {
      for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, item.name);
        if (item.isDirectory()) fs.rmSync(target, { recursive: true });
        else fs.unlinkSync(target);
      }
    }
    teams = [];
    saveTeams();
    locks = {};
    saveLocks();
    fs.writeFileSync(VIOLATIONS, '[]');
    examHistory = [];
    saveExamHistory();
    exam = { started: false, code: null, id: null };
    saveExam();
  } catch (e) {
    console.error('Archive saved, but could not clear all exam data:', e.message);
    return res.status(500).json({
      ok: false,
      reason: `Archive saved as ${archiveName}, but cleanup was incomplete: ${e.message}`,
    });
  }

  console.log('Admin archived and cleared all exam data:', archiveName);
  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${archiveName}"`,
  });
  res.send(zip);
});

app.post('/api/violation', (req, res) => {
  const list = readJson(VIOLATIONS);
  const team = String(req.body.team || '?');
  const type = String(req.body.type || '?');
  list.push({ team, type, examId: Number(req.body.examId) || exam.id, time: new Date().toISOString() });
  fs.writeFileSync(VIOLATIONS, JSON.stringify(list, null, 2));
  locks[team] = { type, since: Date.now() };
  saveLocks();
  res.json({ ok: true });
});

// Student PC polls this while locked; when it says locked:false the screen unlocks.
app.get('/api/lock/status', (req, res) => {
  res.json({ locked: Boolean(locks[String(req.query.team || '').trim()]) });
});

// Admin unlocks a team remotely.
app.post('/api/lock/unlock', (req, res) => {
  if (!isAdmin(req.body.password)) return res.status(401).json({ ok: false });
  const team = String(req.body.team || '').trim();
  if (!locks[team]) return res.json({ ok: true, alreadyUnlocked: true });
  delete locks[team];
  saveLocks();
  console.log('Admin unlocked team:', team);
  res.json({ ok: true });
});

app.get('/api/violations', (req, res) => {
  if (!isAdmin(req.query.password)) return res.status(401).json([]);
  res.json(readJson(VIOLATIONS).reverse());
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('Open http://localhost:' + PORT));