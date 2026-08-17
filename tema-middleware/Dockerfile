# =============================================================================
# TEMA Middleware - production Dockerfile (multi-stage)
# =============================================================================

# ---- Build stage ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (including dev deps needed to build TypeScript)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy sources and compile TypeScript -> dist
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN yarn build

# Prune dev dependencies for a lean production node_modules
RUN yarn install --frozen-lockfile --production && yarn cache clean

# ---- Production stage -------------------------------------------------------
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Copy only what is needed to run the compiled app, owned by the non-root user
COPY --chown=node:node package.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# Run as the built-in unprivileged "node" user
USER node

# Documented default port; the app actually binds to TEMA_PORT at runtime
EXPOSE 8081

# Sensible production startup command
CMD ["node", "dist/main.js"]
