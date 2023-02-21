const path = require('@pearjs/path')
const b4a = require('b4a')

module.exports = class Bundle {
  constructor () {
    this.version = 0
    this.main = null
    this.imports = Object.create(null)

    this._files = new Map()
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

    this._files.set(file, typeof data === 'string' ? b4a.from(data) : data)

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

    const json = b4a.from(`\n${JSON.stringify(header, null, indent)}\n`)

    const buffer = b4a.alloc(4 + json.byteLength + offset)

    const view = new DataView(buffer.buffer)

    offset = 0

    view.setUint32(offset, json.byteLength, true)
    offset += 4

    buffer.set(json, offset)
    offset += json.byteLength

    for (const [, data] of this._files) {
      buffer.set(data, offset)
      offset += data.byteLength
    }

    return buffer
  }

  static from (buffer) {
    if (typeof buffer === 'string') buffer = b4a.from(buffer)

    const view = new DataView(buffer.buffer)

    const json = buffer.subarray(4, 4 + view.getUint32(0, true))

    const header = JSON.parse(b4a.toString(json))

    const bundle = new Bundle()

    bundle.main = header.main
    bundle.imports = header.imports

    let offset = 4 + json.byteLength

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
