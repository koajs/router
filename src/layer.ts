import { parse as parseUrl, format as formatUrl } from 'node:url';
import type {
  LayerOptions,
  RouterMiddleware,
  RouterParameterMiddleware,
  UrlOptions
} from './types';
import {
  compilePathToRegexp,
  compilePath,
  parsePath,
  normalizeLayerOptionsToPathToRegexp,
  type Key
} from './utils/path-to-regexp-wrapper';

/**
 * Safe decodeURIComponent, won't throw any error.
 * If `decodeURIComponent` error happen, just return the original value.
 *
 * Note: This function is used only for route/path parameters, not query parameters.
 * In URL path segments, `+` is a literal character (not a space), so we don't
 * replace `+` with spaces. For query parameters, use a different decoder that
 * handles `application/x-www-form-urlencoded` format.
 *
 * @param text - Text to decode
 * @returns URL decoded string
 * @private
 */
function safeDecodeURIComponent(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Extended middleware with param metadata
 */
interface ParameterMiddleware extends Function {
  param?: string;
  _originalFn?: RouterParameterMiddleware;
}

export default class Layer {
  opts: LayerOptions;
  name: string | undefined;
  methods: string[];
  paramNames: Key[];
  stack: (RouterMiddleware | ParameterMiddleware)[];
  path: string | RegExp;
  regexp!: RegExp;

  /**
   * Initialize a new routing Layer with given `method`, `path`, and `middleware`.
   *
   * @param path - Path string or regular expression
   * @param methods - Array of HTTP verbs
   * @param middleware - Layer callback/middleware or series of
   * @param opts - Layer options
   * @private
   */
  constructor(
    path: string | RegExp,
    methods: string[],
    middleware: RouterMiddleware<any, any> | RouterMiddleware<any, any>[],
    options: LayerOptions = {}
  ) {
    this.opts = options;
    this.name = this.opts.name || undefined;

    this.methods = this._normalizeHttpMethods(methods);

    this.stack = this._normalizeAndValidateMiddleware(
      middleware,
      methods,
      path
    );

    this.path = path;
    this.paramNames = [];
    this._configurePathMatching();
  }

  /**
   * Normalize HTTP methods and add automatic HEAD support for GET
   * @private
   */
  private _normalizeHttpMethods(methods: string[]): string[] {
    const normalizedMethods: string[] = [];

    for (const method of methods) {
      const upperMethod = method.toUpperCase();
      normalizedMethods.push(upperMethod);

      if (upperMethod === 'GET') {
        normalizedMethods.unshift('HEAD');
      }
    }

    return normalizedMethods;
  }

  /**
   * Normalize middleware to array and validate all are functions
   * @private
   */
  private _normalizeAndValidateMiddleware(
    middleware: RouterMiddleware | RouterMiddleware[],
    methods: string[],
    path: string | RegExp
  ): RouterMiddleware[] {
    const middlewareArray = Array.isArray(middleware)
      ? middleware
      : [middleware];

    for (const middlewareFunction of middlewareArray) {
      const middlewareType = typeof middlewareFunction;

      if (middlewareType !== 'function') {
        const routeIdentifier = this.opts.name || path;
        throw new Error(
          `${methods.toString()} \`${routeIdentifier}\`: \`middleware\` must be a function, not \`${middlewareType}\``
        );
      }
    }

    return middlewareArray;
  }

  /**
   * Configure path matching regexp and parameters
   * @private
   */
  private _configurePathMatching(): void {
    if (this.opts.pathAsRegExp === true) {
      this.regexp =
        this.path instanceof RegExp
          ? this.path
          : new RegExp(this.path as string);
    } else if (this.path) {
      this._configurePathToRegexp();
    }
  }

  /**
   * Configure path-to-regexp for string paths
   * @private
   */
  private _configurePathToRegexp(): void {
    const options = normalizeLayerOptionsToPathToRegexp(this.opts);
    const { regexp, keys } = compilePathToRegexp(this.path as string, options);
    this.regexp = regexp;
    this.paramNames = keys;
  }

  /**
   * Returns whether request `path` matches route.
   *
   * @param path - Request path
   * @returns Whether path matches
   * @private
   */
  match(path: string): boolean {
    return this.regexp.test(path);
  }

  /**
   * Returns map of URL parameters for given `path` and `paramNames`.
   *
   * @param _path - Request path (not used, kept for API compatibility)
   * @param captures - Captured values from regexp
   * @param existingParams - Existing params to merge with
   * @returns Parameter map
   * @private
   */
  params(
    _path: string,
    captures: string[],
    existingParameters: Record<string, string> = {}
  ): Record<string, string> {
    const parameterValues = { ...existingParameters };

    for (const [captureIndex, capturedValue] of captures.entries()) {
      const parameterDefinition = this.paramNames[captureIndex];

      if (parameterDefinition && capturedValue && capturedValue.length > 0) {
        const parameterName = parameterDefinition.name;
        parameterValues[parameterName] = safeDecodeURIComponent(capturedValue);
      }
    }

    return parameterValues;
  }

  /**
   * Returns array of regexp url path captures.
   *
   * @param path - Request path
   * @returns Array of captured values
   * @private
   */
  captures(path: string): string[] {
    if (this.opts.ignoreCaptures) {
      return [];
    }

    const match = path.match(this.regexp);
    return match ? match.slice(1) : [];
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
   * @param args - URL parameters (various formats supported)
   * @returns Generated URL
   * @private
   */
  url(...arguments_: any[]): string {
    const { params, options } = this._parseUrlArguments(arguments_);

    const cleanPath = (this.path as string).replaceAll('(.*)', '');

    const pathCompiler = compilePath(cleanPath, {
      encode: encodeURIComponent,
      ...options
    });

    const parameterReplacements = this._buildParamReplacements(
      params,
      cleanPath
    );

    const generatedUrl = pathCompiler(parameterReplacements);

    if (options && options.query) {
      return this._addQueryString(generatedUrl, options.query);
    }

    return generatedUrl;
  }

  /**
   * Parse url() arguments into params and options
   * Supports multiple call signatures:
   * - url({ id: 1 })
   * - url(1, 2, 3)
   * - url({ query: {...} })
   * - url({ id: 1 }, { query: {...} })
   * @private
   */
  private _parseUrlArguments(allArguments: any[]): {
    params: any;
    options?: UrlOptions;
  } {
    let parameters: any = allArguments[0];
    let options: UrlOptions | undefined = allArguments[1];

    if (typeof parameters !== 'object') {
      const argumentsList = [...allArguments];
      const lastArgument = argumentsList.at(-1);

      if (typeof lastArgument === 'object') {
        options = lastArgument;
        parameters = argumentsList.slice(0, -1);
      } else {
        parameters = argumentsList;
      }
    } else if (parameters && parameters.query && !options) {
      options = parameters;
      parameters = {};
    }

    return { params: parameters, options };
  }

  /**
   * Build parameter replacements for URL generation
   * @private
   */
  private _buildParamReplacements(
    parameters: any,
    cleanPath: string
  ): Record<string, string> {
    const { tokens } = parsePath(cleanPath);
    const hasNamedParameters = tokens.some(
      (token) => 'name' in token && token.name
    );
    const parameterReplacements: Record<string, string> = {};

    if (Array.isArray(parameters)) {
      let parameterIndex = 0;

      for (const token of tokens) {
        if ('name' in token && token.name) {
          parameterReplacements[token.name] = String(
            parameters[parameterIndex++]
          );
        }
      }
    } else if (
      hasNamedParameters &&
      typeof parameters === 'object' &&
      !parameters.query
    ) {
      for (const [parameterName, parameterValue] of Object.entries(
        parameters
      )) {
        parameterReplacements[parameterName] = String(parameterValue);
      }
    }

    return parameterReplacements;
  }

  /**
   * Add query string to URL
   * @private
   */
  private _addQueryString(
    baseUrl: string,
    query: Record<string, any> | string
  ): string {
    const parsedUrl: any = parseUrl(baseUrl);

    if (typeof query === 'string') {
      parsedUrl.search = query;
    } else {
      parsedUrl.search = undefined;
      parsedUrl.query = query;
    }

    return formatUrl(parsedUrl);
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
   * @param paramName - Parameter name
   * @param paramHandler - Middleware function
   * @returns This layer instance
   * @private
   */
  param(
    parameterName: string,
    parameterHandler: RouterParameterMiddleware
  ): Layer {
    const middlewareStack = this.stack;
    const routeParameterNames = this.paramNames;

    const parameterMiddleware = this._createParamMiddleware(
      parameterName,
      parameterHandler
    );

    const parameterNamesList = routeParameterNames.map(
      (parameterDefinition) => parameterDefinition.name
    );

    const parameterPosition = parameterNamesList.indexOf(parameterName);

    if (parameterPosition !== -1) {
      this._insertParamMiddleware(
        middlewareStack,
        parameterMiddleware,
        parameterNamesList,
        parameterPosition
      );
    }

    return this;
  }

  /**
   * Create param middleware with deduplication tracking
   * @private
   */
  private _createParamMiddleware(
    parameterName: string,
    parameterHandler: RouterParameterMiddleware
  ): ParameterMiddleware {
    const middleware: ParameterMiddleware = function (
      this: any,
      context: any,
      next: () => Promise<any>
    ) {
      if (!context._matchedParams) {
        context._matchedParams = new WeakMap();
      }

      if (context._matchedParams.has(parameterHandler)) {
        return next();
      }

      context._matchedParams.set(parameterHandler, true);

      return parameterHandler.call(
        this,
        context.params[parameterName],
        context,
        next
      );
    };

    middleware.param = parameterName;
    middleware._originalFn = parameterHandler;

    return middleware;
  }

  /**
   * Insert param middleware at the correct position in the stack
   * @private
   */
  private _insertParamMiddleware(
    middlewareStack: (RouterMiddleware | ParameterMiddleware)[],
    parameterMiddleware: ParameterMiddleware,
    parameterNamesList: string[],
    currentParameterPosition: number
  ): void {
    middlewareStack.some((existingMiddleware: any, stackIndex) => {
      if (!existingMiddleware.param) {
        middlewareStack.splice(stackIndex, 0, parameterMiddleware);
        return true;
      }

      const existingParameterPosition = parameterNamesList.indexOf(
        existingMiddleware.param
      );
      if (existingParameterPosition > currentParameterPosition) {
        middlewareStack.splice(stackIndex, 0, parameterMiddleware);
        return true;
      }

      return false;
    });
  }

  /**
   * Prefix route path.
   *
   * @param prefixPath - Prefix to prepend
   * @returns This layer instance
   * @private
   */
  setPrefix(prefixPath: string): Layer {
    if (!this.path) {
      return this;
    }

    if (this.path instanceof RegExp) {
      return this;
    }

    this.path = this._applyPrefix(prefixPath);

    this._reconfigurePathMatching(prefixPath);

    return this;
  }

  /**
   * Apply prefix to the current path
   * @private
   */
  private _applyPrefix(prefixPath: string): string {
    const isRootPath = this.path === '/';
    const isStrictMode = this.opts.strict === true;
    const prefixHasParameters = prefixPath.includes(':');
    const pathIsRawRegex =
      this.opts.pathAsRegExp === true && typeof this.path === 'string';

    if (prefixHasParameters && pathIsRawRegex) {
      const currentPath = this.path as string;
      if (
        currentPath === String.raw`(?:\/|$)` ||
        currentPath === String.raw`(?:\/|$)`
      ) {
        this.path = '{/*rest}';
        this.opts.pathAsRegExp = false;
      }
    }

    if (isRootPath && !isStrictMode) {
      return prefixPath;
    }

    return `${prefixPath}${this.path}`;
  }

  /**
   * Reconfigure path matching after prefix is applied
   * @private
   */
  private _reconfigurePathMatching(prefixPath: string): void {
    const treatAsRegExp = this.opts.pathAsRegExp === true;
    const prefixHasParameters = prefixPath && prefixPath.includes(':');

    if (prefixHasParameters && treatAsRegExp) {
      const options = normalizeLayerOptionsToPathToRegexp(this.opts);
      const { regexp, keys } = compilePathToRegexp(
        this.path as string,
        options
      );
      this.regexp = regexp;
      this.paramNames = keys;
      this.opts.pathAsRegExp = false;
    } else if (treatAsRegExp) {
      this.regexp =
        this.path instanceof RegExp
          ? this.path
          : new RegExp(this.path as string);
    } else {
      const options = normalizeLayerOptionsToPathToRegexp(this.opts);
      const { regexp, keys } = compilePathToRegexp(
        this.path as string,
        options
      );
      this.regexp = regexp;
      this.paramNames = keys;
    }
  }
}
