# syntax=docker/dockerfile:1

# ---- base: Node + OpenSSL (required by the Prisma engines on Alpine) ----
FROM node:24-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---- deps: all dependencies (dev + prod), cached until the lockfile changes ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- dev: used by docker-compose.override.yml (source is bind-mounted, watch mode) ----
FROM deps AS dev
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# ---- build: compile TypeScript ----
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---- prod: runs as the unprivileged `node` user ----
# node_modules still contains dev dependencies because compose runs `prisma db push` and the
# seed (prisma CLI, ts-node) on start; phase 3 switches to `migrate deploy` and slims this down.
FROM base AS prod
ENV NODE_ENV=production
COPY --chown=node:node --from=build /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node package.json tsconfig.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
