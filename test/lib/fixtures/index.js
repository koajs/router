/**
 * test fixtures
 */
const expect = require('expect.js');

module.exports = {
  routeExpect,
  list,
  find,
  create,
  update,
  del,
  loginRequest,
  signupRequest,
  ifAuthenticated,
  listAccountsRequest,
  ifAllowed,
  insertAccountRequest,
  findAccountRequest,
  updateAccountRequest,
  delAccountRequest,
  listTransactionsRequest
};

function routeExpect(router, verb, path, list) {
  expect(
    router.stack
      .filter((layer) => layer.path === path)
      .filter((layer) => layer.methods.includes(verb))
      .map((layer) => layer.stack)
      .flat(Number.POSITIVE_INFINITY)
  ).to.contain(list);
}

function list() {}

function find() {}

function create() {}

function update() {}

function del() {}

function loginRequest() {}

function signupRequest() {}

function ifAuthenticated() {}

function listAccountsRequest() {}

function ifAllowed() {}

function insertAccountRequest() {}

function findAccountRequest() {}

function updateAccountRequest() {}

function delAccountRequest() {}

function listTransactionsRequest() {}
