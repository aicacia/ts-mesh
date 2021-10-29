FROM node:14-alpine as node-builder

RUN npm install -g npm@8.1.2
WORKDIR /app

FROM node-builder as builder

RUN npm install typescript@4 -g
RUN npm i -D @types/node@14 socket.io@4
COPY tsconfig.json .
COPY server.ts .
RUN tsc server.ts

FROM node-builder

COPY --from=builder /app/server.js .
RUN npm install socket.io@4

EXPOSE 8080

CMD [ "node", "server.js" ]