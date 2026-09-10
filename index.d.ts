import Buffer from 'bare-buffer'
import URL from 'bare-url'

interface MemoryFileOptions {
  /** Whether the file should default to an executable mode (`0o755` instead of `0o644`). */
  executable?: boolean
  /** An explicit file mode (permission bits), overriding `executable`. */
  mode?: number
}

interface MemoryFile {
  /** Return the file's mode (permission bits). */
  mode(): number
  /** Return the file's contents as a `Buffer`. */
  read(): Buffer
  /** Return the file's byte length. */
  size(): number
}

declare class MemoryFile {
  /**
   * Create a `MemoryFile` from `data`, optionally marking it executable or setting an explicit
   * `mode`.
   * @param data - The file contents; a string is converted to a `Buffer`.
   * @param opts - Options; `mode` defaults to `0o755` when `executable` is `true`, otherwise
   * `0o644`.
   */
  constructor(data: string | Buffer, opts?: MemoryFileOptions)
}

interface BundleOptions {
  /** A custom file class to use instead of `MemoryFile` for files added to the bundle. */
  File?: typeof MemoryFile
}

type RecursiveStringObject = { [key: string]: string | RecursiveStringObject }

interface BundleWriteOptions {
  /** Mark the written file as a native addon, adding its key to `addons`. */
  addon?: boolean
  /** Register the written file's key under this specifier in the bundle's import map. */
  alias?: string
  /** Mark the written file as a non-JavaScript asset, adding its key to `assets`. */
  asset?: boolean
  /** Whether the written file should default to an executable mode. */
  executable?: boolean
  /** Per-file import resolutions to record for the written file's key. */
  imports?: RecursiveStringObject
  /** Mark the written file as the bundle's entry point. */
  main?: boolean
  /** An explicit file mode (permission bits) for the written file. */
  mode?: number
}

interface BundleMountOptions {
  /**
   * Per-condition root URLs used to resolve conditional import map entries during
   * `mount()`/`unmount()`.
   */
  conditions?: { [condition: string]: string | URL }
}

interface BundleToBufferOptions {
  /** Number of spaces to indent the JSON header when serializing with `toBuffer()`. */
  indent?: number
  /** Back the serialized buffer with a `SharedArrayBuffer` instead of a regular `ArrayBuffer`. */
  shared?: boolean
}

interface Bundle extends Iterable<[key: string, read: Buffer, mode: number]> {
  /** The bundle's files, keyed by path, as `MemoryFile` instances. */
  readonly files: Record<string, MemoryFile>
  /** The bundle format version this implementation produces and expects. */
  readonly version: number
  /**
   * The root this bundle was mounted at, or `null` if it was never mounted. A file may sit
   * outside it, as one unmounted from outside the root does.
   */
  readonly root: string | null

  /** The keys of files in the bundle that are native addons. */
  addons: string[]
  /** The keys of files in the bundle that are non-JavaScript assets. */
  assets: string[]
  /** An optional identifier for the bundle, or `null` if unset. */
  id: string | null
  /** The bundle's import map, mapping specifiers to file keys. */
  imports: RecursiveStringObject
  /** The key of the bundle's entry file, or `null` if unset. */
  main: string | null
  /**
   * The bundle's per-file import resolutions map, used to override the default import map for
   * specific files.
   */
  resolutions: RecursiveStringObject

  /**
   * Check whether the bundle contains no files.
   * @returns `true` if the bundle contains no files, `false` otherwise.
   */
  empty(): boolean
  /** Return the keys of all files in the bundle. */
  keys(): string[]
  /**
   * Check whether a file exists at `key`.
   * @param key - The key of the file to look up.
   * @returns `true` if a file exists at `key`, `false` otherwise.
   */
  exists(key: string): boolean
  /**
   * Return the file mode (permission bits) of the file at `key`, or `0` if it doesn't exist.
   * @param key - The key of the file to look up.
   */
  mode(key: string): number
  /**
   * Return the contents of the file at `key` as a `Buffer`, or `null` if it doesn't exist.
   * @param key - The key of the file to read.
   */
  read(key: string): Buffer
  /**
   * Add or replace the file at `key` with `data`, optionally marking it as the main entry, an
   * addon, an asset, or aliased in the import map.
   * @param key - The key (path) to store the file under.
   * @param data - The file contents.
   * @param opts - Options; `main`, `addon`, `asset`, and `executable` default to `false`, and
   * `alias` and `imports` to unset.
   * @returns The bundle itself, for chaining writes.
   * @throws {TypeError} `key` is not a string.
   */
  write(key: string, data: string, opts?: BundleWriteOptions): this
  /**
   * Return a copy of the bundle with all file keys and import/resolution specifiers rewritten as
   * absolute URLs resolved against `root`.
   * @param root - The base URL (or URL string) to resolve keys and specifiers against.
   * @param opts - Options; `conditions` maps import-map condition names to per-condition roots.
   * @returns A new `Bundle` with rewritten keys; the original bundle is left unchanged.
   */
  mount(root: string | URL, opts?: BundleMountOptions): Bundle
  /**
   * Return a copy of the bundle with all file keys and import/resolution specifiers rewritten as
   * paths relative to `root`, reversing `mount()`.
   * @param root - The base URL (or URL string) to make keys and specifiers relative to.
   * @param opts - Options; `conditions` maps import-map condition names to per-condition roots.
   * @returns A new `Bundle` with rewritten keys; the original bundle is left unchanged.
   */
  unmount(root: string | URL, opts?: BundleMountOptions): Bundle
  /**
   * Serialize the bundle to a single `Buffer` containing its header and file contents.
   * @param opts - Options; `indent` defaults to `0` and `shared` to `false`.
   */
  toBuffer(opts?: BundleToBufferOptions): Buffer
}

declare class Bundle {
  static readonly version: number

  /**
   * Create an empty `Bundle`, optionally supplying a custom `File` class to back stored files.
   * @param opts - Options; `File` defaults to `MemoryFile`.
   */
  constructor(opts?: BundleOptions)
}

/**
 * An in-memory application bundle: a set of files plus metadata (imports, resolutions, addons,
 * assets) that can be serialized to and parsed from a single buffer.
 */
declare namespace Bundle {
  export {
    type MemoryFile,
    type MemoryFileOptions,
    type BundleOptions,
    type BundleWriteOptions,
    type BundleMountOptions,
    type BundleToBufferOptions
  }

  /**
   * Check whether `value` is a `Bundle`.
   * @param value - The value to check.
   * @returns `true` if `value` is a `Bundle` instance or exposes the bundle kind symbol, `false`
   * otherwise.
   */
  export function isBundle(value: unknown): value is Bundle
  /**
   * Coerce `value` — a serialized bundle string, a `Buffer`, or an existing `Bundle` — into a
   * `Bundle`.
   * @param value - The serialized bundle string or buffer to parse, or an existing `Bundle`.
   * @returns The parsed `Bundle`, or `value` itself if it is already a `Bundle`.
   * @throws {INVALID_BUNDLE_HEADER} the serialized header is not valid JSON.
   */
  export function from(value: string | Buffer | Bundle): Bundle
}

export = Bundle
