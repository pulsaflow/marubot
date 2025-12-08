# 🚀 Installation Rapide (Sans Docker)

Si Docker ne fonctionne pas, suivez ce guide simplifié.

## Étape 1 : Configuration Minimaliste

Créez un fichier `.env` avec seulement le strict minimum :

```env
# Bot Discord (OBLIGATOIRE)
DISCORD_TOKEN=votre_token
DISCORD_CLIENT_ID=votre_client_id

# Base de données - Utilisez un service en ligne gratuit
DATABASE_URL=postgresql://user:password@host:5432/database

# Le reste est optionnel pour démarrer
LOG_LEVEL=info
```

## Étape 2 : Base de Données Rapide (5 minutes)

### Utilisez Neon (Gratuit, Aucune Installation)

1. Allez sur https://neon.tech
2. Cliquez sur "Sign Up" (gratuit)
3. Cliquez sur "Create Project"
4. Donnez un nom à votre projet (ex: "MaruBot")
5. Dans "Connection Details", copiez l'URI qui ressemble à :
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb
   ```
6. Collez cette URI dans votre `.env` comme `DATABASE_URL`

C'est tout ! Neon fournit une base PostgreSQL gratuite et hébergée.

## Étape 3 : Démarrer le Bot

```bash
# Initialiser la base de données
npm run db:push

# Lancer le bot
npm run dev
```

## Étape 4 : Déployer les Commandes

Dans un autre terminal :

```bash
npm run deploy:commands -- --guild=VOTRE_GUILD_ID
```

Pour obtenir votre GUILD_ID :
- Activez le mode développeur dans Discord
- Clic droit sur votre serveur > Copier l'ID

## ✅ C'est prêt !

Le bot devrait maintenant fonctionner. Testez avec `/ping` sur votre serveur Discord.

## Note sur Redis

Redis n'est pas obligatoire. Le bot fonctionne sans, mais le cache ne sera pas disponible. Ce n'est pas grave pour démarrer.



