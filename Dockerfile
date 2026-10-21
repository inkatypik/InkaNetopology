# ==========================================
# InkaNetopology Docker Container
# Scanner réseau local & interface de topologie
# ==========================================

FROM node:22-alpine AS builder

WORKDIR /app

# Installation des outils réseau légers
RUN apk add --no-cache iproute2

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Build du frontend statique Vite
RUN npm run build

# Étape finale d'exécution
FROM node:22-alpine AS runner

WORKDIR /app

# Outils réseau pour scanning sous conteneur Linux
RUN apk add --no-cache iproute2 iputils ca-certificates

ENV NODE_ENV=production
ENV PORT=3000

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/documentation.html ./documentation.html

# Répertoire de persistance de l'inventaire
RUN mkdir -p /app/data

EXPOSE 3000

# Utiliser tsx pour exécuter server.ts en production
CMD ["npx", "tsx", "server.ts"]
