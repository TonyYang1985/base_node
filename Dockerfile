FROM node:14-alpine as installer

RUN apk add --no-cache alpine-sdk python3

WORKDIR /fot.sg/build
ENV YARN_CACHE_FOLDER=/.yarn/cache
COPY package.json .
RUN yarn install --ignore-scripts

FROM node:14-alpine

WORKDIR /fot.sg/build
ENV YARN_CACHE_FOLDER=/.yarn/cache
COPY --from=installer /.yarn/cache /.yarn/cache
COPY --from=installer /fot.sg/build/node_modules /fot.sg/build/node_modules
