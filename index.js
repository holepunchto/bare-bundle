const path = require('path')

module.exports = class Bundle {
  constructor () {
    this.version = 0
    this.main = null
    this.imports = Object.create(null)

    this._files = new Map()
  }

  [Symbol.iterator] () {
    return this._files[Symbol.iterator]()
  }

  exists (file) {
    return this._files.has(file)
  }

  read (file) {
    return this._files.get(file) || null
  }

  write (file, data, opts = {}) {
    const {
      main = false,
      alias = null
    } = opts

    this._files.set(file, typeof data === 'string' ? Buffer.from(data) : data)

    if (main) this.main = file
    if (alias) this.imports[alias] = file

    return this
  }

  map (fn) {
    this._files = new Map(
      [...this._files].map(([file, data]) => [file, fn(data, file)])
    )

    return this
  }

  mount (root) {
    const mounted = new Bundle()

    if (this.main) mounted.main = path.join(root, this.main)

    for (let [from, to] of Object.entries(this.imports)) {
      if (from.startsWith('/')) from = path.join(root, from)
      if (to.startsWith('/')) to = path.join(root, to)

      mounted.imports[from] = to
    }

    for (const [file, data] of this._files) {
      mounted._files.set(path.join(root, file), data)
    }

    return mounted
  }

  toBuffer (opts = {}) {
    const {
      indent = 0
    } = opts

    const header = {
      version: this.version,
      main: this.main,
      imports: this.imports,
      files: {}
    }

    let offset = 0

    for (const [file, data] of this._files) {
      header.files[file] = {
        offset,
        length: data.byteLength
      }

      offset += data.byteLength
    }

    const json = Buffer.from(`\n${JSON.stringify(header, null, indent)}\n`)

    const len = Buffer.from(json.byteLength.toString(10))

    const buffer = Buffer.alloc(len.byteLength + json.byteLength + offset)

    offset = 0

    buffer.set(len, offset)
    offset += len.byteLength

    buffer.set(json, offset)
    offset += json.byteLength

    for (const [, data] of this._files) {
      buffer.set(data, offset)
      offset += data.byteLength
    }

    return buffer
  }

  static isBundle (value) {
    return value instanceof Bundle
  }

  static from (buffer) {
    if (this.isBundle(buffer)) return buffer

    if (typeof buffer === 'string') buffer = Buffer.from(buffer)
    else buffer = Buffer.coerce(buffer)

    if (buffer[0] === 0x23 /* # */ && buffer[1] === 0x21 /* ! */) {
      let end = 2

      while (buffer[end] !== 0xa /* \n */) end++

      buffer = buffer.subarray(end + 1)
    }

    let end = 0

    while (isDecimal(buffer[end])) end++

    const len = parseInt(buffer.toString('utf8', 0, end), 10)

    const header = JSON.parse(buffer.toString('utf8', end, end + len))

    const bundle = new Bundle()

    bundle.main = header.main

    for (const [from, to] of Object.entries(header.imports)) {
      bundle.imports[from] = to
    }

    let offset = end + len

    for (const [file, info] of Object.entries(header.files)) {
      bundle.write(
        file,
        buffer.subarray(offset, offset + info.length)
      )

      offset += info.length
    }

    return bundle
  }
}

function isDecimal (c) {
  return c >= 0x30 && c <= 0x39
}
