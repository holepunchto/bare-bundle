const test = require('brittle')
const Bundle = require('.')

test('basic', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo', { main: true })
    .write('/bar.js', 'bar', { alias: 'bar' })

  t.is(bundle.version, 0)
  t.is(bundle.main, '/foo.js')

  t.alike(bundle.read('/foo.js'), Buffer.from('foo'))
  t.alike(bundle.read('/bar.js'), Buffer.from('bar'))

  const buffer = bundle.toBuffer()

  t.alike(bundle, Bundle.from(buffer))

  t.alike([...bundle.keys()], ['/foo.js', '/bar.js'])
})

test('map', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo')
    .write('/bar.js', 'bar')
    .map((data, file) => Buffer.concat([data, Buffer.from('baz')]))

  t.alike(bundle.read('/foo.js'), Buffer.from('foobaz'))
  t.alike(bundle.read('/bar.js'), Buffer.from('barbaz'))
})

test('mount', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo')
    .write('/bar.js', 'bar')

  bundle.imports = {
    bar: '/bar.js'
  }

  bundle.resolutions = {
    '/bar.js': {
      foo: '/foo.js'
    }
  }

  const mounted = bundle.mount(new URL('file:///dir/'))

  t.alike([...mounted], [
    ['file:///dir/foo.js', Buffer.from('foo')],
    ['file:///dir/bar.js', Buffer.from('bar')]
  ])

  t.alike(mounted.imports, {
    bar: 'file:///dir/bar.js'
  })

  t.alike(mounted.resolutions, {
    'file:///dir/bar.js': {
      foo: 'file:///dir/foo.js'
    }
  })
})

test('iterate', (t) => {
  const bundle = new Bundle()

  bundle
    .write('/foo.js', 'foo')
    .write('/bar.js', 'bar')

  t.alike([...bundle], [
    ['/foo.js', Buffer.from('foo')],
    ['/bar.js', Buffer.from('bar')]
  ])
})

test('hashbang', (t) => {
  const bundle = new Bundle()

  const buffer = bundle
    .write('/foo.js', 'foo')
    .toBuffer()

  const parsed = Bundle.from(
    Buffer.concat([Buffer.from('#!hashbang\n'), buffer])
  )

  t.alike(bundle, parsed)
})
