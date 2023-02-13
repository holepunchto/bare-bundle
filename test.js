const test = require('brittle')
const Bundle = require('.')

test('basic', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo', { main: true })
    .write('/bar.js', 'bar', { alias: 'bar' })

  t.is(bundle.main, '/foo.js')

  t.alike(bundle.read('/foo.js'), Buffer.from('foo'))
  t.alike(bundle.read('/bar.js'), Buffer.from('bar'))

  const buffer = bundle.toBuffer()

  t.alike(bundle, Bundle.from(buffer))
})

test('directories', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/a.js', 'a')
    .write('/a/b.js', 'b')
    .write('/a/b/c.js', 'c')
    .write('/d.js', 'd')
    .write('/d/e.js', 'e')

  t.alike([...bundle.directories()], [
    '/',
    '/a',
    '/a/b',
    '/d'
  ])
})
