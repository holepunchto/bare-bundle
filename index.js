const path = require('@pearjs/path')

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

    this._files.set(file, typeof data === 'string' ? Buffer.from(data) : data)

    if (main) this.main = file
    if (alias) this.imports[alias] = file

    return this
  }

  mount (root) {
    if (this.main) this.main = path.join(root, this.main)

    const imports = this.imports
    this.imports = Object.create(null)

    for (let [from, to] of Object.entries(imports)) {
      if (from.startsWith('/')) from = path.join(root, from)
      if (to.startsWith('/')) to = path.join(root, to)

      this.imports[from] = to
    }

    const files = this._files
    this._files = new Map()

    for (const [file, data] of files) {
      this._files.set(path.join(root, file), data)
    }

    return this
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

    const buffer = Buffer.alloc(4 + json.byteLength + offset)

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
    const view = new DataView(buffer.buffer)

    const json = buffer.subarray(4, 4 + view.getUint32(0, true))

    const header = JSON.parse(json.toString())

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
