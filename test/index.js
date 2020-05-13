/**
 * Module tests
 */

const koa = require('koa');
const should = require('should');

describe('module', function() {
  it('should expose Router', function(done) {
    const Router = require('..');
    should.exist(Router);
    Router.should.be.type('function');
    done();
  });
});
