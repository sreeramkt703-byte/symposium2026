// Minimal .zip writer (no npm packages needed). Used to save and download the students' code.
const zlib = require('zlib')

// CRC-32 table
const TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (buf) => {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// entries: [{ name: 'folder/file.html', data: Buffer | string }]  ->  Buffer (the .zip file)
function createZip(entries) {
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  const parts = []
  const central = []
  let offset = 0

  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(String(e.data), 'utf8')
    const packed = zlib.deflateRawSync(data)
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0x0800, 6) // flags: names are UTF-8
    local.writeUInt16LE(8, 8) // method: deflate
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)
    parts.push(local, name, packed)

    const cd = Buffer.alloc(46)
    cd.writeUInt32LE(0x02014b50, 0)
    cd.writeUInt16LE(20, 4) // version made by
    cd.writeUInt16LE(20, 6) // version needed
    cd.writeUInt16LE(0x0800, 8)
    cd.writeUInt16LE(8, 10)
    cd.writeUInt16LE(time, 12)
    cd.writeUInt16LE(date, 14)
    cd.writeUInt32LE(crc, 16)
    cd.writeUInt32LE(packed.length, 20)
    cd.writeUInt32LE(data.length, 24)
    cd.writeUInt16LE(name.length, 28)
    cd.writeUInt32LE(offset, 42)
    central.push(cd, name)

    offset += local.length + name.length + packed.length
  }

  const cdSize = central.reduce((n, b) => n + b.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cdSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, ...central, end])
}

// a name that is safe inside a zip / on disk (no slashes, no "..")
const safeSeg = (s) => String(s).replace(/[^A-Za-z0-9_.-]/g, '_').replace(/^\.+/, '_').slice(0, 60) || 'file'

// the files of one submission: new ones have `files`, older ones only html / css / js
function entriesOf(sub) {
  const raw =
    Array.isArray(sub.files) && sub.files.length
      ? sub.files
      : [
          { name: 'index.html', content: sub.html },
          { name: 'style.css', content: sub.css },
          { name: 'script.js', content: sub.js },
        ]
  const used = new Set()
  return raw.slice(0, 30).map((f, i) => {
    let name = safeSeg((f && f.name) || 'file' + (i + 1))
    while (used.has(name.toLowerCase())) name = '_' + name
    used.add(name.toLowerCase())
    return { name, data: Buffer.from(String((f && f.content) || ''), 'utf8') }
  })
}

module.exports = { createZip, entriesOf, safeSeg }