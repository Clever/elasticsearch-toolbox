# Elasticsearch Toolbox

A collection of tools for maintaining an Elasticsearch cluster. Most tools are wrapped up into a small web server with a UI.


# Tools

  - Index Management - prune old indexes based on a configurable retention policy
  - Replica Management - keep replicas for only the most active indexes 


# API

  - **/status/indices** - returns the indexes as json

# Local Development

Before running locally, you need to set the following environment variables:
  - **ELASTICSEARCH_URL** - base url for the Elasticsearch cluster you are working with
  - **ELASTICSEARCH_USER** - Elasticsearch username
  - **ELASTICSEARCH_PASSWORD** - Elasticsearch password


```
npm install
npm run dev-server
```
