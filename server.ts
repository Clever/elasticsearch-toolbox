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

// kayvee logger
const log = new kayvee.logger("elasticsearch-toolbox");

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
  log.infoD("clearing_indices_interval", {interval: config.indices.clearAt});
  const job = new cron.CronJob({
    cronTime: config.indices.clearAt,
    onTick: () => {
      es.clear_old_indices().then((indices) => {
        log.infoD("cleared_indices", {indices});
      }).catch((err) => {
        log.errorD("clear_indices_failure", {error: err, stack: err.stack});
      });
    },
    start: false,
  });
  job.start();
}

if (config.aliases && config.aliases.updateAt) {
  log.infoD("updating_aliases_interval", {interval: config.aliases.updateAt});
  const job = new cron.CronJob({
    cronTime: config.aliases.updateAt,
    onTick: () => {
      es.update_aliases().then((aliases) => {
        log.infoD("updated_aliases", {aliases});
      }).catch((err) => {
        log.errorD("update_aliases_failure", {error: err, stack: err.stack});
      });
    },
    start: false,
  });
  job.start();
}

if (config.replicas && config.replicas.updateAt) {
  log.infoD("updating_replicas_interval", {interval: config.replicas.updateAt});
  const job = new cron.CronJob({
    cronTime: config.replicas.updateAt,
    onTick: () => {
      es.update_replicas().then((replicas) => {
        log.infoD("updated_replicas", {replicas});
      }).catch((err) => {
        log.errorD("update_replicas_failure", {error: err, stack: err.stack});
      });
    },
    start: false,
  });
  job.start();
}

if (require.main === module) {
  app.listen(config.PORT, () => {
    log.infoD("server_listening", {port: config.PORT});
    log.infoD("ES_backend", {es_url: config.ELASTICSEARCH_URL});
  });
}
