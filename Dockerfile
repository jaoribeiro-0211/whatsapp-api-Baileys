FROM node:20-alpine AS base

WORKDIR /app

# Instalar dependências
FROM base AS dependencies
COPY package*.json ./
RUN npm ci

# Build
FROM base AS build
COPY package*.json ./
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Produção
FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/csv-parser.d.ts ./csv-parser.d.ts

EXPOSE 3001

CMD ["node", "dist/index.js"]

