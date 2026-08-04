# syntax=docker/dockerfile:1

# Node 24 ("Krypton") is the Active LTS line, supported until 2028-04-30.
# --- Build stage: install production dependencies ---
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Runtime stage ---
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the unprivileged user that ships with the node image.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
