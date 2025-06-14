FROM node:20-alpine AS base

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

# Development stage
FROM base AS development
CMD ["yarn", "start:dev"]

# Build stage
FROM base AS builder
RUN yarn build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/yarn.lock ./
COPY --from=builder /app/dist ./dist

RUN yarn install --production --frozen-lockfile && yarn cache clean

CMD ["node", "dist/main"] 