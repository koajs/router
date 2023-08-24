const { debuglog } = require('util');
const methods = require('methods');

const debug = debuglog('koa-router');

/**
 * Group is a syntax-sugar builder to define route api in a more readable way.
 *
 * It's inspired by
 * [Javalin handler groups](https://javalin.io/documentation#handler-groups).
 *
 * When building a small or midsized REST API one could end up with something
 * like this:
 * ```javascript
 * const router = new Router();
 * router.post("/login", loginRequest);
 * router.post("/signup", signupRequest);
 * router.get("/user/:userId/accounts", ifAuthenticated, listAccountsRequest);
 * router.get("/user/:userId/accounts/:accountId", ifAuthenticated, findAccountRequest);
 * router.post("/user/:userId/accounts", ifAuthenticated, ifAllowed, insertAccountRequest);
 * router.put("/user/:userId/accounts/:accountId", ifAuthenticated, updateAccountRequest);
 * router.del("/user/:userId/accounts/:accountId", ifAuthenticated, ifAllowed, delAccountRequest);
 * router.get("/user/:userId/accounts/:accountId/transactions", ifAuthenticated, listTransactionsRequest);
 * ```
 * This is hard to read and somewhat repetitive
 *
 * Using `Router.Group()` that burden can be reduced to this idiom:
 *
 * ```javascript
 * const group = new Router.Group().path("/", group => {
 *   group.post("login", loginRequest)
 *   group.post("signup", signupRequest)
 *   group.path("user/:userId/accounts", ifAuthenticated, group => {
 *     group.get(listAccountsRequest)
 *     group.post(ifAllowed, insertAccountRequest)
 *     group.path("/:accountId", group => {
 *       group.get(findAccountRequest)
 *       group.put(updateAccountRequest)
 *       group.del(ifAllowed, delAccountRequest)
 *       group.get("/transactions",listTransactionsRequest)
 *     })
 *   })
 * })
 * // then we build our api definition into a router
 * const router = group.build()
 * ```
 *
 * Note that each builder is a one-time shot, once `build()` is called, internal
 * state is consumed and router receives the proper combination of paths, verbs
 * and middlewares.
 *
 * @param options.router if provided, the router to apply the group building
 * @return {Group} the builder for further path group configuration
 *
 * @constructor
 */
function Group(options) {
  if (!(this instanceof Group)) return new Group();
  const { router } = options ? options : {};
  this.currentElement = createPathElement(null, '', null);
  this.router = router;
}

exports.Group = Group;

/**
 * This helper install the path leaves for every http verb recognized by node.
 *
 * @private
 */
for (const method of methods) {
  Group.prototype[method] = function (uri, ...middlewares) {
    if (!(this instanceof Group))
      throw new Error("don't destructure the builder");

    if (uri instanceof Function) {
      middlewares = [uri, ...middlewares];
      uri = '';
    }

    debug('preparing method %s on uri %s', method, uri);
    if (!this.currentElement) {
      this.currentElement = createPathElement(null, '', null);
    }

    this.currentElement[method].push({ uri, middlewares });
    return this;
  };
}

Group.prototype.del = Group.prototype.delete; // sugar for del

/**
 * The path function starts a group of routes. The uri will be computed with
 * eventual other paths and then be used in `build()` function to create a real
 * koa router.
 *
 * Path allows two styles of api building, chaining calls and last-parameter
 * callback:
 *
 * ```javascript
 * // chain calls style
 * const group = new Group()
 *  .path('/hello')
 *    .get(ctx => ctx.body = "hello!")
 *  .end();
 * ```
 *
 * ```javascript
 * // callback style
 * const group = new Router.Group().path('/hello', (group) => {
 *   group.get(ctx => ctx.body = "hello!");
 * });
 * ```
 *
 * Both styles will produce the same route configuration and one style does not
 * deny the use of the other.
 *
 * The small note here is that chain call style might get issues with your code
 * formatter so watch out for such scenarios.
 *
 * See the test suite for more scenarios and sample usage.
 *
 * @param uri the path to be used by verbs under this path. defaults to empty
 * string when omitted
 *
 * @param middlewares the middlewares array to pass to the verbs under this path
 * and the build handler as the last of them
 *
 * @returns Group
 */
Group.prototype.path = function path(uri = '', ...middlewares) {
  if (uri instanceof Function) {
    middlewares = [uri, ...middlewares];
    uri = '';
  }

  const handler = middlewares.pop();

  const pathElement = createPathElement(this.currentElement, uri, middlewares);

  if (this.currentElement) this.currentElement.children.push(pathElement);

  this.currentElement = pathElement;
  if (handler) {
    debug('handler found, going callback style for uri %s', uri);
    handler(this);
    this.end();
  }

  return this;
};

/**
 * Ends the edition of the current group path. It allows to walk back one path
 * step when building the group with the chain call style.
 *
 * @returns Group under configuration
 */
Group.prototype.end = function end() {
  if (this.currentElement && this.currentElement.parentElement)
    this.currentElement = this.currentElement.parentElement;
  return this;
};

/**
 * The build function gather all routes configured into this builder and digest
 * them into a regular koa router
 *
 * @returns {module:koa-router|Router}
 */
Group.prototype.build = function build() {
  const Router = require('./router');
  const router = this.router || new Router();
  let element = this.currentElement;
  while (element) {
    // check if already visited just to be sure
    if (element.visited) element = element.parentElement;
    if (!element) continue; // we're done
    // visit all verbs on this current level
    for (const method of methods) {
      drain(method, router, element);
    }

    // then drain children
    const child = element.children.pop();
    if (child) {
      element = child;
    } else element.visited = true;
  }

  return router;
};

/**
 * Helper to visit every verb on the builder and install it on the router
 *
 * @param verb current verb array to empty
 * @param router router under configuration
 * @param element current path level
 * @private
 */
function drain(verb, router, element) {
  let op = element[verb].pop();
  debug('installing path on router {}', op);
  while (op) {
    router[verb](
      mountUri(element, op),
      ...(element.middlewares || []),
      ...op.middlewares
    );
    op = element[verb].pop();
  }
}

/**
 * Helper function to assemble the full featured path for this route.
 *
 * TODO too much optimistic.
 *
 * @param element current path level
 * @param op current verb
 * @returns {string} the complete path ready to hand over to the router
 * @private
 */
function mountUri(element, op) {
  const path = [];
  let current = element;
  while (current) {
    path.unshift(current.uri);
    current = current.parentElement;
  }

  path.push(op.uri);
  return path.join('');
}

/**
 * Helper to create pathElements to store current level configuration
 *
 * @param currentElement current level, may be null
 * @param uri uri for this level. must be provided
 * @param middlewares middleware array, may be null
 * @returns {{middlewares, children: *[], visited: boolean, parentElement, uri}}
 * @private
 */
function createPathElement(currentElement, uri, middlewares) {
  const pathElement = {
    visited: false,
    parentElement: currentElement,
    children: [],
    middlewares,
    uri
  };
  debug('creating path element %', uri);
  for (const method of methods) {
    pathElement[method] = [];
  }

  return pathElement;
}
