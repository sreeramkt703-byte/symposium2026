// Offline code suggestions (autocomplete) for the exam textareas. No libraries needed.
//   attachSuggest(textarea, () => 'html' | 'css' | 'js')  ->  returns a cleanup function
// Keys: ArrowUp/ArrowDown choose, Enter or Tab accept, Ctrl+Space opens the list.
// (Esc is NOT used: in the exam it is a restricted key and would lock the screen.)

/* ------------------------------ data ------------------------------ */
const HTML_TAGS = ['div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'button', 'input', 'form', 'label', 'section', 'header', 'footer', 'nav', 'main', 'article', 'aside', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'textarea', 'select', 'option', 'video', 'audio', 'canvas', 'iframe', 'figure', 'figcaption', 'strong', 'em', 'b', 'i', 'small', 'pre', 'code', 'br', 'hr', 'script', 'style', 'link', 'meta', 'title', 'head', 'body', 'html']
const VOID = new Set(['img', 'input', 'br', 'hr', 'meta', 'link'])
const TAG_SNIPPETS = {
  a: 'a href="$0"></a>',
  img: 'img src="$0" alt="">',
  input: 'input type="text" placeholder="$0">',
  link: 'link rel="stylesheet" href="$0">',
  meta: 'meta name="viewport" content="width=device-width, initial-scale=1.0">',
  script: 'script src="$0"></script>',
  br: 'br>',
  hr: 'hr>',
  button: 'button type="button">$0</button>',
  form: 'form action="" method="post">\n  $0\n</form>',
  ul: 'ul>\n  <li>$0</li>\n</ul>',
  ol: 'ol>\n  <li>$0</li>\n</ol>',
  table: 'table>\n  <tr>\n    <td>$0</td>\n  </tr>\n</table>',
}
const HTML_ATTRS = ['class', 'id', 'style', 'src', 'href', 'alt', 'type', 'name', 'value', 'placeholder', 'title', 'width', 'height', 'target', 'rel', 'for', 'onclick', 'disabled', 'checked', 'required', 'min', 'max', 'rows', 'cols', 'colspan', 'rowspan', 'autofocus', 'readonly', 'hidden', 'data-']
const BOILERPLATE = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>$0</title>\n</head>\n<body>\n  \n</body>\n</html>'

const CSS_PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height', 'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'border', 'border-radius', 'border-color', 'border-width', 'border-style', 'outline', 'background', 'background-color', 'background-image', 'background-size', 'background-position', 'color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-align', 'text-decoration', 'text-transform', 'letter-spacing', 'line-height', 'flex', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'gap', 'grid-template-columns', 'grid-template-rows', 'overflow', 'opacity', 'transition', 'transform', 'animation', 'box-shadow', 'text-shadow', 'cursor', 'z-index', 'box-sizing', 'list-style', 'object-fit', 'content', 'visibility', 'white-space', 'vertical-align', 'float', 'clear']
const COLORS = ['red', 'blue', 'green', 'white', 'black', 'gray', 'orange', 'purple', 'yellow', 'pink', 'teal', 'navy', 'transparent', 'currentColor']
const CSS_VALUES = {
  display: ['block', 'inline', 'inline-block', 'flex', 'grid', 'none'],
  position: ['relative', 'absolute', 'fixed', 'sticky', 'static'],
  'justify-content': ['center', 'space-between', 'space-around', 'space-evenly', 'flex-start', 'flex-end'],
  'align-items': ['center', 'flex-start', 'flex-end', 'stretch', 'baseline'],
  'align-self': ['center', 'flex-start', 'flex-end', 'stretch'],
  'flex-direction': ['row', 'column', 'row-reverse', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap'],
  'text-align': ['left', 'center', 'right', 'justify'],
  'text-decoration': ['none', 'underline', 'line-through'],
  'text-transform': ['uppercase', 'lowercase', 'capitalize', 'none'],
  'font-weight': ['normal', 'bold', '400', '500', '600', '700'],
  'font-style': ['normal', 'italic'],
  'font-family': ['Arial, sans-serif', 'Georgia, serif', "'Courier New', monospace", 'system-ui, sans-serif'],
  overflow: ['hidden', 'auto', 'scroll', 'visible'],
  cursor: ['pointer', 'default', 'not-allowed', 'text'],
  'box-sizing': ['border-box', 'content-box'],
  'object-fit': ['cover', 'contain', 'fill'],
  'list-style': ['none', 'disc', 'decimal'],
  'white-space': ['nowrap', 'normal', 'pre'],
  visibility: ['visible', 'hidden'],
  float: ['left', 'right', 'none'],
  'border-style': ['solid', 'dashed', 'dotted', 'none'],
  border: ['1px solid black', 'none'],
  transition: ['all 0.3s ease', 'all 0.2s'],
  'box-shadow': ['0 2px 6px rgba(0,0,0,0.2)', 'none'],
  background: COLORS,
  'background-color': COLORS,
  color: COLORS,
  'border-color': COLORS,
  width: ['100%', 'auto', '100vw', '50%'],
  height: ['100%', 'auto', '100vh'],
  margin: ['0', 'auto', '0 auto'],
  padding: ['0', '10px', '20px'],
}
const CSS_GENERIC = ['auto', 'none', 'inherit', 'initial', '0', '100%']

const JS_KEYWORDS = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'class', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'null', 'undefined', 'true', 'false', 'document', 'window', 'console', 'Math', 'JSON', 'Object', 'Array', 'Number', 'String', 'Date', 'parseInt', 'parseFloat']
const JS_SNIPPETS = [
  ['log', 'console.log($0);', 'snippet'],
  ['for', 'for (let i = 0; i < $0; i++) {\n  \n}', 'for loop'],
  ['forof', 'for (const item of $0) {\n  \n}', 'for...of loop'],
  ['while', 'while ($0) {\n  \n}', 'while loop'],
  ['function', 'function $0() {\n  \n}', 'function'],
  ['arrow', 'const $0 = () => {\n  \n};', 'arrow function'],
  ['if', 'if ($0) {\n  \n}', 'if'],
  ['ifelse', 'if ($0) {\n  \n} else {\n  \n}', 'if / else'],
  ['switch', 'switch ($0) {\n  case 1:\n    break;\n  default:\n    break;\n}', 'switch'],
  ['try', 'try {\n  $0\n} catch (err) {\n  console.error(err);\n}', 'try / catch'],
  ['setTimeout', 'setTimeout(() => {\n  $0\n}, 1000);', 'snippet'],
  ['setInterval', 'setInterval(() => {\n  $0\n}, 1000);', 'snippet'],
  ['fetch', 'fetch($0)\n  .then((r) => r.json())\n  .then((data) => console.log(data));', 'snippet'],
  ['getElementById', "document.getElementById('$0')", 'DOM'],
  ['querySelector', "document.querySelector('$0')", 'DOM'],
  ['querySelectorAll', "document.querySelectorAll('$0')", 'DOM'],
  ['createElement', "document.createElement('$0')", 'DOM'],
  ['addEventListener', "addEventListener('click', () => {\n  $0\n});", 'DOM'],
  ['class', 'class $0 {\n  constructor() {\n    \n  }\n}', 'class'],
]
const MEMBERS = {
  document: ['getElementById', 'querySelector', 'querySelectorAll', 'createElement', 'getElementsByClassName', 'body', 'addEventListener', 'title'],
  console: ['log', 'error', 'warn', 'table', 'clear'],
  Math: ['random', 'floor', 'ceil', 'round', 'max', 'min', 'abs', 'pow', 'sqrt', 'PI'],
  JSON: ['stringify', 'parse'],
  Object: ['keys', 'values', 'entries', 'assign'],
  Array: ['isArray', 'from'],
  window: ['addEventListener', 'innerWidth', 'innerHeight', 'setTimeout', 'alert'],
  localStorage: ['getItem', 'setItem', 'removeItem', 'clear'],
}
const MEMBER_SNIPPETS = {
  getElementById: "getElementById('$0')",
  querySelector: "querySelector('$0')",
  querySelectorAll: "querySelectorAll('$0')",
  createElement: "createElement('$0')",
  getElementsByClassName: "getElementsByClassName('$0')",
  addEventListener: "addEventListener('click', () => {\n  $0\n})",
  log: 'log($0)', error: 'error($0)', warn: 'warn($0)', table: 'table($0)', clear: 'clear()',
  random: 'random()', floor: 'floor($0)', ceil: 'ceil($0)', round: 'round($0)', max: 'max($0)', min: 'min($0)', abs: 'abs($0)', pow: 'pow($0)', sqrt: 'sqrt($0)',
  stringify: 'stringify($0)', parse: 'parse($0)', keys: 'keys($0)', values: 'values($0)', entries: 'entries($0)', assign: 'assign($0)',
  isArray: 'isArray($0)', from: 'from($0)', getItem: "getItem('$0')", setItem: "setItem('$0', )", removeItem: "removeItem('$0')",
  forEach: 'forEach(($0) => {\n  \n})', map: 'map(($0) => )', filter: 'filter(($0) => )', find: 'find(($0) => )', push: 'push($0)', includes: 'includes($0)', join: 'join($0)', split: 'split($0)',
  setTimeout: 'setTimeout(() => {\n  $0\n}, 1000)', alert: 'alert($0)', toString: 'toString()', toFixed: 'toFixed($0)',
}
const GENERAL_MEMBERS = ['addEventListener', 'classList', 'innerHTML', 'textContent', 'style', 'value', 'appendChild', 'remove', 'setAttribute', 'getAttribute', 'querySelector', 'querySelectorAll', 'children', 'parentElement', 'forEach', 'map', 'filter', 'find', 'push', 'includes', 'join', 'split', 'length', 'toString', 'toFixed']

/* --------------------------- context logic --------------------------- */
const starts = (label, w) => label.toLowerCase().startsWith(w.toLowerCase()) && label !== w
// an item that is exactly what was typed is only useful if accepting it expands into something more
const useful = (it, w) => !(it.label === w && it.insert === it.label)
const pick = (list, w, make) => list.filter((x) => x.toLowerCase().startsWith(w.toLowerCase())).map(make).filter((it) => useful(it, w))

// last unclosed tag name in the text (used for the </ suggestion)
function openTag(text) {
  const stack = []
  const re = /<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g
  let m
  while ((m = re.exec(text))) {
    const n = m[2].toLowerCase()
    if (VOID.has(n) || m[3]) continue
    if (m[1]) {
      const i = stack.lastIndexOf(n)
      if (i >= 0) stack.length = i
    } else stack.push(n)
  }
  return stack.pop()
}

function htmlCtx(before) {
  let m
  if ((m = /(^|\s)!$/.exec(before)))
    return { start: before.length - 1, items: [{ label: '!', insert: BOILERPLATE, kind: 'HTML5 boilerplate' }] }
  if ((m = /<\/([\w-]*)$/.exec(before))) {
    const open = openTag(before.slice(0, m.index))
    if (open && (m[1] === '' || open.startsWith(m[1]) ) && open !== m[1])
      return { start: before.length - m[1].length, items: [{ label: open, insert: open + '>', kind: 'close tag' }] }
    return null
  }
  if ((m = /<([a-zA-Z][\w-]*)?$/.exec(before))) {
    const w = m[1] || ''
    const items = pick(HTML_TAGS, w, (t) => ({ label: t, insert: TAG_SNIPPETS[t] || t + '>$0</' + t + '>', kind: 'tag' }))
    return items.length ? { start: before.length - w.length, items } : null
  }
  const lt = before.lastIndexOf('<')
  if (lt > before.lastIndexOf('>')) {
    const inside = before.slice(lt)
    const even = (c) => (inside.split(c).length - 1) % 2 === 0
    const w = /([\w-]*)$/.exec(before)[1]
    if (even('"') && even("'") && w && /\s/.test(before[before.length - w.length - 1] || '')) {
      const items = pick(HTML_ATTRS, w, (a) => ({ label: a, insert: a.endsWith('-') ? a : a + '="$0"', kind: 'attribute' }))
      return items.length ? { start: before.length - w.length, items } : null
    }
  }
  return null
}

function cssCtx(before, after) {
  const open = (before.match(/{/g) || []).length > (before.match(/}/g) || []).length
  const line = before.slice(before.lastIndexOf('\n') + 1)
  let m
  if (open && (m = /([\w-]+)\s*:\s*([\w#-]*)$/.exec(line))) {
    const w = m[2]
    const semi = after.startsWith(';') ? '' : ';'
    const list = CSS_VALUES[m[1]] || CSS_GENERIC
    const items = (w ? list.filter((v) => starts(v, w)) : list).map((v) => ({ label: v, insert: v + semi, kind: 'value' }))
    return items.length ? { start: before.length - w.length, items } : null
  }
  if (open && (m = /(?:^|[\s{;])([a-z-]+)$/.exec(line))) {
    const items = pick(CSS_PROPS, m[1], (p) => ({ label: p, insert: p + ': $0;', kind: 'property' }))
    return items.length ? { start: before.length - m[1].length, items } : null
  }
  if (!open && (m = /(?:^|[\s,>+~}])([a-zA-Z][\w-]*)$/.exec(line))) {
    const items = pick(HTML_TAGS.concat(['*']), m[1], (t) => ({ label: t, insert: t + ' {\n  $0\n}', kind: 'selector' }))
    return items.length ? { start: before.length - m[1].length, items } : null
  }
  return null
}

function jsCtx(before, text) {
  const line = before.slice(before.lastIndexOf('\n') + 1)
  // no suggestions inside strings or // comments
  const odd = (c) => (line.split(c).length - 1) % 2 === 1
  if (odd("'") || odd('"') || odd('`') || line.includes('//')) return null
  let m
  if ((m = /\b(document|console|Math|JSON|Object|Array|window|localStorage)\.([\w]*)$/.exec(before))) {
    const w = m[2]
    const items = pick(MEMBERS[m[1]], w, (x) => ({ label: x, insert: MEMBER_SNIPPETS[x] || x, kind: 'method' }))
    return items.length ? { start: before.length - w.length, items } : null
  }
  if ((m = /\.([\w]*)$/.exec(before))) {
    const w = m[1]
    const items = pick(GENERAL_MEMBERS, w, (x) => ({ label: x, insert: MEMBER_SNIPPETS[x] || x, kind: 'method' }))
    return items.length ? { start: before.length - w.length, items } : null
  }
  if ((m = /([A-Za-z_$][\w$]*)$/.exec(before)) && m[1].length >= 2) {
    const w = m[1]
    const items = []
    JS_SNIPPETS.forEach(([l, ins, kind]) => l.toLowerCase().startsWith(w.toLowerCase()) && items.push({ label: l, insert: ins, kind }))
    JS_KEYWORDS.forEach((k) => starts(k, w) && items.push({ label: k, insert: k, kind: 'keyword' }))
    const seen = new Set(items.map((i) => i.label))
    for (const id of new Set(text.match(/[A-Za-z_$][\w$]{2,}/g) || [])) {
      if (!seen.has(id) && starts(id, w)) items.push({ label: id, insert: id, kind: 'variable' })
    }
    return items.length ? { start: before.length - w.length, items } : null
  }
  return null
}

export function getContext(lang, text, pos) {
  const before = text.slice(0, pos)
  if (lang === 'html') return htmlCtx(before)
  if (lang === 'css') return cssCtx(before, text.slice(pos))
  return jsCtx(before, text)
}

/* ------------------------------ UI ------------------------------ */
function caretXY(ta, pos) {
  const cs = getComputedStyle(ta)
  const div = document.createElement('div')
  ;['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing', 'tabSize'].forEach((p) => (div.style[p] = cs[p]))
  Object.assign(div.style, { position: 'absolute', visibility: 'hidden', left: '-9999px', top: '0', width: cs.width, whiteSpace: 'pre-wrap', wordWrap: 'break-word', overflow: 'hidden' })
  div.textContent = ta.value.slice(0, pos)
  const span = document.createElement('span')
  span.textContent = '\u200b'
  div.appendChild(span)
  document.body.appendChild(div)
  const r = { x: span.offsetLeft - ta.scrollLeft, y: span.offsetTop - ta.scrollTop, lh: parseFloat(cs.lineHeight) || 20 }
  div.remove()
  return r
}

export function attachSuggest(ta, getLang) {
  if (!ta) return () => {}
  let box = null
  let items = []
  let sel = 0
  let ctx = null
  let busy = false // true while we insert text ourselves

  const close = () => {
    if (box) box.remove()
    box = null
    items = []
    ctx = null
  }

  const draw = () => {
    if (!box) {
      box = document.createElement('div')
      Object.assign(box.style, {
        position: 'fixed', zIndex: 5000, minWidth: '200px', maxHeight: '240px', overflow: 'hidden',
        background: '#1d232d', border: '1px solid #2e3644', borderRadius: '6px',
        boxShadow: '0 6px 18px rgba(0,0,0,0.5)', font: '13px ui-monospace, Consolas, monospace', color: '#e8ecf1',
      })
      box.addEventListener('mousedown', (e) => e.preventDefault()) // keep focus in the editor
      document.body.appendChild(box)
    }
    box.innerHTML = ''
    items.forEach((it, i) => {
      const row = document.createElement('div')
      Object.assign(row.style, {
        display: 'flex', justifyContent: 'space-between', gap: '18px', padding: '5px 10px', cursor: 'pointer',
        background: i === sel ? '#2e3a4d' : 'transparent',
      })
      const a = document.createElement('span')
      a.textContent = it.label
      const b = document.createElement('span')
      b.textContent = it.kind
      b.style.color = '#7d8a9c'
      row.append(a, b)
      row.addEventListener('mousedown', (e) => { e.preventDefault(); sel = i; accept() })
      box.appendChild(row)
    })
    const rect = ta.getBoundingClientRect()
    const c = caretXY(ta, ta.selectionStart)
    let top = rect.top + c.y + c.lh + 4
    const left = Math.min(rect.left + c.x, window.innerWidth - 260)
    if (top + box.offsetHeight > window.innerHeight) top = rect.top + c.y - box.offsetHeight - 4
    box.style.left = Math.max(4, left) + 'px'
    box.style.top = Math.max(4, top) + 'px'
  }

  const show = (force) => {
    const pos = ta.selectionStart
    if (pos !== ta.selectionEnd) return close()
    const c = getContext(getLang(), ta.value, pos)
    if (!c || !c.items.length) return close()
    ctx = c
    items = c.items.slice(0, 8)
    sel = 0
    draw()
    return force
  }

  const lineIndent = (pos) => {
    const ls = ta.value.lastIndexOf('\n', pos - 1) + 1
    return /^[ \t]*/.exec(ta.value.slice(ls, pos))[0]
  }

  const insert = (text, start, end) => {
    busy = true
    ta.focus()
    ta.setSelectionRange(start, end)
    // execCommand keeps Ctrl+Z working and fires a real input event (React sees it);
    // fall back to setRangeText if the browser refuses
    if (!document.execCommand('insertText', false, text)) {
      ta.setRangeText(text, start, end, 'end')
      ta.dispatchEvent(new Event('input', { bubbles: true }))
    }
    busy = false
  }

  function accept() {
    if (!ctx || !items[sel]) return
    const it = items[sel]
    const start = ctx.start
    const end = ta.selectionStart
    const indent = lineIndent(start)
    let text = it.insert.replace(/\n/g, '\n' + indent)
    const at = text.indexOf('$0')
    text = text.replace('$0', '')
    close()
    insert(text, start, end)
    const caret = start + (at === -1 ? text.length : at)
    ta.setSelectionRange(caret, caret)
  }

  const onInput = (e) => {
    if (busy) return
    const t = e.inputType || ''
    if (t.startsWith('delete') || t === 'insertFromPaste' || t === 'insertFromDrop') return close()
    show()
  }

  const onKeyDown = (e) => {
    if (box) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        sel = (sel + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length
        return draw()
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        return accept()
      }
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) return close()
    }
    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault()
      return show(true)
    }
    if (e.key === 'Tab' && !e.altKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault() // indent instead of moving focus away from the editor
      return insert('  ', ta.selectionStart, ta.selectionEnd)
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && ta.selectionStart === ta.selectionEnd) {
      // keep the indentation of the current line, indent more after an opening bracket
      const pos = ta.selectionStart
      const indent = lineIndent(pos)
      const prev = ta.value[pos - 1]
      const next = ta.value[pos]
      e.preventDefault()
      if ('{[('.includes(prev || '#') && '}])'.includes(next || '#')) {
        insert('\n' + indent + '  \n' + indent, pos, pos)
        const caret = pos + 1 + indent.length + 2
        return ta.setSelectionRange(caret, caret)
      }
      return insert('\n' + indent + ('{[('.includes(prev || '#') ? '  ' : ''), pos, pos)
    }
  }

  ta.addEventListener('input', onInput)
  ta.addEventListener('keydown', onKeyDown)
  ta.addEventListener('blur', close)
  ta.addEventListener('mousedown', close)
  ta.addEventListener('scroll', close)
  return () => {
    close()
    ta.removeEventListener('input', onInput)
    ta.removeEventListener('keydown', onKeyDown)
    ta.removeEventListener('blur', close)
    ta.removeEventListener('mousedown', close)
    ta.removeEventListener('scroll', close)
  }
}
