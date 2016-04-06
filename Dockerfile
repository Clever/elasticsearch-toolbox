FROM node:5.7.0-slim

ADD . /elasticsearch-toolbox
WORKDIR /elasticsearch-toolbox

RUN npm install --production

CMD ["node_modules/ts-node/dist/bin/ts-node.js", "server.ts"]
