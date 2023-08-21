/**
 * Group is a syntax-sugar to define route api in a more compact way.
 *
 * It's inspired by
 * [Javlin handler groups](https://javalin.io/documentation#handler-groups).
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
 * const group = Router.Group()
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
 */
function Group() {
  return this;
}
