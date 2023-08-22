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
 * const group = new Router.Group()
 *  .path("/")
 *    .post("login", loginRequest)
 *    .post("/signup", signupRequest)
 *  .end()
 *  .path("/user/:userId", ifAuthenticated)
 *    .get("accounts, listAccountsRequest)
 *    .path("accounts")
 *      .get(":accountId", findAccountRequest)
 *      .post(ifAllowed, insertAccountRequest)
 *      .put(":accountId", updateAccountRequest)
 *      .path(":accountId", ifAllowed)
 *        .del("", delAccountRequest)
 *      .end()
 *      .path(":accountId/transactions")
 *        .get(listTransactionsRequest)
 *      .end()
 *    .end()
 *  .end()
 *
 * // then we build our api definition into a router
 * const router = group.build()
 *
 * In this example is sampled a few degree of freedom that Group intend to offer
 * yet still delivering the same routing seen in the first example.
 *
 * @returns Group instance
 */
function Group() {
  if (!(this instanceof Group)) return new Group();
  this.currentElement = null;
}

exports.Group = Group;

/**
 * The path function starts a group of routes. The uri will be compounded with
 * eventual other paths and then be used in `build()` function to create a real
 * koa router
 *
 * @param uri the path to be used by verbs under this path. defaults to empty
 * string when omitted
 *
 * @param middlewares the middlewares array to pass to the verbs under this path
 *
 * @returns
 */
Group.prototype.path = function path(uri = '', ...middlewares) {
  if (uri instanceof Function) {
    middlewares = [uri, ...middlewares];
    uri = '';
  }

  const pathElement = {
    visited: false,
    parentElement: this.currentElement,
    gets: [],
    posts: [],
    puts: [],
    patches: [],
    deletes: [],
    options: [],
    heads: [],
    children: [],
    uri,
    middlewares
  };
  if (this.currentElement) this.currentElement.children.push(pathElement);
  this.currentElement = pathElement;
  return this;
};

/**
 * Ends the edition of the current group path.
 */
Group.prototype.end = function end() {
  if (this.currentElement)
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
    // all verbs on this current level
    drain('gets', 'get', router, element);
    // then drain children
    const child = element.children.pop();
    if (child) {
      element = child;
    } else element.visited = true;
  }

  return router;
};

function drain(list, verb, router, element) {
  let op = element[list].pop();
  while (op) {
    router[verb](
      mountUri(element, op),
      ...element.middlewares,
      ...op.middlewares
    );
    op = element[list].pop();
  }
}

function mountUri(element, op) {
  let path = op.uri;
  let current = element;
  while (current) {
    const separator =
      !current.uri.endsWith('/') && !path.startsWith('/') ? '/' : '';
    path = current.uri + separator + path;
    current = current.parentElement;
  }

  return path;
}
