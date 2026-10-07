// Detects tab switch / Alt+Tab / Win key / Esc / fullscreen exit. Returns a stop() function.
export function startSecurity(onViolation) {
  const onVisibility = () => document.hidden && onViolation('tab-switch')
  // Clicking the preview iframe moves focus into it. That is NOT leaving the exam, so only
  // report a blur when the whole page (including the iframe) has really lost focus.
  const onBlur = () =>
    setTimeout(() => {
      if (document.activeElement?.tagName === 'IFRAME' || document.hasFocus()) return
      onViolation('window-blur')
    }, 0)

  // Events coming from inside the preview iframe (keys / blur), see GUARD_SCRIPT below
  const onMessage = (e) => {
    const m = e.data && e.data.examGuard
    if (!m) return
    if (m === 'iframe-blur') setTimeout(() => !document.hasFocus() && onViolation('window-blur'), 0)
    else onViolation(m)
  }
  const onFullscreen = () => !document.fullscreenElement && onViolation('fullscreen-exit')

  const onKey = (e) => {
    const k = e.key
    if (k === 'Meta' || k === 'Escape' || (e.altKey && k === 'Tab')) {
      e.preventDefault()
      onViolation('key:' + (e.altKey ? 'Alt+' : '') + k)
    }
    const devtools =
      k === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k.toUpperCase())) ||
      (e.ctrlKey && k.toLowerCase() === 'u')
    if (devtools) e.preventDefault()
  }
  const noMenu = (e) => e.preventDefault()
  const beforeUnload = (e) => {
    e.preventDefault()
    e.returnValue = ''
  }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  document.addEventListener('fullscreenchange', onFullscreen)
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('message', onMessage)
  document.addEventListener('contextmenu', noMenu)
  window.addEventListener('beforeunload', beforeUnload)
  // Chrome/Edge: lets us receive Esc in fullscreen instead of exiting silently
  navigator.keyboard?.lock?.(['Escape']).catch(() => {})

  return () => {
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('fullscreenchange', onFullscreen)
    window.removeEventListener('keydown', onKey, true)
    window.removeEventListener('message', onMessage)
    document.removeEventListener('contextmenu', noMenu)
    window.removeEventListener('beforeunload', beforeUnload)
    navigator.keyboard?.unlock?.()
  }
}

// Put this at the start of the preview iframe so Alt+Tab / Win / Esc are still detected
// while the student's focus is inside the preview.
export const GUARD_SCRIPT = `<script>
addEventListener('keydown',function(e){var k=e.key;
if(k==='Meta'||k==='Escape'||(e.altKey&&k==='Tab')){e.preventDefault();parent.postMessage({examGuard:'key:'+(e.altKey?'Alt+':'')+k},'*')}
if(k==='F12'||(e.ctrlKey&&e.shiftKey&&'IJC'.indexOf(k.toUpperCase())>-1)||(e.ctrlKey&&k.toLowerCase()==='u'))e.preventDefault()},true);
addEventListener('blur',function(){parent.postMessage({examGuard:'iframe-blur'},'*')});
addEventListener('contextmenu',function(e){e.preventDefault()});
<\/script>`
