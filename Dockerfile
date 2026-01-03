FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json

RUN npm install

COPY server ./server
COPY client ./client

RUN npm run build --workspace client
RUN npm run build --workspace server

FROM node:20-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY server/package.json ./server/package.json

RUN npm install --omit=dev --workspace server

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["node", "server/dist/index.js"]
