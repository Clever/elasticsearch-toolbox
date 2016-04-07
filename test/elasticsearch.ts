var assert  = require('assert');
var request = require('request');
var sinon   = require('sinon');

var es = require('../lib/elasticsearch');


describe('elasticsearch', function() {
    describe('get_indices', function() {
        before(function(done) {
            // mock the request.get call in `get_es`
            const es_data = {'indices':{ 'index1':[], 'index2':[], '.kibana-4':[]}};
            sinon.stub(request, 'get').yields(null, {statusCode: 200}, JSON.stringify(es_data));
            done();      
        });

        after(function(done) {
            request.get.restore();
            done();
        });
        
        it('should return a list of indices', function() {
            return es.get_indices().then(function(indices) {
                assert.deepEqual(indices, ['index1', 'index2']);
            });
        });

    });
});

