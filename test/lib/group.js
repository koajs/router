/* eslint ava/no-import-test-files: 0 */
const expect = require('expect.js');
const { Group } = require('../../lib/group');
const Router = require('../../lib/router');

const {
  routeExpect,
  list,
  create,
  find,
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
} = require('./fixtures');

describe('Group', function () {
  it('Should build a router from a group', function (done) {
    try {
      const group = new Group();
      expect(group).to.be.ok();
      const router = group.build();
      expect(router).to.be.ok();
      done();
    } catch (err) {
      done(err);
    }
  });

  it('Should build a router from a group using alias under Router.Group', function (done) {
    try {
      const group = new Router.Group();
      expect(group).to.be.ok();
      const router = group.build();
      expect(router).to.be.ok();
      done();
    } catch (err) {
      done(err);
    }
  });

  it('Should build a router with a single get verb', function (done) {
    function foo() {}

    const router = new Router.Group().get('/hello', foo).build();

    expect(router).to.be.ok();
    expect(router.stack[0].path).to.eql('/hello');
    expect(router.stack[0].stack[0]).to.eql(foo);
    done();
  });

  it('Should build a router with a single path and a get verb', function (done) {
    function foo() {}

    const group = new Router.Group().path('/hello').get(foo).end();
    const router = group.build();

    expect(router).to.be.ok();
    expect(router.stack[0].path).to.eql('/hello');
    expect(router.stack[0].stack[0]).to.eql(foo);
    done();
  });

  it('Should build a router with a single path and a get verb, callback style', function (done) {
    function foo() {}

    const group = new Router.Group().path('/hello', (group) => {
      group.get(foo);
    });
    const router = group.build();

    expect(router).to.be.ok();
    expect(router.stack[0].path).to.eql('/hello');
    expect(router.stack[0].stack[0]).to.eql(foo);
    done();
  });

  it('should nest paths correctly', function (done) {
    const group = new Group().path('/users', (group) => {
      group.get(list);
      group.post(create);
      group.path('/:id', (group) => {
        group.get(find);
        group.put(update);
        group.delete(del);
      });
    });

    const router = group.build();

    expect(router).to.be.ok();
    expect(router.stack.map((layer) => layer.path)).to.contain('/users');
    expect(router.stack.map((layer) => layer.path)).to.contain('/users/:id');

    routeExpect(router, 'GET', '/users', list);
    routeExpect(router, 'POST', '/users', create);
    routeExpect(router, 'GET', '/users/:id', find);
    routeExpect(router, 'PUT', '/users/:id', update);
    routeExpect(router, 'DELETE', '/users/:id', del);

    done();
  });

  it('Should build complex apis', function (done) {
    const group = new Router.Group().path('/', (group) => {
      group.post('login', loginRequest);
      group.post('signup', signupRequest);
      group.path('user/:userId/accounts', ifAuthenticated, (group) => {
        group.get(listAccountsRequest);
        group.post(ifAllowed, insertAccountRequest);
        group.path('/:accountId', (group) => {
          group.get(findAccountRequest);
          group.put(updateAccountRequest);
          group.del(ifAllowed, delAccountRequest);
          group.get('/transactions', listTransactionsRequest);
        });
      });
    });
    // then we build our api definition into a router
    const router = group.build();
    // TODO more assertions
    routeExpect(router, 'POST', '/login', loginRequest);
    routeExpect(router, 'POST', '/signup', signupRequest);
    routeExpect(
      router,
      'GET',
      '/user/:userId/accounts',
      ifAuthenticated,
      listAccountsRequest
    );
    done();
  });

  it('should NOT support destructuring', function (done) {
    const group = new Router.Group();
    // would be nice, but it doesn't work
    try {
      group.path(({ path, get, post, put, del }) => {
        post('/login', loginRequest);
        post('/signup', signupRequest);
      });
    } finally {
      done();
    }
  });
});
