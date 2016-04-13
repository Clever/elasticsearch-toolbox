FROM node:5.7.0-slim

WORKDIR /elasticsearch-toolbox

COPY . /elasticsearch-toolbox

CMD ["node_modules/ts-node/dist/bin/ts-node.js", "server.ts"]
