FROM node:20-alpine as installer

#RUN apk add --no-cache alpine-sdk python3
RUN apk add --no-cache alpine-sdk python3 sqlite-dev

WORKDIR /fot.sg/build
ENV YARN_CACHE_FOLDER=/.yarn/cache
COPY package.json .
#RUN yarn install --ignore-scripts
RUN yarn install --frozen-lockfile

FROM node:20-alpine 

WORKDIR /fot.sg/build
ENV YARN_CACHE_FOLDER=/.yarn/cache
COPY --from=installer /.yarn/cache /.yarn/cache
COPY --from=installer /fot.sg/build/node_modules /fot.sg/build/node_modules
