# @pearjs/bundle

Application bundle format for :pear:.js, inspired by <https://github.com/electron/asar>.

```
npm i @pearjs/bundle
```

## Format

```
<header length><header><...files>
```

The header length is a 32-bit unsigned integer denoting the total length of the header. The header itself is a JSON string of header length bytes and has the following format:

```js
{
  "version": 0,
  "main": "<path>" | null,
  "files": {
    "<path>": {
      "offset": number,
      "length": number
    }
  }
}
```

For each `<path>` in `files`, `offset` provides the byte offset to the file **after** the header and `length` provides the byte length of the file.

## License

MIT
