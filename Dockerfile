FROM node:24-alpine AS build
# Consumed by compose `build.args` so `docker compose build` fails if `.env` is missing (see docker-compose.yml).
ARG _REQUIRE_DOTENV
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
