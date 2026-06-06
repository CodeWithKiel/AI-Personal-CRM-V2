FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm ci && npm --prefix client ci && npm --prefix server ci

COPY client client
COPY server server
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json server/
RUN npm --prefix server ci --omit=dev

COPY --from=build /app/client/dist client/dist
COPY server server

EXPOSE 5000
CMD ["npm", "start"]
