var assert  = require("assert");
var moment  = require("moment");
var nock    = require("nock");

var es = require("../lib/elasticsearch");

const today = moment();
const yesterday = moment().subtract(1, "days");
const lastMonth = moment().subtract(1, "month");
const format = (m) => m.format("YYYY.MM.DD");

describe("elasticsearch", () => {
  describe("get_indices", () => {
    it("should return a list of indices", (done) => {
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, {index1: [], index2: [], ".kibana-4": []});
      const expected = ["index1", "index2"];
      es.get_indices().then((indices) => {
        assert.deepEqual(indices, expected);
        fakeES.done();
        done();
      }).catch(done);
    });
  });

  describe("clear_old_indices", () => {
    it("should make delete requests for all old indices", (done) => {
      const expected = {};
      expected[`logs-${format(today)}`] = [];
      expected[`logs-${format(yesterday)}`] = [];
      expected[`logs-${format(lastMonth)}`] = [];
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, expected)
        .delete(`/logs-${format(lastMonth)}`)
        .reply(200, {});
      es.clear_old_indices().then((indices) => {
        assert.deepEqual(indices, [`logs-${format(lastMonth)}`]);
        fakeES.done();
        done();
      }).catch(done);
    });
  });

  describe("update_aliases", () => {
    it("should make one command to put aliases to the right state", (done) => {
      const current = {};
      current[`logs-${format(yesterday)}`] = {aliases: {last_2days: {}}};
      current[`logs-${format(lastMonth)}`] = {aliases: {last_2days: {}}};

      const expected = {};
      expected[`logs-${format(yesterday)}`] = {aliases: {last_2days: {}}};
      expected[`logs-${format(today)}`] = {aliases: {last_2days: {}}};

      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/_aliases")
        .reply(200, current)
        .post("/_aliases",
              {actions: [
                {remove: {index: `logs-${format(lastMonth)}`, alias: "last_2days"}},
                {add: {index: `logs-${format(today)}`, alias: "last_2days"}},
              ],
              })
        .reply(200)
        .get("/_aliases")
        .reply(200, expected);
      es.update_aliases().then((aliases) => {
        assert.deepEqual(aliases,
                         {last_2days: [`logs-${format(yesterday)}`, `logs-${format(today)}`]});
        fakeES.done();
        done();
      }).catch(done);
    });
  });
});
