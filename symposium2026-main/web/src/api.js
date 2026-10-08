// Backend address:
//  - VITE_API set (Netlify)                    -> that address (your ngrok URL)
//  - npm run dev (port 5173)                   -> same machine, port 5000
//  - served by the backend itself (port 5000)  -> same origin
const BASE = (
  import.meta.env.VITE_API ||
  (location.port === '5173' ? location.protocol + '//' + location.hostname + ':5000' : '')
).replace(/\/+$/, '')

// Stops ngrok's free-plan warning page from blocking API calls (ignored by other hosts)
const HEAD = { 'ngrok-skip-browser-warning': '1' }

export const api = {
  get: (p) => fetch(BASE + p, { headers: HEAD }).then((r) => r.json()),
  post: (p, body) =>
    fetch(BASE + p, {
      method: 'POST',
      headers: { ...HEAD, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then((r) => r.json()),
}