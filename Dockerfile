# syntax=docker/dockerfile:1

# --- Build stage: install production dependencies ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Runtime stage ---
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the unprivileged user that ships with the node image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
