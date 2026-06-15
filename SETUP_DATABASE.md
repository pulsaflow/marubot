# 📊 Configuration de la Base de Données

## Option 1 : Docker Desktop (Recommandé)

### Prérequis
1. Installez [Docker Desktop](https://www.docker.com/products/docker-desktop/) si ce n'est pas fait
2. Démarrez Docker Desktop et attendez qu'il soit complètement lancé (icône dans la barre des tâches)

### Démarrer les services

```bash
docker-compose up -d
```

Cela démarre automatiquement :
- PostgreSQL sur le port 5432
- Redis sur le port 6379

### Vérifier que ça fonctionne

```bash
docker ps
```

Vous devriez voir deux conteneurs en cours d'exécution.

### Initialiser la base de données

```bash
npm run db:push
```

---

## Option 2 : PostgreSQL Local (Sans Docker)

### Installation sur Windows

1. **Télécharger PostgreSQL :**
   - Allez sur https://www.postgresql.org/download/windows/
   - Téléchargez le programme d'installation
   - Suivez l'installation (notez le mot de passe que vous définissez)

2. **Créer la base de données :**
   - Ouvrez "pgAdmin" (installé avec PostgreSQL)
   - Connectez-vous avec le mot de passe que vous avez défini
   - Clic droit sur "Databases" > "Create" > "Database"
   - Nommez-la `MaruBot`
   - Cliquez sur "Save"

3. **Configurer le fichier .env :**

```env
DATABASE_URL=postgresql://postgres:votre_mot_de_passe@localhost:5432/MaruBot
```

Remplacez `votre_mot_de_passe` par le mot de passe que vous avez défini lors de l'installation.

4. **Initialiser la base de données :**

```bash
npm run db:push
```

---

## Option 3 : Service PostgreSQL en ligne (Gratuit)

Si vous ne voulez pas installer PostgreSQL localement, vous pouvez utiliser un service gratuit :

### Option A : Neon (Recommandé - Gratuit)
1. Allez sur https://neon.tech
2. Créez un compte gratuit
3. Créez un nouveau projet
4. Copiez l'URL de connexion (format : `postgresql://user:password@host/dbname`)
5. Ajoutez-la dans votre `.env` :

```env
DATABASE_URL=l_url_copiée_depuis_neon
```

### Option B : Supabase (Gratuit)
1. Allez sur https://supabase.com
2. Créez un compte et un projet
3. Allez dans "Settings" > "Database"
4. Copiez l'URI de connexion
5. Ajoutez-la dans votre `.env`

---

## Configuration Redis (Optionnel mais Recommandé)

Redis améliore les performances mais n'est pas obligatoire.

### Avec Docker (si Docker est disponible)

Déjà inclus dans `docker-compose.yml` - il démarre automatiquement.

### Sans Docker

Redis n'est pas strictement nécessaire pour le bot. Le bot fonctionnera sans Redis, mais le cache ne sera pas disponible.

Vous pouvez simplement ne pas mettre `REDIS_URL` dans votre `.env` ou laisser vide.

---

## Vérification

Après avoir configuré la base de données, testez avec :

```bash
npm run db:studio
```

Cela ouvre Prisma Studio dans votre navigateur où vous pouvez voir les tables.

---

## Problèmes Courants

### "Connection refused" ou "Unable to connect"
- Vérifiez que PostgreSQL est démarré
- Vérifiez le mot de passe dans `DATABASE_URL`
- Vérifiez que le port 5432 n'est pas utilisé par un autre service

### "Database does not exist"
- Créez la base de données manuellement (voir Option 2)
- Ou laissez `npm run db:push` la créer automatiquement

### Docker ne démarre pas
- Vérifiez que Docker Desktop est bien lancé
- Redémarrez Docker Desktop
- Ou utilisez l'Option 2 (PostgreSQL local) ou l'Option 3 (Service en ligne)









