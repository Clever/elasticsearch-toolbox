const [, major] = process.version.match(/v(\d+)\.(\d+)\.(\d+)/);
if (+major < 5) {
  console.log("\x1b[31mWARNING: YOU SHOULD BE RUNNING THIS WITH NODE >= 5!! FOUND VERSION:", process.version, "\x1b[0m");
  process.exit(1);
}


var cron    = require("cron");
var express = require("express");
var kayvee  = require("kayvee");

var config  = require("./config");
var es      = require("./lib/elasticsearch");


var app = express();
app.use(kayvee.middleware({source: "elasticsearch-toolbox"}));
app.use("/static", express.static("static"));

// elb check
app.get("/elb/check", (req, res) => {
  res.status(200).end();
});

// list the indicies as a json object
app.get("/status/indices", (req, res) => {
  es.get_index_shards().then((indices) => {
    res.status(200).send(indices);
  }).catch((err) => {
    res.status(500).send(err.message);
  });
});

// Delete all indexes older than a configured number of days
app.get("/indices/clear", (req, res) => {
  es.clear_old_indices().then((cleared_indices) => {
    res.status(200).send(cleared_indices);
  }).catch((err) => {
    res.status(500).send(err.message);
  });
});

// Update all time-based index aliases and return the new alias state
app.get("/aliases/update", (req, res) => {
  es.update_aliases().then((aliases) => {
    res.status(200).send(aliases);
  }).catch((err) => {
    res.status(500).send(err.message);
  });
});

// Update all time-based index replicas and return the new replica state
app.get("/replicas/update", (req, res) => {
  es.update_replicas().then((replicas) => {
    res.status(200).send(replicas);
  }).catch((err) => {
    res.status(500).send(err.message);
  });
});

if (config.indices.clearAt) {
  console.log(`clearing indexes at '${config.indices.clearAt}'`);
  const job = new cron.CronJob({
    cronTime: config.indices.clearAt,
    onTick: () => {
      es.clear_old_indices().then((indices) => {
        console.log("deleted indices", indices);
      }).catch((err) => {
        console.error("failure clearing old indices", err);
      });
    },
    start: false,
  });
  job.start();
}

if (config.aliases && config.aliases.updateAt) {
  console.log(`updating aliases at '${config.aliases.updateAt}'`);
  const job = new cron.CronJob({
    cronTime: config.aliases.updateAt,
    onTick: () => {
      es.update_aliases().then((aliases) => {
        console.log("set aliases to", aliases);
      }).catch((err) => {
        console.error("failure updating aliases", err);
      });
    },
    start: false,
  });
  job.start();
}

if (config.replicas && config.replicas.updateAt) {
  console.log(`updating replicas at '${config.replicas.updateAt}'`);
  const job = new cron.CronJob({
    cronTime: config.replicas.updateAt,
    onTick: () => {
      es.update_replicas().then((replicas) => {
        console.log("set replicas to", replicas);
      }).catch((err) => {
        console.error("failure updating replicas", err);
      });
    },
    start: false,
  });
  job.start();
}

if (require.main === module) {
  app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT}`);
    console.log(`ES backend: ${config.ELASTICSEARCH_URL}`);
  });
}
