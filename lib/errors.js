module.exports = class BundleError extends Error {
  constructor(msg, fn = BundleError, opts = {}) {
    const { cause, code = fn.name } = opts

    super(`${code}: ${msg}`, { cause })
    this.code = code

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, fn)
    }
  }

  get name() {
    return 'BundleError'
  }

  static INVALID_BUNDLE_HEADER(msg, cause) {
    return new BundleError(msg, BundleError.INVALID_BUNDLE_HEADER, { cause })
  }
}
