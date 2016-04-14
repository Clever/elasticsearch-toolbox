var _       = require("underscore");
var moment  = require("moment");
var request = require("request");

var config  = require("../config");

const auth = {
  user: config.ELASTICSEARCH_USER,
  pass: config.ELASTICSEARCH_PASSWORD,
  sendImmediately: false,
};

// Helper function to make ES queries. Pass it a method and a path to query and it returns
// a promise with the decoded result.
function request_es(method, path) {
  return new Promise((resolve, reject) => {
    method = method.toLowerCase()
    if (!_.contains(["put", "patch", "post", "head", "del", "get"], method)) {
      reject(new Error(`Invalid method ${method}`))
    }
    const url = config.ELASTICSEARCH_URL + path;
    request[method]({url, auth}, (error, response, body) => {
      if (error != null) {
        reject(error);
      } else if (response.statusCode === 200) {
        resolve(JSON.parse(body));
      } else {
        reject(new Error(`Request failed with ${response.statusCode}`));
      }
    });
  });
}

function get_es(path) {
  return request_es("get", path);
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

// We want to keep 14 days of indices. Let's do 15 so I don't have to think hard about what happens
// when the time is in UTC or when we're before/after midnight.
const NUM_DAYS = 15;

function filter_old_indices(current_indices) {
  return new Promise((resolve, reject) => {
    const acceptable_indices = [];
    let today = moment();
    for (let i = 0; i < NUM_DAYS; i++) {
      acceptable_indices.push(`logs-${today.format("YYYY.MM.DD")}`);
      today = today.subtract(1, 'days');
    }
    current_indices.push('fake-index');
    const indices = _.difference(current_indices, acceptable_indices);
    resolve(indices);
  })
}

function delete_indices(indices) {
  return Promise.all(_.map(indices, (index) => request_es("del", `/${index}`)))
}

export function clear_old_indices() {
  return get_indices().then(filter_old_indices).then(delete_indices)
}
