# 🚀 Guide de Déploiement sur Discord

## Étape 1 : Configuration du Bot Discord

### 1.1 Créer une Application Discord

1. Allez sur le [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur **"New Application"**
3. Donnez un nom à votre bot (ex: "MaruBot")
4. Cliquez sur **"Create"**

### 1.2 Créer un Bot

1. Dans le menu de gauche, allez dans **"Bot"**
2. Cliquez sur **"Add Bot"** puis **"Yes, do it!"**
3. **IMPORTANT** : Copiez le **TOKEN** (cliquez sur "Reset Token" si nécessaire)
   - ⚠️ **NE PARTAGEZ JAMAIS CE TOKEN !**
4. Dans la section **"Privileged Gateway Intents"**, activez :
   - ✅ **PRESENCE INTENT**
   - ✅ **SERVER MEMBERS INTENT**
   - ✅ **MESSAGE CONTENT INTENT**

### 1.3 Récupérer le Client ID

1. Allez dans **"General Information"** (menu de gauche)
2. Copiez le **Application ID** (c'est votre CLIENT_ID)

## Étape 2 : Configuration du Fichier .env

1. Créez un fichier `.env` à la racine du projet
2. Ajoutez vos informations :

```env
# Bot Discord (OBLIGATOIRE)
DISCORD_TOKEN=votre_token_copié_à_l_étape_1.2
DISCORD_CLIENT_ID=votre_application_id_copié_à_l_étape_1.3

# Base de données (OBLIGATOIRE)
DATABASE_URL=postgresql://user:password@localhost:5432/MaruBot

# Redis (optionnel mais recommandé)
REDIS_URL=redis://localhost:6379

# Logs
LOG_LEVEL=info

# Performance
SHARDS=auto
CACHE_TTL=3600
MAX_QUEUE_SIZE=100
```

## Étape 3 : Configuration de la Base de Données

### Option A : Avec Docker (Recommandé)

```bash
docker-compose up -d
```

Cela démarre PostgreSQL et Redis automatiquement.

### Option B : Installation Manuelle

1. Installez PostgreSQL sur votre machine
2. Créez une base de données nommée `MaruBot`
3. Mettez à jour le `DATABASE_URL` dans `.env`

Puis lancez :

```bash
npm run db:push
```

## Étape 4 : Inviter le Bot sur votre Serveur

1. Dans le Developer Portal, allez dans **"OAuth2" > "URL Generator"**
2. Sélectionnez les scopes :
   - ✅ `bot`
   - ✅ `applications.commands`
3. Sélectionnez les permissions nécessaires :
   - ✅ Send Messages
   - ✅ Embed Links
   - ✅ Connect
   - ✅ Speak
   - ✅ Use Voice Activity
   - ✅ Manage Messages (pour la modération)
   - ✅ Manage Roles (pour les rôles)
4. Copiez l'URL générée en bas de la page
5. Ouvrez cette URL dans votre navigateur
6. Sélectionnez le serveur où inviter le bot
7. Cliquez sur **"Autoriser"**

## Étape 5 : Déployer les Commandes Slash

### Pour un serveur spécifique (recommandé pour les tests)

```bash
npm run deploy:commands -- --guild=VOTRE_GUILD_ID
```

Pour obtenir votre GUILD_ID :
1. Activez le mode développeur dans Discord (Paramètres > Avancé > Mode développeur)
2. Clic droit sur votre serveur > Copier l'ID

### Pour tous les serveurs (peut prendre jusqu'à 1h)

```bash
npm run deploy:commands
```

## Étape 6 : Lancer le Bot

### Mode Développement (avec hot-reload)

```bash
npm run dev
```

### Mode Production

```bash
npm run build
npm start
```

## Vérification

Si tout fonctionne, vous devriez voir dans la console :

```
[2024-XX-XX XX:XX:XX] [info]: Démarrage de MaruBot...
[2024-XX-XX XX:XX:XX] [info]: Chargement de X commande(s)...
[2024-XX-XX XX:XX:XX] [info]: Bot connecté en tant que MaruBot#XXXX
[2024-XX-XX XX:XX:XX] [info]: Actif sur X serveur(s)
```

## Tester le Bot

1. Allez sur votre serveur Discord
2. Taper `/ping` pour tester la connexion
3. Taper `/play [nom d'une musique]` pour tester le module musique

## Problèmes Courants

### Le bot ne se connecte pas
- Vérifiez que le TOKEN est correct dans `.env`
- Vérifiez que les intents sont activés dans le Developer Portal

### Les commandes n'apparaissent pas
- Les commandes peuvent prendre jusqu'à 1h pour apparaître globalement
- Utilisez `--guild=GUILD_ID` pour un déploiement instantané

### Erreur de base de données
- Vérifiez que PostgreSQL est démarré
- Vérifiez que `DATABASE_URL` est correct
- Lancez `npm run db:push` pour créer les tables

### Le bot ne joue pas de musique
- Assurez-vous que FFmpeg est installé sur votre machine
- Vérifiez que le bot peut se connecter au canal vocal

## Support

Pour toute question, consultez la documentation dans `docs/` ou créez une issue sur GitHub.



