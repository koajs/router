const { debuglog } = require('util');
const methods = require('methods');

const debug = debuglog('koa-router');

/**
 * Group is a syntax-sugar to define route api in a more compact way.
 *
 * It's inspired by
 * [Javalin handler groups](https://javalin.io/documentation#handler-groups).
 *
 * Motivation:
 *
 * When building a small or midsized REST API one could end up with something
 * like this:
 * const router = new Router();
 * router.post("/login", loginRequest);
 * router.post("/signup", signupRequest);
 * router.get("/user/:userId/accounts", ifAuthenticated, listAccountsRequest);
 * router.get("/user/:userId/accounts/:accountId", ifAuthenticated, findAccountRequest);
 * router.post("/user/:userId/accounts", ifAuthenticated, ifAllowed, insertAccountRequest);
 * router.put("/user/:userId/accounts/:accountId", ifAuthenticated, updateAccountRequest);
 * router.del("/user/:userId/accounts/:accountId", ifAuthenticated, ifAllowed, delAccountRequest);
 * router.get("/user/:userId/accounts/:accountId/transactions", ifAuthenticated, listTransactionsRequest);
 *
 * This is hard to read and somewhat repetitive
 *
 * Using `Router.Group()` that burden can be reduced to this idiom:
 *
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
 *
 * In this example is sampled a few degree of freedom that Group intend to offer
 * yet still delivering the same routing seen in the first example.
 *
 * @returns Group instance
 *
 * @author sombriks
 */
function Group() {
  if (!(this instanceof Group)) return new Group();
  this.currentElement = createPathElement(null, '', null);
}

exports.Group = Group;

/**
 * Installing the path leaves for every http verb recognized by node.
 *
 */
for (const method of methods) {
  Group.prototype[method] = function (uri, ...middlewares) {
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
 * The path function starts a group of routes. The uri will be compounded with
 * eventual other paths and then be used in `build()` function to create a real
 * koa router
 *
 * @param uri the path to be used by verbs under this path. defaults to empty
 * string when omitted
 *
 * @param middlewares the middlewares array to pass to the verbs under this path
 * and the build handler as the last of them
 *
 * @returns
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
    handler(this);
    this.end();
  }

  return this;
};

/**
 * Ends the edition of the current group path.
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
  const router = new Router();
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
 * helper function to assemble the full featured path for this route.
 *
 * TODO too much optimistic.
 *
 * @param element
 * @param op
 * @returns {string}
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
 * helper to create pathElements
 *
 * @param currentElement current level, may be null
 * @param uri uri for this level. must be provided
 * @param middlewares middleware array, may be null
 * @returns {{middlewares, children: *[], visited: boolean, parentElement, uri}}
 */
function createPathElement(currentElement, uri, middlewares) {
  const pathElement = {
    visited: false,
    parentElement: currentElement,
    children: [],
    uri,
    middlewares
  };
  for (const method of methods) {
    pathElement[method] = [];
  }

  return pathElement;
}
