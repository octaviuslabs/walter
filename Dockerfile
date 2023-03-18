FROM node:16 as build

ENV APP=/app
RUN mkdir $APP
ADD . $APP
WORKDIR $APP

RUN npm install
RUN npm run build

CMD node ./dist/index.js
