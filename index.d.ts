import Buffer from 'bare-buffer'
import URL from 'bare-url'

interface MemoryFileOptions {
  executable?: boolean
  mode?: number
}

interface MemoryFile {
  mode(): number
  read(): Buffer
  size(): number
}

declare class MemoryFile {
  constructor(data: string | Buffer, opts?: MemoryFileOptions)
}

interface BundleOptions {
  File?: typeof MemoryFile
}

type RecursiveStringObject = { [key: string]: string | RecursiveStringObject }

interface BundleWriteOptions {
  addon?: boolean
  alias?: string
  asset?: boolean
  executable?: boolean
  imports?: RecursiveStringObject
  main?: boolean
  mode?: number
}

interface BundleMountOptions {
  conditions?: { [condition: string]: string | URL }
}

interface BundleToBufferOptions {
  indent?: number
  shared?: boolean
}

interface Bundle extends Iterable<[key: string, read: Buffer, mode: number]> {
  readonly files: Record<string, MemoryFile>
  readonly version: number

  addons: string[]
  assets: string[]
  id: string | null
  imports: RecursiveStringObject
  main: string | null
  resolutions: RecursiveStringObject

  empty(): boolean
  keys(): string[]
  exists(key: string): boolean
  mode(key: string): number
  read(key: string): Buffer
  write(key: string, data: string, opts?: BundleWriteOptions): this
  mount(root: string | URL, opts?: BundleMountOptions): Bundle
  unmount(root: string | URL, opts?: BundleMountOptions): Bundle
  toBuffer(opts?: BundleToBufferOptions): Buffer
}

declare class Bundle {
  static readonly version: number

  constructor(opts?: BundleOptions)
}

declare namespace Bundle {
  export {
    type MemoryFile,
    type MemoryFileOptions,
    type BundleOptions,
    type BundleWriteOptions,
    type BundleMountOptions,
    type BundleToBufferOptions
  }

  export function isBundle(value: unknown): value is Bundle
  export function from(value: string | Buffer | Bundle): Bundle
}

export = Bundle
