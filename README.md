# Media over QUIC

Media over QUIC (MoQ) is a live media delivery protocol utilizing QUIC streams.
See the [Warp draft](https://datatracker.ietf.org/doc/draft-lcurley-warp/).

This repository contains the source for [quic.video](https://quic.video).
It's split into a reusable Typescript library (`lib`) and the demo application (`web`).

You will also need to run a relay, such as [moq-rs](https://github.com/kixelated/moq-rs).

## Usage

### Library

The library is released periodically and available on NPM.
There's no documentation until the API settles down.

```bash
npm i -P @kixelated/moq
```

### Web

The website is published automatically on merge and available at [quic.video](https://quic.video).

## Development

### Setup

Install node dependencies using `npm`:

```bash
npm i
```

Parcel can generate TLS certificates but introduces some annoying TLS errors.
We use [mkcert](https://github.com/FiloSottile/mkcert) instead to generate a self-signed certificate.

```bash
brew install mkcert # see instructions for other platforms
npm run cert
```

### Serve

You can run a dev web server with:

```bash
npm run serve
```

Parcel sometimes does a poor job invalidating the cache; you might need to clear it:

```bash
npm run clean
```

## License

Licensed under either:

-   Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
-   MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)
