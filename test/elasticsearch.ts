var assert  = require("assert");
var request = require("request");
var sinon   = require("sinon");

var es = require("../lib/elasticsearch");


describe("elasticsearch", () => {
  describe("get_indices", () => {
    before((done) => {
      // mock the request.get call in `get_es`
      const es_data = {indices: {index1: [], index2: [], ".kibana-4": []}};
      sinon.stub(request, "get").yields(null, {statusCode: 200}, JSON.stringify(es_data));
      done();
    });

    after((done) => {
      request.get.restore();
      done();
    });

    it("should return a list of indices", () => {
      const expected = ["index1", "index2"];
      es.get_indices().then((indices) => {
        assert.deepEqual(indices, expected);
      });
    });
  });
});
