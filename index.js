const b4a = require('b4a')

const Bundle = module.exports = exports = class Bundle {
  static get version () {
    return 0
  }

  constructor () {
    this._main = null
    this._imports = {}
    this._resolutions = {}
    this._addons = []
    this._assets = []
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

  get addons () {
    return this._addons
  }

  set addons (value) {
    this._addons = cloneFilesList(value, 'Addons')
  }

  get assets () {
    return this._assets
  }

  set assets (value) {
    this._assets = cloneFilesList(value, 'Assets')
  }

  get files () {
    return Object.fromEntries(this._files.entries())
  }

  [Symbol.iterator] () {
    return this._files[Symbol.iterator]()
  }

  keys () {
    return this._files.keys()
  }

  size (file) {
    return this._files.has(file) ? this._files.get(file).byteLength : 0
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
      resolutions = null,
      addon = false,
      asset = false
    } = opts

    this._files.set(file, typeof data === 'string' ? b4a.from(data) : data)

    if (main) this._main = file
    if (alias) this._imports[alias] = file
    if (resolutions) this._resolutions[file] = cloneImportsMap(resolutions)
    if (addon) this._addons.push(file)
    if (asset) this._assets.push(file)

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

    mounted._addons = mountBundlePath(this._addons, root)
    mounted._assets = mountBundlePath(this._assets, root)

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
      addons: this.addons.sort(),
      assets: this.assets.sort(),
      files: {}
    }

    const files = [...this._files.keys()].sort()

    let offset = 0

    for (const file of files) {
      const length = this.size(file)

      header.files[file] = { offset, length }
      offset += length
    }

    const json = b4a.from(`\n${JSON.stringify(header, null, indent)}\n`)

    const len = b4a.from(json.byteLength.toString(10))

    const buffer = b4a.alloc(len.byteLength + json.byteLength + offset)

    offset = 0

    buffer.set(len, offset)
    offset += len.byteLength

    buffer.set(json, offset)
    offset += json.byteLength

    for (const file of files) {
      buffer.set(this.read(file), offset)
      offset += this.size(file)
    }

    return buffer
  }

  inspect () {
    return {
      __proto__: { constructor: Bundle },

      main: this.main,
      imports: this.imports,
      resolutions: this.resolutions,
      addons: this.addons,
      assets: this.assets,
      files: this.files
    }
  }

  [Symbol.for('bare.inspect')] () {
    return this.inspect()
  }

  [Symbol.for('nodejs.util.inspect.custom')] () {
    return this.inspect()
  }
}

exports.isBundle = function isBundle (value) {
  return value instanceof Bundle
}

exports.from = function from (value) {
  // from(string)
  if (typeof value === 'string') return fromString(value)

  // from(buffer)
  if (b4a.isBuffer(value)) return fromBuffer(value)

  // from(bundle)
  return value
}

function fromString (string) {
  return fromBuffer(b4a.from(string))
}

function fromBuffer (buffer) {
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
  if (header.addons) bundle.addons = header.addons
  if (header.assets) bundle.assets = header.assets

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

  throw new TypeError(`Resolutions map must be an object. Received type ${typeof value} (${value})`)
}

function cloneFilesList (value, name) {
  if (Array.isArray(value)) {
    const files = []

    for (const entry of value) {
      if (typeof entry !== 'string') {
        throw new TypeError(`${name} entry must be a string. Received type ${typeof entry} (${entry})`)
      }

      files.push(entry)
    }

    return files
  }

  throw new TypeError(`${name} list must be an array. Received type ${typeof value} (${value})`)
}

function mountBundlePath (value, root) {
  if (typeof value === 'string') {
    if (value[0] === '/') return new URL('.' + value, root).href

    return value
  }

  if (Array.isArray(value)) {
    const mounted = []

    for (const entry of value) {
      mounted.push(mountBundlePath(entry, root))
    }

    return mounted
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
