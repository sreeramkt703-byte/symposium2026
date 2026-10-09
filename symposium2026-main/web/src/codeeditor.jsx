import { useEffect, useRef } from 'react'
import { highlight } from './highlight.js'
import { attachSuggest } from './suggest.js'

// One code editor: line numbers on the left, coloured code drawn behind a transparent <textarea>.
export default function CodeEditor({ lang, value, onChange, onCursor, visible, suggestions }) {
  const taRef = useRef(null)
  const preRef = useRef(null)
  const gutRef = useRef(null)

  // offline keyword / snippet suggestions (see suggest.js)
  useEffect(() => {
    if (!suggestions) return
    return attachSuggest(taRef.current, () => lang)
  }, [lang, suggestions])

  const sync = () => {
    const ta = taRef.current
    preRef.current.scrollTop = ta.scrollTop
    preRef.current.scrollLeft = ta.scrollLeft
    gutRef.current.scrollTop = ta.scrollTop
  }

  const cursor = () => {
    const ta = taRef.current
    const before = ta.value.slice(0, ta.selectionStart)
    onCursor({ ln: before.split('\n').length, col: before.length - before.lastIndexOf('\n') })
  }

  // when this file's tab is opened: focus it and refresh the status bar
  useEffect(() => {
    if (!visible) return
    taRef.current.focus()
    cursor()
    sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  const lines = value.split('\n').length

  return (
    <div className="ed">
      <div className="gutter" ref={gutRef} aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div className="codewrap">
        <pre className="hl" ref={preRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlight(lang, value) }} />
        <textarea
          ref={taRef}
          className="ta"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={sync}
          onSelect={cursor}
          onKeyUp={cursor}
          onClick={cursor}
          wrap="off"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          data-gramm="false"
          data-gramm_editor="false"
          data-enable-grammarly="false"
          data-lt-active="false"
        />
      </div>
    </div>
  )
}