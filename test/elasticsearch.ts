var _ = require("lodash");
var assert = require("assert");
var moment = require("moment");
var nock = require("nock");

var es = require("../lib/elasticsearch");

const today = moment();
const yesterday = moment().subtract(1, "days");
const lastMonth = moment().subtract(1, "month");
const format = m => m.format("YYYY.MM.DD");

describe("elasticsearch", () => {
  describe("get_indices", () => {
    it("should return a list of indices", done => {
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, {index1: [], index2: [], ".kibana-4": []});
      const expected = [".kibana-4", "index1", "index2"];
      es
        .get_indices()
        .then(indices => {
          assert.deepEqual(indices, expected);
          fakeES.done();
          done();
        })
        .catch(done);
    });
  });

  describe("clear_old_indices", () => {
    it("should make delete requests for all old indices", done => {
      const returned_indices = {};
      returned_indices[".kibana-4"] = [];
      returned_indices["my-unmanaged-index"] = [];
      returned_indices[`logs-${format(today)}`] = [];
      returned_indices[`logs-${format(yesterday)}`] = [];
      returned_indices[`logs-${format(lastMonth)}`] = [];
      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, returned_indices)
        .delete(`/logs-${format(lastMonth)}`)
        .reply(200, {});
      es
        .clear_old_indices()
        .then(indices => {
          assert.deepEqual(indices, [`logs-${format(lastMonth)}`]);
          fakeES.done();
          done();
        })
        .catch(done);
    });

    it("should chunk up delete requests for all old indices", done => {
      const chunksize = 20;
      const totalindices = 110;
      const returned_indices = {};
      for (let i = 0; i < totalindices; i++) {
        const old_date = format(
          moment().subtract(1, "month").subtract(i, "days")
        );
        returned_indices[`logs-${old_date}`] = [];
      }

      const deleted_indices = _.chain(returned_indices)
        .keys()
        .sort()
        .chunk(chunksize)
        .map(arr => arr.join(","))
        .value();

      var fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, returned_indices);
      for (const i of deleted_indices) {
        fakeES = fakeES.delete(`/${i}`).reply(200, {});
      }

      es
        .clear_old_indices(chunksize)
        .then(indices => {
          assert.deepEqual(indices, deleted_indices);
          fakeES.done();
          done();
        })
        .catch(done);
    });
  });

  describe("update_aliases", () => {
    it("should make one command to put aliases to the right state", done => {
      const current = {};
      current[".kibana-4"] = {aliases: {}};
      current["my-unmanaged-index"] = {aliases: {}};
      current[`logs-${format(yesterday)}`] = {aliases: {last_2days: {}}};
      current[`logs-${format(lastMonth)}`] = {aliases: {last_2days: {}}};

      const expected = {};
      expected[`logs-${format(yesterday)}`] = {aliases: {last_2days: {}}};
      expected[`logs-${format(today)}`] = {aliases: {last_2days: {}}};

      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/_aliases")
        .reply(200, current)
        .post("/_aliases", {
          actions: [
            {remove: {index: `logs-${format(lastMonth)}`, alias: "last_2days"}},
            {add: {index: `logs-${format(today)}`, alias: "last_2days"}},
          ],
        })
        .reply(200)
        .get("/_aliases")
        .reply(200, expected);
      es
        .update_aliases()
        .then(aliases => {
          assert.deepEqual(aliases, {
            last_2days: [`logs-${format(yesterday)}`, `logs-${format(today)}`],
          });
          fakeES.done();
          done();
        })
        .catch(done);
    });
  });

  describe("update_replicas", () => {
    it("should make one command to put new index settings", done => {
      const replicas1 = {
        index: {
          number_of_shards: 4,
          number_of_replicas: 1,
        },
      };
      const current = {};
      current[`logs-${format(yesterday)}`] = {settings: replicas1};
      current[`logs-${format(today)}`] = {settings: replicas1};

      const replicas0 = {
        index: {
          number_of_shards: 4,
          number_of_replicas: 0,
        },
      };
      const adjusted = {};
      adjusted[`logs-${format(yesterday)}`] = {settings: replicas0};
      adjusted[`logs-${format(today)}`] = {settings: replicas1};

      const fakeES = nock(process.env.ELASTICSEARCH_URL)
        .get("/*/_settings")
        .reply(200, current)
        .put(`/logs-${format(yesterday)}/_settings`, {
          index: {number_of_replicas: 0},
        })
        .reply(200)
        .get("/*/_settings")
        .reply(200, adjusted);

      const expected = {};
      expected[`logs-${format(yesterday)}`] = {shards: 4, replicas: 0};
      expected[`logs-${format(today)}`] = {shards: 4, replicas: 1};
      es
        .update_replicas()
        .then(indices_data => {
          assert.deepEqual(indices_data, expected);
          fakeES.done();
          done();
        })
        .catch(done);
    });
  });
});
