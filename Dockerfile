FROM node:6.2.2-slim

WORKDIR /elasticsearch-toolbox

COPY . /elasticsearch-toolbox

CMD ["node_modules/ts-node/dist/bin/ts-node.js", "server.ts"]
