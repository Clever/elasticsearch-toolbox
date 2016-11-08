var _       = require("lodash");
var moment  = require("moment");
var request = require("request");

var config  = require("../config");

const auth = {
  user: config.ELASTICSEARCH_USER,
  pass: config.ELASTICSEARCH_PASSWORD,
  sendImmediately: false,
};

// Helper function to make ES queries. Pass it a method, a path to query, and an optional body and
// it returns a promise with the decoded result.
function request_es(method, path, json) {
  return new Promise((resolve, reject) => {
    // For safety, don't assume the method comes in in a consistent case.
    const meth = method.toLowerCase();
    if (!_.includes(["put", "patch", "post", "head", "del", "get"], meth)) {
      reject(new Error(`Invalid method ${meth}`));
    }
    const url = config.ELASTICSEARCH_URL + path;
    const opts = {
      url, auth,
      json: json || true,
    };
    request[meth](opts, (error, response, body) => {
      if (error != null) {
        reject(error);
      } else if (response.statusCode === 200) {
        resolve(body);
      } else {
        reject(new Error(`Elasticsearch ${meth} request to ${path} failed with ${response.statusCode}: ${JSON.stringify(body)}`));
      }
    });
  });
}

function request_es_no_body(method, path) {
  return request_es(method, path, undefined);
}

function get_es(path) {
  return request_es_no_body("get", path);
}

function get_index_settings() {
  return get_es("/*/_settings");
}

export function get_index_shards() {
  return get_index_settings().then((data) => {
    const shard_map = {};
    Object.keys(data).forEach((key) => {
      shard_map[key] = {
        shards: data[key].settings.index.number_of_shards,
        replicas: data[key].settings.index.number_of_replicas,
      };
    });
    return shard_map;
  });
}

export function get_indices() {
  return get_index_settings().then((data) => Object.keys(data).sort());
}

// Filters out indices that are not managed (so that they are ignored)
function filter_managed_indices(all_indices) {
  return new Promise((resolve) => {
    const managed_indices = [];
    all_indices.forEach((index) => {
      // filter out indices that don't match the prefix
      if (index.indexOf(config.indices.prefix) === 0) {
        managed_indices.push(index);
      }
    });
    resolve(managed_indices);
  });
}

// Filers out all indices that should be kept (returns old indices)
// NOTE: also relies on the list being pre-filtered to only include managed indices
function filter_old_indices(current_indices) {
  return new Promise((resolve) => {
    const acceptable_indices = [];
    let today = moment();
    for (let i = 0; i < config.indices.days; i++) {
      acceptable_indices.push(`${config.indices.prefix}-${today.format("YYYY.MM.DD")}`);
      today = today.subtract(1, "days");
    }
    const indices = _.difference(current_indices, acceptable_indices);
    resolve(indices);
  });
}

// delete_index that takes in an index to delete, deletes it, and returns the name of the index that
// was deleted or an error
function delete_index(index) {
  return request_es_no_body("del", `/${index}`).then(() => index);
}

function delete_indices(indices) {
  // group indices together so we can use less requests
  // ["log1", "log2", "log3", ...] => ["log1,log2,log3", "log4,log5,log6"]
  const grouped_indices = _.chain(indices).chunk(20).map((arr) => arr.join(",")).value();
  return Promise.all(_.map(grouped_indices, delete_index));
}

export function clear_old_indices() {
  return get_indices().then(filter_managed_indices).then(filter_old_indices).then(delete_indices);
}

function get_aliases() {
  return get_es("/_aliases").then((indices) => {
    // The aliases endpoint returns a map from index name to metadata about those indexes.
    // e.g.
    //   {
    //     ".kibana-4": {
    //       "aliases": {}
    //     },
    //     "logs-2016.04.02": {
    //       "aliases": {
    //         "last_2days": {},
    //         "last_2weeks": {},
    //         "last_day": {},
    //         "last_week": {}
    //       }
    //     },
    //   }
    // It's much easier to work with a map from alias name to list of indexes in the alias.
    const aliases = {};
    for (const index of Object.keys(indices)) {
      for (const alias of Object.keys(indices[index].aliases)) {
        if (!aliases[alias]) {
          aliases[alias] = [];
        }
        aliases[alias].push(index);
        // Keep the results sorted and unique
        aliases[alias] = _.chain(aliases[alias]).sortBy(_.identity).uniq(true).value();
      }
    }

    return aliases;
  });
}

function filter_managed_aliases(aliases) {
  return new Promise((resolve) => {
    for (const alias of Object.keys(aliases)) {
      if (!config.aliases.mappings[alias]) {
        delete aliases[alias];
      }
    }
    resolve(aliases);
  });
}

function update_alias_state(current_indices, alias) {
  return new Promise((resolve, reject) => {
    const acceptable_indices = [];
    let today = moment();
    for (let i = 0; i < config.aliases.mappings[alias]; i++) {
      acceptable_indices.push(`${config.indices.prefix}-${today.format("YYYY.MM.DD")}`);
      today = today.subtract(1, "days");
    }
    const indices_to_remove = _.difference(current_indices, acceptable_indices);
    const indices_to_add = _.difference(acceptable_indices, current_indices);

    if (!indices_to_remove.length && !indices_to_add.length) {
      resolve();
      return;
    }

    // To modify an alias, send a list of "actions" that look like:
    //    { <add or remove>: { index: <index name>, alias: <alias name> } }
    const action_el = (action, index) => {
      const out = {};
      out[action] = {index, alias};
      return out;
    };
    const actions = _.map(indices_to_remove, _.partial(action_el, "remove"))
      .concat(_.map(indices_to_add, _.partial(action_el, "add")));

    request_es("post", "/_aliases", {actions}).then(() => {
      resolve();
    }).catch(reject);
  });
}

function remove_old_indices_from_aliases(aliases) {
  return Promise.all(_.map(aliases, update_alias_state));
}

export function update_aliases() {
  return get_aliases().then(filter_managed_aliases)
    .then(remove_old_indices_from_aliases)
    .then(get_aliases).then(filter_managed_aliases);
}


// filters out indices based on config.indices.replica.days
function filter_replica_indices(current_indices) {
  return new Promise((resolve) => {
    const ignore_indices = [];
    let today = moment();
    for (let i = 0; i < config.indices.replicas.days; i++) {
      ignore_indices.push(`${config.indices.prefix}-${today.format("YYYY.MM.DD")}`);
      today = today.subtract(1, "days");
    }
    const indices = _.difference(current_indices, ignore_indices);
    resolve(indices);
  });
}

// apply configured replica settings to an index
function set_replica_state(index) {
  const new_setting = {index: {number_of_replicas: config.indices.replicas.value}};
  return request_es("put", `/${index}/_settings`, new_setting);
}

// apply configured replica settings to a list of indices
function apply_replica_settings(indices) {
  return Promise.all(_.map(indices, set_replica_state));
}

export function update_replicas() {
  return get_indices().then(filter_replica_indices)
    .then(apply_replica_settings)
    .then(get_index_shards);
}
