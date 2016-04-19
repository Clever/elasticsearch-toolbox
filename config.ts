var fs   = require("fs");
var yaml = require("js-yaml");

const missing_vars = [];
const env_var_defaults = {
  PORT:                   8001,
  ELASTICSEARCH_URL:      null,
  ELASTICSEARCH_USER:     null,
  ELASTICSEARCH_PASSWORD: null,
};


// Set Environment variables
for (const key of Object.keys(env_var_defaults)) {
  const default_val = env_var_defaults[key];
  module.exports[key] = process.env[key];
  if (module.exports[key] == null) {
    module.exports[key] = default_val;
  }

  if (module.exports[key] == null) {
    missing_vars.push(key);
  }
}

// Fail for `null` variables
if (missing_vars.length > 0) {
  throw new Error(`Missing env variables: ${missing_vars.join(", ")}`);
}

// Get document, or throw exception on error
const conf = yaml.safeLoad(fs.readFileSync("./config.yml", "utf8"));

if (!conf.indices) {
  throw new Error("missing index configuration");
}
if (!conf.indices.prefix) {
  throw new Error("missing log prefix");
}
if (!conf.indices.days) {
  throw new Error("missing number of days to keep");
}

module.exports.indices = conf.indices;

if (conf.indices.aliases) {
  module.exports.aliases = {mappings: {}};
  for (const key of Object.keys(conf.indices.aliases)) {
    const val = conf.indices.aliases[key];
    if (key === "updateAt") {
      module.exports.aliases.updateAt = val;
    } else {
      module.exports.aliases.mappings[key] = val;
    }
  }
}

if (conf.indices.replicas) {
  module.exports.replicas = {};
  for (const key of Object.keys(conf.indices.replicas)) {
    module.exports.replicas[key] = conf.indices.replicas[key];
  }
}
