FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY client/package*.json client/
COPY server/package*.json server/
RUN npm install && npm --prefix client install && npm --prefix server install

COPY client client
COPY server server
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json server/
RUN npm --prefix server install --omit=dev

COPY --from=build /app/client/dist client/dist
COPY server server

EXPOSE 5000
CMD ["npm", "start"]
