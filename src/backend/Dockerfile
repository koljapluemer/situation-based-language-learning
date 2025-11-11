# syntax=docker/dockerfile:1.7

FROM node:20-bullseye AS deps
WORKDIR /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY src/backend/package*.json ./src/backend/
RUN cd src/backend && npm install

FROM node:20-bullseye AS builder
WORKDIR /app
COPY tsconfig.base.json ./tsconfig.base.json
COPY src/shared ./src/shared
COPY src/backend ./src/backend
COPY --from=deps /app/src/backend/node_modules ./src/backend/node_modules
WORKDIR /app/src/backend
RUN npm run prisma:generate
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bullseye AS runner
ENV NODE_ENV=production
WORKDIR /app/src/backend
COPY --from=builder /app/src/backend/dist ./dist
COPY --from=builder /app/src/backend/prisma ./prisma
COPY --from=builder /app/src/backend/node_modules ./node_modules
COPY --from=builder /app/src/shared ../shared
EXPOSE 3333
CMD ["node", "dist/server.js"]
