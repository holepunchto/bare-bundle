module.exports = class Bundle {
  constructor () {
    this.version = 0
    this.main = null

    this._files = new Map()
  }

  read (file) {
    return this._files.get(file) || null
  }

  write (file, data, opts = {}) {
    this._files.set(file, typeof data === 'string' ? Buffer.from(data) : data)
    if (opts.main) this.main = file
    return this
  }

  toBuffer (opts = {}) {
    const {
      indent = 0
    } = opts

    const header = {
      version: this.version,
      main: this.main,
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

    let offset = 4 + json.byteLength

    for (const [file, info] of Object.entries(header.files)) {
      bundle.write(
        file,
        buffer.subarray(offset, offset + info.length),
        {
          main: header.main === file
        }
      )

      offset += info.length
    }

    return bundle
  }
}
