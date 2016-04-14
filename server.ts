const [, major] = process.version.match(/v(\d+)\.(\d+)\.(\d+)/);
if (+major < 5) {
  console.log("\x1b[31mWARNING: YOU SHOULD BE RUNNING THIS WITH NODE >= 5!! FOUND VERSION:", process.version, "\x1b[0m");
  process.exit(1);
}


var express = require("express");

var config  = require("./config");
var es      = require("./lib/elasticsearch");


var app = express();
app.use("/static", express.static("static"));

// list the index stats as a json object
app.get("/status/indices", (req, res) => {
  es.get_indices().then((indices) => {
    res.status(200).send(indices);
  }).catch((data) => {
    res.status(500).send(data);
  });
});

app.get("/indices/clear", (req, res) => {
  es.clear_old_indices().then((cleared_indices) => {
    console.log("cleared", cleared_indices);
    res.status(200).send(cleared_indices);
  }).catch((err) => {
    res.status(500).send(err.message);
  });
});


if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT}`);
    console.log(`ES backend: ${config.ELASTICSEARCH_URL}`);
  });
}
