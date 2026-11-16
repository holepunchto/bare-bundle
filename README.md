# bare-bundle

Application bundle format for JavaScript, inspired by <https://github.com/electron/asar>.

```
npm i bare-bundle
```

## Format

```
[#!hashbang]
<header length><header><...files>
```

The header length is an integer literal denoting the total length of the header. The header itself is a JSON string literal of header length bytes and has the following format:

```js
{
  "version": 0,
  "id": null | "<string>",
  "main": null | "<url>",
  "imports": {
    "<from>": "<to>"
  },
  "resolutions": {
    "<url>": "<imports>"
  },
  "addons": ["<url>"],
  "assets": ["<url>"],
  "files": {
    "<url>": {
      "offset": number,
      "length": number,
      "mode": number,
      "type"?: "<type>"
    }
  }
}
```

For each `<url>` in `files`, `offset` provides the byte offset to the file **after** the header and `length` provides the byte length of the file.

The optional `type` records the module type the file is loaded as, using the names of the `type` import attribute: `script`, `module`, `json`, `text`, `binary`, `addon`, or `bundle`. When it is left out, the type is inferred when the file is loaded, as for a file outside a bundle.

The bundle may optionally be prefixed with a hashbang, `#!`, for use with script interpreters. The hashbang is ignored during parsing.

## API

See the [`bare-bundle` reference](https://docs.pears.com/reference/bare/modules/bare-bundle).

## License

Apache-2.0
