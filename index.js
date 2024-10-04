const b4a = require('b4a')

class MemoryFile {
  constructor (data, opts = {}) {
    const {
      executable = false,
      mode = executable ? 0o755 : 0o644
    } = opts

    this._data = typeof data === 'string' ? b4a.from(data) : data
    this._mode = mode
  }

  size () {
    return this._data.byteLength
  }

  mode () {
    return this._mode
  }

  read () {
    return this._data
  }

  inspect () {
    return {
      __proto__: { constructor: MemoryFile },

      data: this._data,
      mode: this._mode.toString(8)
    }
  }

  [Symbol.for('bare.inspect')] () {
    return this.inspect()
  }

  [Symbol.for('nodejs.util.inspect.custom')] () {
    return this.inspect()
  }
}

const Bundle = module.exports = exports = class Bundle {
  static get version () {
    return 0
  }

  constructor (opts = {}) {
    const {
      File = MemoryFile
    } = opts

    this._File = File
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

  * [Symbol.iterator] () {
    for (const [key, file] of this._files) {
      yield [key, file.read(), file.mode()]
    }
  }

  keys () {
    return this._files.keys()
  }

  exists (key) {
    return this._files.has(key)
  }

  size (key) {
    const file = this._files.get(key) || null
    if (file === null) return 0
    return file.size()
  }

  mode (key) {
    const file = this._files.get(key) || null
    if (file === null) return 0
    return file.mode()
  }

  read (key) {
    const file = this._files.get(key) || null
    if (file === null) return null
    return file.read()
  }

  write (key, data, opts = {}) {
    if (typeof key !== 'string') {
      throw new TypeError(`File path must be a string. Received type ${typeof key} (${key})`)
    }

    const {
      main = false,
      alias = null,
      resolutions = null,
      addon = false,
      asset = false
    } = opts

    this._files.set(key, new MemoryFile(data, opts))

    if (main) this._main = key
    if (alias) this._imports[alias] = key
    if (resolutions) this._resolutions[key] = cloneImportsMap(resolutions)
    if (addon) this._addons.push(key)
    if (asset) this._assets.push(key)

    return this
  }

  mount (root, opts = {}) {
    const mounted = new Bundle()

    // Go through the private API properties as we're operating on already
    // validated values.

    if (this._main) mounted._main = mountPath(this._main, root)

    mounted._imports = mountImportsMap(this._imports, root, null, opts)
    mounted._resolutions = mountResolutionsMap(this._resolutions, root, opts)

    for (const [key, file] of this._files) {
      mounted._files.set(mountPath(key, root), file)
    }

    mounted._addons = mountFilesList(this._addons, root)
    mounted._assets = mountFilesList(this._assets, root)

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

    const keys = [...this._files.keys()].sort()

    let offset = 0

    for (const key of keys) {
      const length = this.size(key)

      header.files[key] = { offset, length, mode: this.mode(key) }
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

    for (const key of keys) {
      buffer.set(this.read(key), offset)
      offset += this.size(key)
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
      buffer.subarray(offset, offset + info.length),
      {
        mode: info.mode || 0o644
      }
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

function mountPath (value, root) {
  if (value[0] === '/') return new URL('.' + value, root).href

  return value
}

function mountImportsMap (value, root, conditionalRoot, opts) {
  const { conditions = {} } = opts

  const imports = {}

  for (const entry of Object.entries(value)) {
    const condition = entry[0]

    imports[condition] = mountImportsMapEntry(entry[1], root, conditionalRoot || conditions[condition], opts)
  }

  return imports
}

function mountImportsMapEntry (value, root, conditionalRoot, opts) {
  const { conditions = {} } = opts

  if (typeof value === 'string') return mountPath(value, conditionalRoot || conditions.default || root)

  return mountImportsMap(value, root, conditionalRoot, opts)
}

function mountResolutionsMap (value, root, opts) {
  const resolutions = {}

  for (const entry of Object.entries(value)) {
    resolutions[mountPath(entry[0], root)] = mountImportsMap(entry[1], root, null, opts)
  }

  return resolutions
}

function mountFilesList (value, root) {
  const files = []

  for (const entry of value) {
    files.push(mountPath(entry, root))
  }

  return files
}
