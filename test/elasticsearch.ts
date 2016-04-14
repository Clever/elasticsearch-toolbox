var assert  = require("assert");
var moment  = require("moment");
var nock    = require("nock");

var es = require("../lib/elasticsearch");


describe("elasticsearch", () => {
  describe("get_indices", () => {
    it("should return a list of indices", (done) => {
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/_stats?level=shards")
        .reply(200, {indices: {index1: [], index2: [], ".kibana-4": []}});
      const expected = ["index1", "index2"];
      es.get_indices().then((indices) => {
        assert.deepEqual(indices, expected);
        fakeES.done();
        done();
      }).catch((err) => {
        done(err);
      });
    });
  });

  describe("clear_old_indices", () => {
    it("should make delete requests for all old indices", (done) => {
      const today = moment();
      const yesterday = today.subtract(1, "days");
      const lastMonth = today.subtract(1, "month");
      const format = (m) => m.format("YYYY.MM.DD");

      const expected = {indices: {}};
      expected.indices[`logs-${format(today)}`] = [];
      expected.indices[`logs-${format(yesterday)}`] = [];
      expected.indices[`logs-${format(lastMonth)}`] = [];
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/_stats?level=shards")
        .reply(200, expected)
        .delete(`/logs-${format(lastMonth)}`)
        .reply(200, {});
      es.clear_old_indices().then(() => {
        fakeES.done();
        done();
      }).catch((err) => {
        done(err);
      });
    });
  });
});
