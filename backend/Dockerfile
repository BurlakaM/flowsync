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

# ---- build: compile TypeScript and generate the Prisma client ----
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---- prod-deps: production dependencies only ----
# The prisma CLI is a regular dependency on purpose: the container runs `prisma migrate deploy` on start.
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- prod: runs as the unprivileged `node` user ----
FROM base AS prod
ENV NODE_ENV=production
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
# The generated Prisma client (query engine included) comes from the build stage.
COPY --chown=node:node --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
