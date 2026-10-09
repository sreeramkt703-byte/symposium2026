// Helpers for a student website made of several files (index.html, about.html, style.css, ...)

export const DEFAULT_FILES = [
  { id: 1, name: 'index.html', content: '<h1>Hello</h1>' },
  { id: 2, name: 'style.css', content: '' },
  { id: 3, name: 'script.js', content: '' },
]

export const MAX_FILES = 20

// 'index.html' -> 'html', 'a.css' -> 'css', 'x.js' -> 'js'
export const langOf = (name) => {
  const e = String(name).split('.').pop().toLowerCase()
  return e === 'css' ? 'css' : e === 'js' ? 'js' : 'html'
}

// Reads what was saved in the browser. Old saves were { html, css, js }, new ones are { files, nextId }.
export function loadFiles(raw) {
  try {
    const s = JSON.parse(raw || 'null')
    if (s && Array.isArray(s.files) && s.files.length) return { files: s.files, nextId: s.nextId || 100 }
    if (s && ('html' in s || 'css' in s || 'js' in s)) {
      return {
        files: [
          { id: 1, name: 'index.html', content: s.html || '' },
          { id: 2, name: 'style.css', content: s.css || '' },
          { id: 3, name: 'script.js', content: s.js || '' },
        ],
        nextId: 4,
      }
    }
  } catch { /* ignore */ }
  return { files: DEFAULT_FILES, nextId: 4 }
}

// returns '' when the name is fine, otherwise a short message
export function checkName(name, files, exceptId) {
  const n = name.trim()
  if (!n) return 'Type a file name'
  if (n.length > 40) return 'Name is too long'
  if (!/^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.(html|css|js)$/i.test(n)) return 'Use letters, numbers, - or _ and end with .html, .css or .js'
  if (files.some((f) => f.id !== exceptId && f.name.toLowerCase() === n.toLowerCase())) return 'That file already exists'
  if (exceptId === undefined && files.length >= MAX_FILES) return 'Maximum ' + MAX_FILES + ' files'
  return ''
}

// html / css / js fields in the old format, so older admin pages still show something
export function legacy(files) {
  const by = (l) => files.filter((f) => langOf(f.name) === l)
  const main = files.find((f) => f.name.toLowerCase() === 'index.html') || by('html')[0]
  const join = (arr) => arr.map((f) => (arr.length > 1 ? `/* ${f.name} */\n${f.content}` : f.content)).join('\n\n')
  return { html: main ? main.content : '', css: join(by('css')), js: join(by('js')) }
}

// Clicking a link to another page inside the output panel asks the editor to show that page.
// Links to other websites are blocked, so the output panel can't be used to browse the internet.
const NAV_SCRIPT = `<script>
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;
var h=a.getAttribute('href')||'';if(h.charAt(0)==='#')return;e.preventDefault();
if(/^(https?:|\\/\\/|mailto:|tel:|javascript:)/i.test(h))return;
parent.postMessage({examNav:h},'*')},true);
<\/script>`

const safeScript = (s) => s.replace(/<\/(script)/gi, '<\\/$1')
const safeStyle = (s) => s.replace(/<\/(style)/gi, '<\\/$1')

// Builds ONE html document for the output panel from all files (prefix = extra scripts to put first):
//  - <link rel="stylesheet" href="x.css"> and <script src="x.js"> are filled in from the files
//  - if a page links no stylesheet / script at all, style.css / script.js are added automatically
export function buildPage(files, pageName, { nav = true, prefix = '' } = {}) {
  const find = (ref) => {
    const n = String(ref).split(/[?#]/)[0].replace(/^\.?\//, '').toLowerCase()
    return files.find((f) => f.name.toLowerCase() === n)
  }
  const page = find(pageName) || files.find((f) => langOf(f.name) === 'html')
  if (!page) return '<p style="font-family:sans-serif;color:#888">There is no HTML file to show.</p>'

  let hasCss = false
  let hasJs = false
  let html = page.content.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag
    hasCss = true
    const m = /href\s*=\s*["']([^"']+)["']/i.exec(tag)
    const f = m && find(m[1])
    return f && langOf(f.name) === 'css' ? `<style>${safeStyle(f.content)}</style>` : tag
  })
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (all, a, src, b) => {
    hasJs = true
    const f = find(src)
    return f && langOf(f.name) === 'js' ? `<script${a}${b}>${safeScript(f.content)}<\/script>` : all
  })

  const css = !hasCss && find('style.css')
  const js = !hasJs && find('script.js')

  // helper scripts (prefix + link handling) go AFTER a <!DOCTYPE>, otherwise the browser would
  // show the page in "quirks mode" and it could look different from a normal website
  const dt = /^\s*<!doctype[^>]*>/i.exec(html)
  const head = dt ? dt[0] : ''
  if (dt) html = html.slice(dt[0].length)
  return (
    head +
    prefix +
    (nav ? NAV_SCRIPT : '') +
    (css ? `<style>${safeStyle(css.content)}</style>` : '') +
    html +
    (js ? `<script>${safeScript(js.content)}<\/script>` : '')
  )
}