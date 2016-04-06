const [, major] = process.version.match(/v(\d+)\.(\d+)\.(\d+)/);
if (+major < 5) {
  console.log("\x1b[31mWARNING: YOU SHOULD BE RUNNING THIS WITH NODE >= 5!! FOUND VERSION:", process.version, "\x1b[0m");
  process.exit(1);
}


var bee    = require('beeline');
var http   = require('http');
var config = require('./config');
var es     = require('./lib/elasticsearch')


var router = bee.route({
    "/static/`path...`": bee.staticDir(
        "./static/",
        {
            ".js": "application/javascript",
            ".html": "text/html",
            ".css": "text/css",
            ".xml": "text/xml"
        }
    )
});

// list the index stats as a json object
router.add({"/status/indices": function(req, res) {
    console.log("get indices");

    es.get_indices().then(function(indices) {
        var data = JSON.stringify(indices);
        res.writeHead(200, {
          'Content-Length': data.length,
          'Content-Type': 'application/json',
        });
        res.end(data);
    });
}});


if (require.main === module) {
    console.log(`Server listening on port ${config.PORT}`);
    console.log(`ES backend: ${config.ELASTICSEARCH_URL}`);
    http.createServer(router).listen(config.PORT);
}
