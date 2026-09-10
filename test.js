const test = require('brittle')
const Bundle = require('.')

test('basic', (t) => {
  const bundle = new Bundle()

  bundle.id = 'my-bundle'

  bundle
    .write('/foo.js', 'foo', { main: true })
    .write('/bar.js', 'bar', { alias: 'bar' })
    .write('/baz', 'baz', { executable: true })

  t.is(bundle.id, 'my-bundle')
  t.is(bundle.version, 0)
  t.is(bundle.main, '/foo.js')
  t.is(bundle.mode('/baz'), 0o755)

  t.alike(bundle.read('/foo.js'), Buffer.from('foo'))
  t.alike(bundle.read('/bar.js'), Buffer.from('bar'))

  t.alike([...bundle.keys()], ['/foo.js', '/bar.js', '/baz'])

  const copy = Bundle.from(bundle.toBuffer())

  t.alike(bundle, copy)

  t.is(copy.mode('/baz'), 0o755)
})

test('mount', (t) => {
  const bundle = new Bundle()

  bundle.write('/foo.js', 'foo').write('/bar.js', 'bar').write('/baz.txt', 'baz', { asset: true })

  bundle.imports = {
    bar: '/bar.js'
  }

  bundle.resolutions = {
    '/bar.js': {
      foo: '/foo.js'
    }
  }

  const mounted = bundle.mount(new URL('file:///dir/'))

  t.alike(
    [...mounted],
    [
      ['file:///dir/foo.js', Buffer.from('foo'), 0o644],
      ['file:///dir/bar.js', Buffer.from('bar'), 0o644],
      ['file:///dir/baz.txt', Buffer.from('baz'), 0o644]
    ]
  )

  t.alike(mounted.imports, {
    bar: 'file:///dir/bar.js'
  })

  t.alike(mounted.resolutions, {
    'file:///dir/bar.js': {
      foo: 'file:///dir/foo.js'
    }
  })

  t.alike(mounted.assets, ['file:///dir/baz.txt'])
})

test('unmount', (t) => {
  const bundle = new Bundle()

  bundle.write('/foo.js', 'foo').write('/bar.js', 'bar').write('/baz.txt', 'baz', { asset: true })

  bundle.imports = {
    bar: '/bar.js'
  }

  bundle.resolutions = {
    '/bar.js': {
      foo: '/foo.js'
    }
  }

  const mounted = bundle.mount(new URL('file:///dir/'))

  t.alike(bundle, mounted.unmount(new URL('file:///dir/')))
})

test('mount records the root', (t) => {
  const bundle = new Bundle().write('/foo.js', 'foo')

  t.is(bundle.root, null, 'a bundle that was never mounted has no root')

  const mounted = bundle.mount(new URL('file:///dir/'))

  t.is(mounted.root, 'file:///dir/')
  t.is(mounted.mount('file:///other/').root, 'file:///other/', 'a string root is kept as given')
  t.is(mounted.unmount(new URL('file:///dir/')).root, null, 'unmounting gives up the root')
})

test('mount keeps a file from outside the root', (t) => {
  const bundle = new Bundle()
    .write('/foo.js', 'foo', { main: true })
    .write('/../outside.js', 'outside')

  const mounted = bundle.mount('file:///dir/')

  // Reaching a module outside the root is how a bundle unmounted from outside
  // it round trips, so the key is kept rather than turned down.
  t.alike(Object.keys(mounted.files), ['file:///dir/foo.js', 'file:///outside.js'])
  t.alike(bundle, mounted.unmount('file:///dir/'), 'and it round trips')
})

test('mount refuses two files landing on one path', (t) => {
  const bundle = new Bundle().write('/foo.js', 'a').write('/../dir/foo.js', 'b')

  // Both land on file:///dir/foo.js, and the second would take the first's
  // place without either saying so.
  t.exception(() => bundle.mount('file:///dir/'), /DUPLICATE_FILE/)

  t.execution(() => bundle.mount('file:///other/'), 'they are distinct under another root')
})

test('mount, resolutions map', (t) => {
  const bundle = new Bundle()

  bundle.write('/foo.js', 'foo').write('/bar.txt', 'bar', { asset: true })

  bundle.resolutions = {
    '/foo.js': {
      bar: {
        asset: '/bar.txt'
      }
    }
  }

  const mounted = bundle.mount(new URL('file:///dir/'), {
    conditions: {
      asset: new URL('file:///assets/')
    }
  })

  t.alike(mounted.resolutions, {
    'file:///dir/foo.js': {
      bar: {
        asset: 'file:///assets/bar.txt'
      }
    }
  })
})

test('iterate', (t) => {
  const bundle = new Bundle()

  bundle.write('/foo.js', 'foo').write('/bar.js', 'bar', { mode: 0o655 })

  t.alike(
    [...bundle],
    [
      ['/foo.js', Buffer.from('foo'), 0o644],
      ['/bar.js', Buffer.from('bar'), 0o655]
    ]
  )
})

test('hashbang', (t) => {
  const bundle = new Bundle()

  const buffer = bundle.write('/foo.js', 'foo').toBuffer()

  const parsed = Bundle.from(Buffer.concat([Buffer.from('#!hashbang\n'), buffer]))

  t.alike(bundle, parsed)
})

test('reproducible buffers', (t) => {
  const a = new Bundle()
  a.write('/foo.js', 'foo').write('/bar.js', 'bar')
  a.resolutions = {
    '/foo.js': {
      a: {
        f: '/f',
        e: '/e'
      },
      b: '/b'
    },
    '/bar.js': {
      c: '/c',
      d: '/d'
    }
  }

  const b = new Bundle()
  b.write('/bar.js', 'bar').write('/foo.js', 'foo')
  b.resolutions = {
    '/bar.js': {
      d: '/d',
      c: '/c'
    },
    '/foo.js': {
      b: '/b',
      a: {
        f: '/f',
        e: '/e'
      }
    }
  }

  t.alike(a.toBuffer(), b.toBuffer())
})

test('invalid bundle header', (t) => {
  try {
    Bundle.from(Buffer.from('16This is not JSON'))
    t.fail()
  } catch (err) {
    t.comment(err.message)
    t.comment(err.cause.message)
  }
})
