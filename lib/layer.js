const { pathToRegexp, compile, parse } = require('path-to-regexp');
const { parse: parseUrl, format: formatUrl } = require('url');

module.exports = Layer;

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
 * @returns {Layer}
 * @private
 */

function Layer(path, methods, middleware, options) {
  this.opts = options || {};
  this.name = this.opts.name || null;
  this.methods = [];
  this.paramNames = [];
  this.stack = Array.isArray(middleware) ? middleware : [middleware];

  for (const method of methods) {
    const l = this.methods.push(method.toUpperCase());
    if (this.methods[l - 1] === 'GET') this.methods.unshift('HEAD');
  }

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
  this.regexp = pathToRegexp(path, this.paramNames, this.opts);
}

/**
 * Returns whether request `path` matches route.
 *
 * @param {String} path
 * @returns {Boolean}
 * @private
 */

Layer.prototype.match = function (path) {
  return this.regexp.test(path);
};

/**
 * Returns map of URL parameters for given `path` and `paramNames`.
 *
 * @param {String} path
 * @param {Array.<String>} captures
 * @param {Object=} existingParams
 * @returns {Object}
 * @private
 */

Layer.prototype.params = function (path, captures, existingParameters) {
  const parameters = existingParameters || {};

  for (let { length } = captures, i = 0; i < length; i++) {
    if (this.paramNames[i]) {
      const c = captures[i];
      parameters[this.paramNames[i].name] = c ? safeDecodeURIComponent(c) : c;
    }
  }

  return parameters;
};

/**
 * Returns array of regexp url path captures.
 *
 * @param {String} path
 * @returns {Array.<String>}
 * @private
 */

Layer.prototype.captures = function (path) {
  return this.opts.ignoreCaptures ? [] : path.match(this.regexp).slice(1);
};

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

Layer.prototype.url = function (parameters, options) {
  let args = parameters;
  const url = this.path.replace(/\(\.\*\)/g, '');

  if (typeof parameters !== 'object') {
    args = Array.prototype.slice.call(arguments);
    if (typeof args[args.length - 1] === 'object') {
      options = args[args.length - 1];
      args = args.slice(0, -1);
    }
  }

  const toPath = compile(url, options);
  let replaced;

  const tokens = parse(url);
  let replace = {};

  if (Array.isArray(args)) {
    for (let { length } = tokens, i = 0, j = 0; i < length; i++) {
      if (tokens[i].name) replace[tokens[i].name] = args[j++];
    }
  } else if (tokens.some((token) => token.name)) {
    replace = parameters;
  } else if (!options) {
    options = parameters;
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
};

/**
 * Run validations on route named parameters.
 *
 * @example
 *
 * ```javascript
 * router
 *   .param('user', function (id, ctx, next) {
 *     ctx.user = users[id];
 *     if (!user) return ctx.status = 404;
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

Layer.prototype.param = function (parameter, fn) {
  const { stack } = this;
  const parameters = this.paramNames;
  const middleware = function (ctx, next) {
    return fn.call(this, ctx.params[parameter], ctx, next);
  };

  middleware.param = parameter;

  const names = parameters.map(function (p) {
    return p.name;
  });

  const x = names.indexOf(parameter);
  if (x > -1) {
    // iterate through the stack, to figure out where to place the handler fn
    stack.some(function (fn, i) {
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
};

/**
 * Prefix route path.
 *
 * @param {String} prefix
 * @returns {Layer}
 * @private
 */

Layer.prototype.setPrefix = function (prefix) {
  if (this.path) {
    this.path =
      this.path !== '/' || this.opts.strict === true
        ? `${prefix}${this.path}`
        : prefix;
    this.paramNames = [];
    this.regexp = pathToRegexp(this.path, this.paramNames, this.opts);
  }

  return this;
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
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
