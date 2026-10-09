// Tiny syntax colouring for the editor (HTML / CSS / JavaScript). Pure text processing, no libraries.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const span = (c, t) => `<span class="${c}">${esc(t)}</span>`

// walk a regex over the text, wrapping every match in a coloured span
function run(code, re, cls) {
  let out = ''
  let last = 0
  let m
  re.lastIndex = 0
  while ((m = re.exec(code))) {
    if (m[0] === '') { re.lastIndex++; continue }
    out += esc(code.slice(last, m.index))
    const c = cls(m)
    out += c ? span(c, m[0]) : esc(m[0])
    last = m.index + m[0].length
  }
  return out + esc(code.slice(last))
}

function hlHtml(code) {
  const re = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>?|<![^<>]*>?/g
  let out = ''
  let last = 0
  let m
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index))
    const t = m[0]
    last = m.index + t.length
    if (t.startsWith('<!--')) out += span('tk-com', t)
    else if (t.startsWith('<!')) out += span('tk-kw', t)
    else {
      const p = /^(<\/?)([a-zA-Z][\w:-]*)([\s\S]*?)(\/?>?)$/.exec(t)
      if (!p) { out += esc(t); continue }
      out +=
        span('tk-pun', p[1]) +
        span('tk-tag', p[2]) +
        run(p[3], /("[^"]*"|'[^']*')|([^\s=\/"'<>]+)/g, (x) => (x[1] ? 'tk-str' : 'tk-attr')) +
        span('tk-pun', p[4])
    }
  }
  return out + esc(code.slice(last))
}

function hlCss(code) {
  const re = /\/\*[\s\S]*?\*\/|"[^"]*"|'[^']*'|[{}]|[^{}"'\/]+|[\s\S]/g
  const decl = /([\w-]+)(?=\s*:)|(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|ms|s|deg|fr)?)/g
  let depth = 0
  let out = ''
  let m
  while ((m = re.exec(code))) {
    const t = m[0]
    if (t === '{') { out += esc(t); depth++ }
    else if (t === '}') { out += esc(t); depth = Math.max(0, depth - 1) }
    else if (t.startsWith('/*')) out += span('tk-com', t)
    else if (t[0] === '"' || t[0] === "'") out += span('tk-str', t)
    else if (depth === 0) out += t.trim().startsWith('@') ? span('tk-kw', t) : span('tk-sel', t)
    else out += run(t, decl, (x) => (x[1] ? 'tk-attr' : 'tk-num'))
  }
  return out
}

const JS_KW = new Set(
  ('const let var function return if else for while do switch case break continue new this class extends ' +
    'import export from default async await try catch finally throw typeof instanceof in of delete void ' +
    'null undefined true false').split(' ')
)

function hlJs(code) {
  const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g
  return run(code, re, (m) => {
    if (m[1]) return 'tk-com'
    if (m[2]) return 'tk-str'
    if (m[3]) return 'tk-num'
    if (JS_KW.has(m[4])) return 'tk-kw'
    if (/^\s*\(/.test(m.input.slice(m.index + m[0].length, m.index + m[0].length + 30))) return 'tk-fn'
    return null
  })
}

export function highlight(lang, code) {
  const html = lang === 'html' ? hlHtml(code) : lang === 'css' ? hlCss(code) : hlJs(code)
  // a trailing empty line needs a character, or the colour layer is one line shorter than the textarea
  return html + (code.endsWith('\n') ? ' ' : '')
}