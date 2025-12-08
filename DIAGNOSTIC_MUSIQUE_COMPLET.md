# Diagnostic Complet - Module Musique MaruBot

**Date**: 2025-12-07  
**Problème**: La musique ne démarre pas malgré que la track soit trouvée et la connexion établie.

## 📋 Résumé du problème

1. ✅ La musique est trouvée
2. ✅ Le bot se connecte au canal vocal
3. ✅ La track est ajoutée à la queue
4. ❌ La musique ne démarre PAS (`isPlaying=false` après `play()`)
5. ❌ Erreurs du lecteur audio affichées comme `"[object Object]"`

## 🔍 Logs actuels

```
2025-12-07 23:14:12 [info]: [play.ts] Appel queue.node.play() - Track unique: JuL - Nostalgique
2025-12-07 23:14:12 [info]: [play.ts] État AVANT: isPlaying=false, isPaused=false, size=1
2025-12-07 23:14:12 [info]: [play.ts] Connection status: EXISTS
2025-12-07 23:14:12 [info]: [play.ts] Tentative de démarrage de la lecture...
2025-12-07 23:14:13 [error]: Erreur du lecteur audio: {"message": "[object Object]"}
2025-12-07 23:14:13 [error]: Erreur du lecteur audio: {"message": "[object Object]"}
2025-12-07 23:14:14 [info]: [play.ts] État APRÈS play(): isPlaying=false, isPaused=false
2025-12-07 23:14:14 [warn]: ⚠️ [play.ts] La lecture n'a pas démarré après play() - isPlaying=false, isPaused=false
```

## 🛠️ Configuration actuelle

### Dépendances installées

```json
{
  "@discord-player/extractor": "^4.4.0",
  "@discordjs/opus": "^0.10.0",
  "discord-player": "^6.6.0",
  "discord-player-youtubei": "^1.5.0",
  "ffmpeg-static": "^5.3.0"
}
```

### FFmpeg

- ✅ `ffmpeg-static` installé
- ✅ Chemin: `node_modules/ffmpeg-static/ffmpeg.exe`
- ✅ Configuré dans `Bot.ts` (ligne 1-2)
- ✅ `FFMPEG_PATH` défini dans `process.env`

### Extracteurs

- ✅ `YoutubeiExtractor` enregistré
- ✅ `SpotifyExtractor` enregistré (optionnel)
- ✅ `SoundCloudExtractor` enregistré (optionnel)

## 📁 Fichiers clés

### 1. `src/core/Bot.ts`

```typescript
import ffmpeg from 'ffmpeg-static';
process.env.FFMPEG_PATH = ffmpeg as string;
```

- ✅ FFmpeg configuré au démarrage
- ✅ `Client.toJSON()` désactivé pour éviter récursion

### 2. `src/services/MusicService.ts`

#### Configuration du Player

```typescript
this.player = new Player(client, {
  ytdlOptions: {
    quality: 'highestaudio',
    highWaterMark: 1 << 25,
  },
  connectionTimeout: 30000,
  ffmpegPath: process.env.FFMPEG_PATH, // Si disponible
});
```

#### Gestion des erreurs

```typescript
this.player.events.on('error', (error) => {
  // ❌ PROBLÈME: L'erreur est mal extraite → "[object Object]"
  logger.error('Erreur du lecteur audio:', error);
});
```

#### Méthode play()

```typescript
async play(query: string, member: GuildMember, channel: TextBasedChannel) {
  // ... recherche et ajout de la track ...
  
  if (!queue.node.isPlaying() && !queue.node.isPaused()) {
    try {
      await queue.node.play();
      // ❌ PROBLÈME: play() ne lance pas d'erreur mais la musique ne démarre pas
    } catch (error) {
      // Ce catch n'est jamais déclenché
    }
  }
}
```

### 3. `src/commands/music/play.ts`

- ✅ Utilise `musicService.searchTracks()` pour l'autocomplete
- ✅ Ajoute directement la track à la queue
- ✅ Appelle `queue.node.play()` si pas déjà en cours

## 🐛 Problèmes identifiés

### 1. Erreurs mal loggées

**Symptôme**: `"[object Object]"` dans les logs  
**Cause**: L'objet erreur n'est pas correctement sérialisé  
**Solution**: Améliorer l'extraction de l'erreur (déjà fait partiellement)

### 2. La musique ne démarre pas

**Symptôme**: `isPlaying=false` après `queue.node.play()`  
**Causes possibles**:
- Erreur silencieuse dans l'extraction du stream
- Problème avec FFmpeg (même si installé)
- Problème avec l'extracteur YouTube
- Problème de connexion vocale (permissions, codec, etc.)
- Track invalide ou non extractable

### 3. Récursion infinie (résolu)

- ✅ `Client.toJSON()` désactivé
- ✅ `client.bot` rendu non-enumerable
- ✅ Métadonnées de queue simplifiées (channelId au lieu de channel)

## 🔧 Solutions appliquées

1. ✅ Amélioration du logging des erreurs
2. ✅ Vérification de FFmpeg au démarrage
3. ✅ Protection anti-récursion avec `playingGuilds` Set
4. ✅ Try/catch améliorés autour de `queue.node.play()`
5. ✅ Délai d'attente augmenté après `play()` (1000ms)

## 🔍 Points à vérifier

1. **Vérifier l'erreur réelle du lecteur audio**
   - Le message `"[object Object]"` cache la vraie erreur
   - Ajouter un logger qui affiche toutes les propriétés de l'erreur

2. **Vérifier les événements discord-player**
   - `playerStart` est-il déclenché ?
   - `playerError` est-il déclenché ? Avec quelle erreur ?
   - `debug` events pour voir ce qui se passe

3. **Vérifier la connexion vocale**
   - Les permissions sont-elles correctes ?
   - Le codec audio est-il supporté ?
   - La connexion est-elle vraiment établie ?

4. **Vérifier l'extraction du stream**
   - La track est-elle valide ?
   - Le stream peut-il être extrait ?
   - Y a-t-il des restrictions YouTube (Premium, géolocalisation) ?

## 📝 Code complet des fichiers pertinents

### `src/services/MusicService.ts`

```typescript
// ... voir le fichier complet dans le projet ...
```

### `src/commands/music/play.ts`

```typescript
// ... voir le fichier complet dans le projet ...
```

### `src/core/Bot.ts`

```typescript
// ... voir le fichier complet dans le projet ...
```

## 🎯 Prochaines étapes

1. **Améliorer le logging de l'erreur `"[object Object]"`**
   - Extraire toutes les propriétés de l'objet erreur
   - Logger le type de l'erreur
   - Logger la stack trace complète

2. **Ajouter des logs de debug détaillés**
   - Avant/après chaque étape de `play()`
   - État de la queue à chaque moment
   - Événements discord-player déclenchés

3. **Vérifier les prérequis**
   - FFmpeg accessible et fonctionnel
   - Opus encoder disponible
   - Permissions Discord correctes
   - Extracteurs correctement chargés

4. **Tester avec différentes sources**
   - YouTube (URL directe)
   - YouTube (recherche)
   - Spotify (si disponible)

## 📚 Documentation utile

- [discord-player Documentation](https://discord-player.js.org/)
- [discord-player GitHub](https://github.com/Androz2091/discord-player)
- [discord-player-youtubei](https://github.com/Androz2091/discord-player-youtubei)

---

**Status**: 🔴 En cours de diagnostic  
**Priorité**: 🔴 Critique - Module musique non fonctionnel



