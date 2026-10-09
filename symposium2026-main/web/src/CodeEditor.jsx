
import { useEffect, useRef } from 'react';
import './codeeditor.css';

// Basic autocomplete suggestions for HTML, CSS and JavaScript.
const WORDS = {
  html: [
    'html', 'head', 'body', 'div', 'span', 'h1', 'h2',
    'p', 'button', 'script', 'style', 'class', 'id'
  ],
  css: [
    'color', 'background', 'display', 'flex', 'grid',
    'margin', 'padding', 'border', 'width', 'height',
    'font-size'
  ],
  js: [
    'const', 'let', 'var', 'function', 'return',
    'document', 'querySelector', 'addEventListener',
    'console.log', 'if', 'else'
  ]
};

export default function CodeEditor({
  lang = 'html',
  value = '',
  onChange = () => {},
  onCursor = () => {},
  visible = true,
  suggestions = false
}) {
  const textareaRef = useRef(null);

  const words = WORDS[lang] || [];

  // Update cursor position in the status bar.
  const reportCursor = () => {
    const editor = textareaRef.current;

    if (!editor) return;

    const before = editor.value.slice(
      0,
      editor.selectionStart
    );

    const lines = before.split('\n');

    onCursor({
      ln: lines.length,
      col: lines[lines.length - 1].length + 1
    });
  };

  useEffect(() => {
    if (visible) {
      reportCursor();
    }
  }, [visible]);

  // Handle Tab and basic autocomplete.
  const handleKeyDown = (event) => {
    const editor = textareaRef.current;

    if (!editor) return;

    // Insert two spaces when pressing Tab.
    if (event.key === 'Tab') {
      event.preventDefault();

      const start = editor.selectionStart;
      const end = editor.selectionEnd;

      const nextValue =
        editor.value.slice(0, start) +
        '  ' +
        editor.value.slice(end);

      onChange(nextValue);

      requestAnimationFrame(() => {
        editor.focus();
        editor.setSelectionRange(start + 2, start + 2);
        reportCursor();
      });

      return;
    }

    // Complete a matching keyword when Enter is pressed.
    if (
      suggestions &&
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      const start = editor.selectionStart;
      const lineStart =
        editor.value.lastIndexOf('\n', start - 1) + 1;

      const typed = editor.value
        .slice(lineStart, start)
        .trim();

      const match = words.find(
        (word) =>
          word.toLowerCase().startsWith(typed.toLowerCase()) &&
          word.toLowerCase() !== typed.toLowerCase()
      );

      if (typed && match) {
        event.preventDefault();

        const nextValue =
          editor.value.slice(0, lineStart) +
          match +
          editor.value.slice(start);

        onChange(nextValue);

        requestAnimationFrame(() => {
          editor.focus();

          const position = lineStart + match.length;

          editor.setSelectionRange(position, position);
          reportCursor();
        });
      }
    }
  };

  return (
    <div
      className="ce-root"
      style={{
        display: visible ? 'flex' : 'none',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%'
      }}
    >
      <textarea
        ref={textareaRef}
        className="ce-code"
        aria-label={`${lang.toUpperCase()} code editor`}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        value={value ?? ''}
        onChange={(event) => {
          onChange(event.target.value);
          requestAnimationFrame(reportCursor);
        }}
        onClick={reportCursor}
        onKeyUp={reportCursor}
        onSelect={reportCursor}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '100%',
          minHeight: '240px',
          flex: 1,
          display: 'block',
          boxSizing: 'border-box',
          resize: 'none',
          pointerEvents: 'auto',
          userSelect: 'text'
        }}
      />
    </div>
  );
}

