FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY prisma ./prisma/

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY . .

# Générer le client Prisma
RUN npm run db:generate

# Compiler TypeScript
RUN npm run build

# Production
FROM node:20-alpine

WORKDIR /app

# Installer FFmpeg pour le module musique
RUN apk add --no-cache ffmpeg

# Copier les fichiers nécessaires
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Créer le dossier de logs
RUN mkdir -p logs

# Exposer le port (si panel web activé)
EXPOSE 3000

# Commande de démarrage
CMD ["node", "dist/index.js"]









