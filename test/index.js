/**
 * Module tests
 */

const should = require('should');

describe('module', () => {
  it('should expose Router', done => {
    const Router = require('..');
    should.exist(Router);
    Router.should.be.type('function');
    done();
  });
});
