# Module Musique - Instructions d'installation

## Prérequis

### 1. Node.js
- **Version recommandée**: Node.js 18.x ou 20.x LTS
- **Version actuelle**: v23.11.0 (⚠️ trop récente, peut causer des problèmes)
- **Recommandation**: Downgrade vers Node.js 20.x LTS

```powershell
# Vérifier la version
node --version

# Installer Node.js 20.x LTS depuis https://nodejs.org/
```

### 2. FFmpeg
- **Version installée**: 8.0.1 à `C:\ffmpeg\bin\ffmpeg.exe`
- **Vérification**:

```powershell
C:\ffmpeg\bin\ffmpeg.exe -version
```

Si FFmpeg n'est pas installé:
1. Télécharger depuis https://ffmpeg.org/download.html
2. Extraire dans `C:\ffmpeg`
3. Ajouter `C:\ffmpeg\bin` au PATH système

### 3. Dépendances npm
Toutes les dépendances sont déjà présentes dans `package.json`:

- `@discordjs/voice`: ^0.19.0 ✅
- `play-dl`: ^1.9.7 ✅
- `discord.js`: ^14.14.1 ✅
- `sodium-native`: ^5.0.10 ✅

```powershell
# Installer les dépendances
npm install
```

## Architecture du module musique

### Structure
```
src/music/
├── index.ts              # Exports principaux
├── types.ts              # Types TypeScript
├── Track.ts              # Classe Track
├── MusicManager.ts       # Gestionnaire de sessions
├── GuildSession.ts       # Session par serveur
└── providers/
    ├── resolver.ts       # Résolution URL/recherche → metadata
    └── resource.ts       # Création AudioResource

src/commands/music/
├── play.ts               # /play <query>
├── skip.ts               # /skip
├── stop.ts               # /stop
├── pause.ts              # /pause
├── resume.ts             # /resume
├── queue.ts              # /queue
├── nowplaying.ts         # /nowplaying
├── volume.ts             # /volume <0-100>
├── loop.ts               # /loop <off|track|queue>
├── remove.ts             # /remove <position>
└── clear.ts              # /clear
```

### Technologies
- **Base**: @discordjs/voice (sans discord-player)
- **Streaming**: play-dl (YouTube, SoundCloud, etc.)
- **Audio**: demuxProbe pour détection automatique du type
- **Architecture**: Map-based sessions (1 par serveur)

## Démarrage

```powershell
# Mode développement (watch)
npm run dev

# Build production
npm run build

# Déployer les commandes slash
npm run deploy:commands
```

## Notes importantes

### Différences avec l'ancien système
1. ❌ **Supprimé**: discord-player, @discord-player/extractor, YouTubeExtractor
2. ✅ **Nouveau**: play-dl direct, pas de couche d'abstraction
3. ✅ **Avantages**: 
   - Pas de TimeoutNegativeWarning
   - Contrôle total du pipeline audio
   - Code simple et maintenable
   - Erreurs explicites et traçables

### Gestion des erreurs
- Si un stream échoue → skip automatique vers la piste suivante
- Logs détaillés dans LoggerService
- Pas de crash du bot sur erreur de stream

### Optimisations
- `demuxProbe` détecte automatiquement le format audio
- `inlineVolume: true` pour ajustement dynamique
- VoiceConnection auto-reconnect sur déconnexion

### Limitations actuelles
- Pas de recherche Spotify (seulement YouTube via play-dl)
- Pas de filtres audio
- Pas de seek/rewind (à implémenter si besoin)

## Troubleshooting

### Erreur "FFmpeg not found"
```powershell
# Vérifier FFmpeg
C:\ffmpeg\bin\ffmpeg.exe -version

# Ajouter au PATH si nécessaire
$env:Path += ";C:\ffmpeg\bin"
```

### Erreur "sodium not found"
```powershell
# Réinstaller sodium-native
npm uninstall sodium-native
npm install sodium-native@5.0.10
```

### Erreur "play-dl stream failed"
- Vérifier la connexion Internet
- YouTube peut bloquer temporairement (rate limit)
- Réessayer avec une autre vidéo

### Bot se déconnecte après quelques secondes
- Vérifier que FFmpeg est accessible
- Vérifier les logs pour TimeoutNegativeWarning (ne devrait plus exister)
- Si le problème persiste: downgrade Node.js vers 20.x LTS
