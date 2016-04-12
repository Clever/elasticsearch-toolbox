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
