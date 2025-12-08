# Guide de Démarrage Rapide

Ce guide vous aidera à démarrer rapidement avec SuperBot.

## Prérequis

Assurez-vous d'avoir installé :

- **Node.js 20+** : [Télécharger Node.js](https://nodejs.org/)
- **PostgreSQL 14+** : [Télécharger PostgreSQL](https://www.postgresql.org/download/)
- **Redis** (optionnel) : [Télécharger Redis](https://redis.io/download/)
- **FFmpeg** (pour le module musique) : [Télécharger FFmpeg](https://ffmpeg.org/download.html)

## Configuration Discord

1. Allez sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. Créez une nouvelle application
3. Allez dans l'onglet "Bot"
4. Créez un bot et copiez le **Token**
5. Activez les **Privileged Gateway Intents** suivants :
   - ✅ PRESENCE INTENT
   - ✅ SERVER MEMBERS INTENT
   - ✅ MESSAGE CONTENT INTENT
6. Dans l'onglet "OAuth2 > URL Generator", sélectionnez les scopes :
   - `bot`
   - `applications.commands`
7. Copiez l'URL et invitez le bot sur votre serveur

## Installation

### 1. Cloner et installer

```bash
git clone https://github.com/votre-repo/superbot.git
cd superbot
npm install
```

### 2. Configuration de l'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Bot Discord (OBLIGATOIRE)
DISCORD_TOKEN=votre_token_discord
DISCORD_CLIENT_ID=votre_client_id

# Base de données (OBLIGATOIRE)
DATABASE_URL=postgresql://user:password@localhost:5432/superbot

# Redis (optionnel mais recommandé)
REDIS_URL=redis://localhost:6379

# Logs
LOG_LEVEL=info

# Performance
SHARDS=auto
CACHE_TTL=3600
```

### 3. Base de données

```bash
# Générer le client Prisma
npm run db:generate

# Créer la base de données
npm run db:push

# (Optionnel) Ajouter des données de test
npm run db:seed
```

### 4. Déployer les commandes

```bash
# Déploiement global (peut prendre jusqu'à 1h pour se propager)
npm run deploy:commands

# OU déploiement sur un serveur spécifique (instantané, pour tests)
npm run deploy:commands -- --guild=VOTRE_GUILD_ID
```

### 5. Démarrer le bot

```bash
# Mode développement
npm run dev

# Mode production
npm run build
npm start
```

## Vérification

Une fois le bot démarré, vous devriez voir :

```
[2024-XX-XX XX:XX:XX] [info]: Bot connecté en tant que SuperBot#XXXX
[2024-XX-XX XX:XX:XX] [info]: Actif sur X serveur(s)
```

Testez la commande `/ping` sur votre serveur Discord pour vérifier que tout fonctionne !

## Docker (Alternative)

Si vous préférez utiliser Docker :

```bash
# Démarrer PostgreSQL et Redis
docker-compose up -d

# Attendre que les services soient prêts
# Puis suivre les étapes 2-5 ci-dessus
```

## Prochaines Étapes

- Consultez la [documentation des modules](./MODULES.md)
- Configurez les modules selon vos besoins
- Découvrez les commandes avec `/help` (à implémenter)

## Dépannage

### Le bot ne se connecte pas

- Vérifiez que le token Discord est correct
- Vérifiez que les intents sont activés dans le Developer Portal
- Consultez les logs pour plus d'informations

### Erreur de base de données

- Vérifiez que PostgreSQL est démarré
- Vérifiez que la DATABASE_URL est correcte
- Assurez-vous d'avoir exécuté `npm run db:push`

### Les commandes n'apparaissent pas

- Les commandes globales peuvent prendre jusqu'à 1h
- Utilisez `--guild=GUILD_ID` pour un déploiement instantané sur un serveur
- Vérifiez que le CLIENT_ID est correct

## Support

Besoin d'aide ? Consultez :
- [Issues GitHub](https://github.com/votre-repo/superbot/issues)
- Serveur Discord de support
- Documentation complète



