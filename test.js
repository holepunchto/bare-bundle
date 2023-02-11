const test = require('brittle')
const Bundle = require('.')

test('basic', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo', { main: true })
    .write('/bar.js', 'bar')

  t.is(bundle.main, '/foo.js')

  t.alike(bundle.read('/foo.js'), Buffer.from('foo'))
  t.alike(bundle.read('/bar.js'), Buffer.from('bar'))

  const buffer = bundle.toBuffer()

  t.alike(bundle, Bundle.from(buffer))
})
