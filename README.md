# koa-router

[![NPM version](https://img.shields.io/npm/v/@koa/router.svg?style=flat-square)](https://npmjs.org/package/@koa/router) [![NPM Downloads](https://img.shields.io/npm/dm/@koa/router.svg?style=flat-square)](https://npmjs.org/package/@koa/router) [![Node.js Version](https://img.shields.io/node/v/@koa/router.svg?style=flat-square)](http://nodejs.org/download) [![Build Status](https://img.shields.io/travis/koajs/koa-router.svg?style=flat-square)](http://travis-ci.org/koajs/koa-router) [![Backers](https://img.shields.io/opencollective/backers/koajs.svg?style=flat-square)](https://github.com/koajs/koa#backers) [![Sponsors](https://img.shields.io/opencollective/sponsors/koajs.svg?style=flat-square)](https://github.com/koajs/koa#sponsors) [![Gitter Chat](https://img.shields.io/badge/gitter-join%20chat-1dce73.svg?style=flat-square)](https://gitter.im/koajs/koa-router)

## Call for Maintainers

This module is forked from the original [koa-router](https://github.com/ZijianHe/koa-router) due to its lack of activity. `koa-router` is the most widely used router module in the Koa community and we need maintainers. If you're interested in fixing bugs or implementing new features feel free to open a pull request. We'll be adding active contributors as collaborators.

Thanks to @alexmingoia and all the original contributors for their great work.

> Router middleware for [koa](https://github.com/koajs/koa)

- Express-style routing using `app.get`, `app.put`, `app.post`, etc.
- Named URL parameters.
- Named routes with URL generation.
- Responds to `OPTIONS` requests with allowed methods.
- Support for `405 Method Not Allowed` and `501 Not Implemented`.
- Multiple route middleware.
- Multiple routers.
- Nestable routers.
- ES7 async/await support.

## Migrating to 7 / Koa 2

- The API has changed to match the new promise-based middleware signature of koa 2. See the [koa 2.x readme](https://github.com/koajs/koa) for more information.
- Middleware is now always run in the order declared by `.use()` (or `.get()`, etc.), which matches Express 4 API.

## Installation

Install using [npm](https://www.npmjs.org/):

```sh
npm install @koa/router
```

## [API Reference](./API.md)

## Contributing

Please submit all issues and pull requests to the [koajs/koa-router](http://github.com/koajs/koa-router) repository!

## Tests

Run tests using `npm test`.

## Support

If you have any problem or suggestion please open an issue [here](https://github.com/koajs/koa-router/issues).
