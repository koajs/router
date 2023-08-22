/**
 * Group tests
 */
const expect = require('expect.js');
const { Group } = require('../../lib/group');
const Router = require('../../lib/router');

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
});
