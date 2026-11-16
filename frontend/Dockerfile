# syntax=docker/dockerfile:1

# ---- deps: cached until the lockfile changes ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: used by docker-compose.override.yml (Vite dev server, source is bind-mounted) ----
FROM deps AS dev
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# ---- build: type-check and bundle ----
FROM deps AS build
COPY . .
# Vite bakes VITE_* into the bundle at build time. In production nginx proxies /api to the
# backend, so the default is the same-origin path.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- prod: unprivileged nginx (listens on 8080) ----
FROM nginxinc/nginx-unprivileged:stable-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
