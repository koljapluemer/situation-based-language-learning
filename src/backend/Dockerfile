# syntax=docker/dockerfile:1.7

FROM node:20-bullseye AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-bullseye AS builder
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY src ./src
RUN npm run prisma:generate
RUN npm run backend:build

FROM node:20-bullseye AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev
COPY --from=builder /app/src/backend/dist ./src/backend/dist
COPY --from=builder /app/src/backend/prisma ./src/backend/prisma
COPY --from=builder /app/src/shared ./src/shared
EXPOSE 3333
CMD ["node", "src/backend/dist/server.js"]
