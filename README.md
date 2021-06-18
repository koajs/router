# [@koa/router](https://github.com/koajs/router)

> Router middleware for [Koa](https://github.com/koajs/koa). Maintained by [Forward Email][forward-email] and [Lad][].

[![build status](https://github.com/koajs/router/actions/workflows/ci.yml/badge.svg)](https://github.com/koajs/router/actions/workflows/ci.yml)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/koajs/router.svg)](LICENSE)


## Table of Contents

* [Features](#features)
* [Migrating to 7 / Koa 2](#migrating-to-7--koa-2)
* [Install](#install)
* [Typescript Support](#typescript-support)
* [API Reference](#api-reference)
* [Contributors](#contributors)
* [License](#license)


## Features

* Express-style routing (`app.get`, `app.put`, `app.post`, etc.)
* Named URL parameters
* Named routes with URL generation
* Match routes with specific host
* Responds to `OPTIONS` requests with allowed methods
* Support for `405 Method Not Allowed` and `501 Not Implemented`
* Multiple route middleware
* Multiple and nestable routers
* `async/await` support


## Migrating to 7 / Koa 2

* The API has changed to match the new promise-based middleware
  signature of koa 2. See the [koa 2.x readme](https://github.com/koajs/koa/tree/2.0.0-alpha.3) for more
  information.
* Middleware is now always run in the order declared by `.use()` (or `.get()`,
  etc.), which matches Express 4 API.


## Install

[npm][]:

```sh
npm install @koa/router
```


## Typescript Support

```sh
npm install @types/koa__router
```


## API Reference

See [API Reference](./API.md) for more documentation.


## Contributors

| Name             |
| ---------------- |
| **Alex Mingoia** |
| **@koajs**       |


## License

[MIT](LICENSE) © Alex Mingoia


##

[forward-email]: https://forwardemail.net

[lad]: https://lad.js.org

[npm]: https//www.npmjs.com
