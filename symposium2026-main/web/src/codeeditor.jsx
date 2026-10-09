import { useState, useRef } from 'react';
import './CodeEditor.css';

const LANGS = { python: 'py', javascript: 'js', java: 'java', c: 'c', cpp: 'cpp' };

export default function CodeEditor({ files, setFiles, onRun, output, running }) {
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState('python');
  const [split, setSplit] = useState(60); // editor width in %
  const wrapRef = useRef(null);

  const file = files[active] || files[0];

  const updateCode = (code) =>
    setFiles(files.map((f, i) => (i === active ? { ...f, code } : f)));

  const addFile = () => {
    let name = newName.trim() || `file${files.length + 1}`;
    if (!name.includes('.')) name += '.' + LANGS[newLang];
    if (files.some((f) => f.name === name)) {
      alert('A file with this name already exists');
      return;
    }
    setFiles([...files, { name, lang: newLang, code: '' }]);
    setActive(files.length);
    setAdding(false);
    setNewName('');
  };

  const closeFile = (i, e) => {
    e.stopPropagation();
    if (files.length === 1) return;
    if (!window.confirm(`Delete ${files[i].name}?`)) return;
    setFiles(files.filter((_, idx) => idx !== i));
    setActive(0);
  };

  const renameFile = (i) => {
    const name = window.prompt('Rename file', files[i].name);
    if (!name || !name.trim()) return;
    setFiles(files.map((f, idx) => (idx === i ? { ...f, name: name.trim() } : f)));
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const t = e.target;
      const s = t.selectionStart;
      const v = t.value;
      updateCode(v.slice(0, s) + '  ' + v.slice(t.selectionEnd));
      requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 2));
    }
  };

  const startDrag = (e) => {
    e.preventDefault();
    const move = (ev) => {
      const r = wrapRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - r.left) / r.width) * 100;
      setSplit(Math.min(80, Math.max(20, pct)));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="ce-root">
      <div className="ce-tabs">
        {files.map((f, i) => (
          <div
            key={f.name}
            className={'ce-tab' + (i === active ? ' active' : '')}
            onClick={() => setActive(i)}
            onDoubleClick={() => renameFile(i)}
            title="Double-click to rename"
          >
            {f.name}
            {files.length > 1 && (
              <span className="ce-x" onClick={(e) => closeFile(i, e)}>×</span>
            )}
          </div>
        ))}
        <button className="ce-add" onClick={() => setAdding(!adding)}>+</button>
        <button className="ce-run" disabled={running} onClick={() => onRun(file, files)}>
          {running ? 'Running…' : '▶ Run'}
        </button>
      </div>

      {adding && (
        <div className="ce-newfile">
          <input
            placeholder="file name (e.g. utils)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFile()}
            autoFocus
          />
          <select value={newLang} onChange={(e) => setNewLang(e.target.value)}>
            {Object.keys(LANGS).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <button onClick={addFile}>Create</button>
        </div>
      )}

      <div className="ce-split" ref={wrapRef}>
        <textarea
          className="ce-code"
          style={{ width: `${split}%` }}
          value={file.code}
          onChange={(e) => updateCode(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
        <div className="ce-divider" onPointerDown={startDrag} />
        <pre className="ce-output" style={{ width: `${100 - split}%` }}>
          {output || 'Output will appear here...'}
        </pre>
      </div>
    </div>
  );
}