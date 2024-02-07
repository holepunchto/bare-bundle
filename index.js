const b4a = require('b4a')

module.exports = class Bundle {
  static get version () {
    return 0
  }

  constructor () {
    this._main = null
    this._imports = {}
    this._resolutions = {}
    this._files = new Map()
  }

  get version () {
    return Bundle.version
  }

  get main () {
    return this._main
  }

  set main (value) {
    if (typeof value !== 'string' && value !== null) {
      throw new TypeError(`Main must be a string or null. Received type ${typeof value} (${value})`)
    }

    this._main = value
  }

  get imports () {
    return this._imports
  }

  set imports (value) {
    this._imports = cloneImportsMap(value)
  }

  get resolutions () {
    return this._resolutions
  }

  set resolutions (value) {
    this._resolutions = cloneResolutionsMap(value)
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
    if (typeof file !== 'string') {
      throw new TypeError(`File path must be a string. Received type ${typeof file} (${file})`)
    }

    const {
      main = false,
      alias = null,
      resolutions = null
    } = opts

    this._files.set(file, typeof data === 'string' ? b4a.from(data) : data)

    if (main) this._main = file
    if (alias) this._imports[alias] = file
    if (resolutions) this._resolutions[file] = cloneImportsMap(resolutions)

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

    // Go through the private API properties as we're operating on already
    // validated values.

    mounted._main = mountBundlePath(this._main, root)
    mounted._imports = mountBundlePath(this._imports, root)

    if (this._resolutions) mounted._resolutions = mountBundlePath(this._resolutions, root)

    for (const [file, data] of this._files) {
      mounted._files.set(mountBundlePath(file, root), data)
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
      resolutions: this.resolutions,
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

    const len = b4a.from(json.byteLength.toString(10))

    const buffer = b4a.alloc(len.byteLength + json.byteLength + offset)

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

    if (typeof buffer === 'string') buffer = b4a.from(buffer)

    if (buffer[0] === 0x23 /* # */ && buffer[1] === 0x21 /* ! */) {
      let end = 2

      while (buffer[end] !== 0xa /* \n */) end++

      buffer = buffer.subarray(end + 1)
    }

    let end = 0

    while (isDecimal(buffer[end])) end++

    const len = parseInt(b4a.toString(buffer, 'utf8', 0, end), 10)

    const header = JSON.parse(b4a.toString(buffer, 'utf8', end, end + len))

    const bundle = new Bundle()

    // Go through the public API setters to ensure that the header fields are
    // validated.

    if (header.main) bundle.main = header.main
    if (header.imports) bundle.imports = header.imports
    if (header.resolutions) bundle.resolutions = header.resolutions

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

function cloneImportsMap (value) {
  if (typeof value === 'object' && value !== null) {
    const imports = {}

    for (const entry of Object.entries(value)) {
      imports[entry[0]] = cloneImportsMapEntry(entry[1])
    }

    return imports
  }

  throw new TypeError(`Imports map must be an object. Received type ${typeof value} (${value})`)
}

function cloneImportsMapEntry (value) {
  if (typeof value === 'string') return value

  if (typeof value === 'object' && value !== null) {
    const imports = {}

    for (const entry of Object.entries(value)) {
      imports[entry[0]] = cloneImportsMapEntry(entry[1])
    }

    return imports
  }

  throw new TypeError(`Imports map entry must be a string or object. Received type ${typeof value} (${value})`)
}

function cloneResolutionsMap (value) {
  if (typeof value === 'object' && value !== null) {
    const resolutions = {}

    for (const entry of Object.entries(value)) {
      resolutions[entry[0]] = cloneImportsMap(entry[1])
    }

    return resolutions
  }

  throw new TypeError(`Resolution map must be an object. Received type ${typeof value} (${value})`)
}

function mountBundlePath (value, root) {
  if (typeof value === 'string') {
    if (value[0] === '/') return new URL('.' + value, root).href

    return value
  }

  if (typeof value === 'object' && value !== null) {
    const mounted = {}

    for (const entry of Object.entries(value)) {
      mounted[mountBundlePath(entry[0], root)] = mountBundlePath(entry[1], root)
    }

    return mounted
  }

  return null
}
