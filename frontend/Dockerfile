# syntax=docker/dockerfile:1

# ---- deps: cached until the lockfile changes ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: used by docker-compose.override.yml (CRA dev server, source is bind-mounted) ----
FROM deps AS dev
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

# ---- build: static bundle ----
FROM deps AS build
COPY . .
# CRA bakes REACT_APP_* into the bundle at build time. In production nginx proxies /api to the
# backend, so the default is the same-origin path.
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# ---- prod: unprivileged nginx (listens on 8080) ----
FROM nginxinc/nginx-unprivileged:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 8080
