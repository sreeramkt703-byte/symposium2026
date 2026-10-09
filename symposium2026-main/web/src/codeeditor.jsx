import { useState, useRef } from 'react';
import "./codeeditor.css";

const LANGS = { python: 'py', javascript: 'js', java: 'java', c: 'c', cpp: 'cpp' };
const DEFAULT_FILES = [{ name: 'main.py', lang: 'python', code: '' }];

export default function CodeEditor({
  files = DEFAULT_FILES,
  setFiles = () => {},
  onRun = () => {},
  output = '',
  running = false,
}) {
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLang, setNewLang] = useState('python');
  const [split, setSplit] = useState(60);
  const wrapRef = useRef(null);

  const safeFiles = Array.isArray(files) && files.length ? files : DEFAULT_FILES;
  const file = safeFiles[active] || safeFiles[0];

  const updateCode = (code) =>
    setFiles(safeFiles.map((f, i) => (i === active ? { ...f, code } : f)));

  const addFile = () => {
    let name = newName.trim() || `file${safeFiles.length + 1}`;
    if (!name.includes('.')) name += '.' + LANGS[newLang];
    if (safeFiles.some((f) => f.name === name)) {
      alert('A file with this name already exists');
      return;
    }
    setFiles([...safeFiles, { name, lang: newLang, code: '' }]);
    setActive(safeFiles.length);
    setAdding(false);
    setNewName('');
  };

  const closeFile = (i, e) => {
    e.stopPropagation();
    if (safeFiles.length === 1) return;
    if (!window.confirm(`Delete ${safeFiles[i].name}?`)) return;
    setFiles(safeFiles.filter((_, idx) => idx !== i));
    setActive(0);
  };

const renameFile = (i) => {
  const name = window.prompt('Rename file', safeFiles[i].name);
  if (!name || !name.trim()) return;
  setFiles(safeFiles.map((f, idx) =>
    idx === i ? { ...f, name: name.trim() } : f
  ));
};

}