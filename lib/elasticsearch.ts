var config  = require("../config");
var request = require("request");


// Helper function to make ES queries. Pass it a path to query and it returns
// a promise with the decoded result
function get_es(path) {
  // wrap the async request in a promise and return it
  return new Promise((resolve, reject) => {
    const url = config.ELASTICSEARCH_URL + path;
    const auth = {
      user: config.ELASTICSEARCH_USER,
      pass: config.ELASTICSEARCH_PASSWORD,
      sendImmediately: false,
    };
    request.get({url, auth}, (error, response, body) => {
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
