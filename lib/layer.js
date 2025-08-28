const { parse: parseUrl, format: formatUrl } = require('node:url');

const { pathToRegexp, compile, parse } = require('path-to-regexp');

module.exports = class Layer {
  /**
   * Initialize a new routing Layer with given `method`, `path`, and `middleware`.
   *
   * @param {String|RegExp} path Path string or regular expression.
   * @param {Array} methods Array of HTTP verbs.
   * @param {Array} middleware Layer callback/middleware or series of.
   * @param {Object=} opts
   * @param {String=} opts.name route name
   * @param {String=} opts.sensitive case sensitive (default: false)
   * @param {String=} opts.strict require the trailing slash (default: false)
   * @param {Boolean=} opts.pathAsRegExp if true, treat `path` as a regular expression
   * @returns {Layer}
   * @private
   */
  constructor(path, methods, middleware, opts = {}) {
    this.opts = opts;
    this.name = this.opts.name || null;
    this.methods = [];
    for (const method of methods) {
      const l = this.methods.push(method.toUpperCase());
      if (this.methods[l - 1] === 'GET') this.methods.unshift('HEAD');
    }

    this.stack = Array.isArray(middleware) ? middleware : [middleware];
    // ensure middleware is a function
    for (let i = 0; i < this.stack.length; i++) {
      const fn = this.stack[i];
      const type = typeof fn;
      if (type !== 'function')
        throw new Error(
          `${methods.toString()} \`${
            this.opts.name || path
          }\`: \`middleware\` must be a function, not \`${type}\``
        );
    }

    this.path = path;
    this.paramNames = [];

    if (this.opts.pathAsRegExp === true) {
      this.regexp = new RegExp(path);
    } else if (this.path) {
      if ('strict' in this.opts) {
        // path-to-regexp renamed strict to trailing in v8.1.0
        this.opts.trailing = this.opts.strict !== true;
      }

      const { regexp, keys } = pathToRegexp(this.path, this.opts);
      this.regexp = regexp;
      this.paramNames = keys;
    }
  }

  /**
   * Returns whether request `path` matches route.
   *
   * @param {String} path
   * @returns {Boolean}
   * @private
   */
  match(path) {
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   *
   * @param {String} path
   * @param {Array.<String>} captures
   * @param {Object=} params
   * @returns {Object}
   * @private
   */
  params(path, captures, params = {}) {
    for (let len = captures.length, i = 0; i < len; i++) {
      if (this.paramNames[i]) {
        const c = captures[i];
        if (c && c.length > 0)
          params[this.paramNames[i].name] = c ? safeDecodeURIComponent(c) : c;
      }
    }

    return params;
  }

  /**
   * Returns array of regexp url path captures.
   *
   * @param {String} path
   * @returns {Array.<String>}
   * @private
   */
  captures(path) {
    return this.opts.ignoreCaptures ? [] : path.match(this.regexp).slice(1);
  }

  /**
   * Generate URL for route using given `params`.
   *
   * @example
   *
   * ```javascript
   * const route = new Layer('/users/:id', ['GET'], fn);
   *
   * route.url({ id: 123 }); // => "/users/123"
   * ```
   *
   * @param {Object} params url parameters
   * @returns {String}
   * @private
   */
  url(params, options) {
    let args = params;
    const url = this.path.replace(/\(\.\*\)/g, '');

    if (typeof params !== 'object') {
      args = Array.prototype.slice.call(arguments);
      if (typeof args[args.length - 1] === 'object') {
        options = args[args.length - 1];
        args = args.slice(0, -1);
      }
    }

    const toPath = compile(url, { encode: encodeURIComponent, ...options });
    let replaced;
    const { tokens } = parse(url);
    let replace = {};

    if (Array.isArray(args)) {
      for (let len = tokens.length, i = 0, j = 0; i < len; i++) {
        if (tokens[i].name) {
          replace[tokens[i].name] = args[j++];
        }
      }
    } else if (tokens.some((token) => token.name)) {
      replace = params;
    } else if (!options) {
      options = params;
    }

    for (const [key, value] of Object.entries(replace)) {
      replace[key] = String(value);
    }

    replaced = toPath(replace);

    if (options && options.query) {
      replaced = parseUrl(replaced);
      if (typeof options.query === 'string') {
        replaced.search = options.query;
      } else {
        replaced.search = undefined;
        replaced.query = options.query;
      }

      return formatUrl(replaced);
    }

    return replaced;
  }

  /**
   * Run validations on route named parameters.
   *
   * @example
   *
   * ```javascript
   * router
   *   .param('user', function (id, ctx, next) {
   *     ctx.user = users[id];
   *     if (!ctx.user) return ctx.status = 404;
   *     next();
   *   })
   *   .get('/users/:user', function (ctx, next) {
   *     ctx.body = ctx.user;
   *   });
   * ```
   *
   * @param {String} param
   * @param {Function} middleware
   * @returns {Layer}
   * @private
   */
  param(param, fn) {
    const { stack } = this;
    const params = this.paramNames;
    const middleware = function (ctx, next) {
      return fn.call(this, ctx.params[param], ctx, next);
    };

    middleware.param = param;

    const names = params.map(function (p) {
      return p.name;
    });

    const x = names.indexOf(param);
    if (x > -1) {
      // iterate through the stack, to figure out where to place the handler fn
      stack.some((fn, i) => {
        // param handlers are always first, so when we find an fn w/o a param property, stop here
        // if the param handler at this part of the stack comes after the one we are adding, stop here
        if (!fn.param || names.indexOf(fn.param) > x) {
          // inject this param handler right before the current item
          stack.splice(i, 0, middleware);
          return true; // then break the loop
        }
      });
    }

    return this;
  }

  /**
   * Prefix route path.
   *
   * @param {String} prefix
   * @returns {Layer}
   * @private
   */
  setPrefix(prefix) {
    if (this.path) {
      this.path =
        this.path !== '/' || this.opts.strict === true
          ? `${prefix}${this.path}`
          : prefix;
      if (this.opts.pathAsRegExp === true || prefix instanceof RegExp) {
        this.regexp = new RegExp(this.path);
      } else if (this.path) {
        const { regexp, keys } = pathToRegexp(this.path, this.opts);
        this.regexp = regexp;
        this.paramNames = keys;
      }
    }

    return this;
  }
};

/**
 * Safe decodeURIComponent, won't throw any error.
 * If `decodeURIComponent` error happen, just return the original value.
 *
 * @param {String} text
 * @returns {String} URL decode original string.
 * @private
 */

function safeDecodeURIComponent(text) {
  try {
    // TODO: take a look on `safeDecodeURIComponent` if we use it only with route params let's remove the `replace` method otherwise make it flexible.
    // @link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/decodeURIComponent#decoding_query_parameters_from_a_url
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}
