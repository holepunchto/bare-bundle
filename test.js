const test = require('brittle')
const Bundle = require('.')

test('basic', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo', { main: true })
    .write('/bar.js', 'bar')

  const buffer = bundle.toBuffer()

  t.alike(bundle, Bundle.from(buffer))
})
