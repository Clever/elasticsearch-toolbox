var _       = require("underscore");
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
    if (!_.contains(["put", "patch", "post", "head", "del", "get"], meth)) {
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
        reject(new Error(`Request failed with ${response.statusCode}`));
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


// Returns a promise with a list of all the indexes
// TODO: extend this to also include shards and other interesting data
export function get_indices() {
  return get_es("/_stats?level=shards").then((data) => {
    // parse the index names into a list
    const filtered_indices = [];
    Object.keys(data.indices).forEach((key) => {
      // filter out the kibana index
      if (key.indexOf(".kibana") < 0) {
        filtered_indices.push(key);
      }
    });
    return filtered_indices.sort();
  });
}

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
  return Promise.all(_.map(indices, delete_index));
}

export function clear_old_indices() {
  return get_indices().then(filter_old_indices).then(delete_indices);
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
      // Filter out the kibana index
      if (index.indexOf(".kibana") !== -1) {
        continue;
      }
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

    const action_el = (action, index) => {
      const out = {};
      out[action] = {index, alias};
      return out;
    };
    const actions = _.map(indices_to_remove, _.partial(action_el, "remove"))
      .concat(_.map(indices_to_add, _.partial(action_el, "add")));
    request_es("post", "/_aliases", {actions}).then(() => {
      resolve();
    }).catch((err) => {
      reject(err);
    });
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
