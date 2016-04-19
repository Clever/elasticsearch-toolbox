# Elasticsearch Toolbox

A collection of tools for maintaining an Elasticsearch cluster. Most tools are wrapped up into a small web server with a UI. These tools are are generally written with log searching as the primary use case.


# Tools

  - Index Management - prune old indexes based on a configurable retention policy
  - Alias Management - prune indexes from aliases based on a per alias configuration
  - Replica Management - keep replicas for only the most active indexes


# API

## Status

The following endpoints return status on the Elasticsearch Cluster being managed:
  - **/status/indices** - returns indices and their status as json

## Indices

Alias management is configured in [config.yml](./config.yml) with the following section:
```yml
indices:
  prefix: # Only indices with the prefix here will be considered when pruning
  days: # Number of days worth of indices to keep
  clearAt: # cron schedule of when to prune old indices
```

You can manually trigger this operation by making a **GET** request to **/indices/clear**

## Aliases

Alias management is configured in [config.yml](./config.yml) with the following section:
```yml
indices:
  aliases: # Contains a map of alias names to the number of indices to include in them:
    <alias_name>: <number of indices to include> 
    updateAt: # cron schedule of when to update the aliases
```

You can manually trigger this operation by making a **GET** request to **/aliases/update**

## Replicas

Replica management is configured in [config.yml](./config.yml) with the following section:
```yml
indices:
  replicas:
    days: # number of days worth of indices to retain replicas for
    value: # new replica count to set of indices older than `days`
    updateAt: # cron schedule of when to update replica counts
```

You can manually trigger this operation by making a **GET** request to **/replicas/update**

# Local Development

Before running locally, you need to set the following environment variables:
  - **ELASTICSEARCH_URL** - base url for the Elasticsearch cluster you are working with
  - **ELASTICSEARCH_USER** - Elasticsearch username
  - **ELASTICSEARCH_PASSWORD** - Elasticsearch password


```
npm install
npm run dev-server
```
