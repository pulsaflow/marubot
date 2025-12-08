# Analyse Complète de la Récursion - Maximum Call Stack Size Exceeded

## Problème
Le bot Discord rencontre une erreur récurrente : `Maximum call stack size exceeded` lors de l'exécution de la commande `/play`. La musique est trouvée et le bot se connecte au canal vocal, mais la lecture ne démarre pas à cause de cette récursion infinie.

## Versions des dépendances
- `discord.js`: ^14.14.1
- `discord-player`: ^6.6.0
- `discord-player-youtubei`: ^1.5.0
- `@discord-player/extractor`: ^4.4.0
- `@discordjs/opus`: ^0.10.0
- Node.js: >=20.0.0

---

## Fichiers Analyseurs

### 1. Service Principal de Musique
**Fichier:** `src/services/MusicService.ts`

```typescript
// Lignes 32-44: Constructeur et initialisation
private constructor(client: Client) {
  // Créer une instance de Player au lieu d'utiliser useMainPlayer
  this.player = new Player(client, {
    ytdlOptions: {
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    },
    connectionTimeout: 30000,
  });

  this.setupPlayer();
  this.setupPlayerEvents(client);
}
```

**Problème potentiel identifié:**
- Ligne 203: `queue.node.skip()` dans le handler `playerError` - **PAS PROTÉGÉ avec setImmediate/setTimeout**

```typescript
// Lignes 188-240: Handler playerError
this.player.events.on('playerError', async (queue, error) => {
  // ... code ...
  
  // Passer automatiquement à la suivante si disponible
  if (queue.tracks.size > 0) {
    setImmediate(async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (!queue) return;
        const stillExists = this.player.nodes.get(queue.guild.id);
        if (!stillExists || stillExists !== queue) return;
        
        logger.info(`Passage automatique à la musique suivante dans ${queue.guild.name}`);
        queue.node.skip(); // ⚠️ CET APPEL PEUT CAUSER UNE RÉCURSION
      } catch (skipError) {
        // ...
      }
    });
  }
});
```

**Autres appels à `play()` et `skip()`:**
- Lignes 438, 473: `queue.node.play()` - protégés avec setImmediate + setTimeout
- Ligne 516: `queue.node.skip()` - méthode publique, pas protégée
- Lignes 498-501: `queue.node.pause()`, `queue.node.resume()` - appels directs

---

### 2. Commande Play
**Fichier:** `src/commands/music/play.ts`

**Tous les appels `queue.node.play()` sont protégés:**
- Lignes 394, 435, 516, 555: Tous dans `setImmediate` + `setTimeout` (100ms)

**Problème potentiel:**
- La commande appelle `musicService.play()` qui elle-même appelle `queue.node.play()` avec protection
- Mais il y a aussi des appels directs dans `play.ts` - double appel possible ?

---

### 3. Gestion des événements Discord
**Fichier:** `src/events/interactionCreate.ts`

```typescript
// Ligne 254: Appel à skip() sans protection visible
musicService.skip(queue);
```

**Méthode skip() dans MusicService:**
```typescript
skip(queue: Queue): Track | null {
  return queue.node.skip(); // Appel direct, non protégé
}
```

---

### 4. Configuration du Player
**Fichier:** `src/services/MusicService.ts` - Lignes 124-240

**Handlers d'événements enregistrés:**
1. `player.events.on('error')` - Ligne 125
2. `player.events.on('playerError')` - Ligne 129
3. `player.events.on('audioTrackAdd')` - Ligne 247
4. `player.events.on('audioTracksAdd')` - Ligne 251
5. `player.events.on('disconnect')` - Ligne 255
6. `player.events.on('emptyChannel')` - Ligne 260
7. `player.events.on('playerStart')` - **DÉSACTIVÉ** (lignes 275-280)

**⚠️ POINT CRITIQUE:** Le handler `playerStart` est désactivé. Si discord-player s'attend à ce qu'un handler existe et tente de le déclencher de manière récursive, cela pourrait causer le problème.

---

### 5. Création des queues
**Fichier:** `src/services/MusicService.ts` - Lignes 342-360

**Métadonnées de la queue:**
```typescript
queue = this.player.nodes.create(channel.guild, {
  metadata: {
    channelId: textChannel.id,
    guildId: channel.guild.id,
    // NE JAMAIS inclure 'channel' ou 'client' - cause récursion infinie dans discord.js toJSON()
  },
  volume: await this.getDefaultVolume(channel.guild.id),
  leaveOnEmpty: true,
  leaveOnEmptyCooldown: 300000,
  leaveOnEnd: false,
  leaveOnStop: false,
});
```

**✅ CORRIGÉ:** Les métadonnées ne contiennent plus d'objets complexes (channel, client) qui causaient une récursion lors de la sérialisation JSON.

---

### 6. Utilitaires d'embeds
**Fichier:** `src/utils/musicEmbeds.ts`

**Accès aux propriétés de queue:**
```typescript
// Lignes 238-248: Accès avec vérification
if (queue.node && typeof queue.node.getTimestamp === 'function') {
  timestamp = queue.node.getTimestamp();
}
if (queue.node && typeof queue.node.isPaused === 'function') {
  paused = queue.node.isPaused();
}
```

**✅ PROTÉGÉ:** Les accès sont vérifiés avant utilisation.

---

## Hypothèses sur la source de la récursion

### Hypothèse 1: `queue.node.skip()` dans `playerError`
Le handler `playerError` appelle `queue.node.skip()` qui pourrait déclencher un nouvel événement `playerStart` ou `playerError`, créant une boucle infinie.

**Solution proposée:**
- Désactiver temporairement le skip automatique dans `playerError`
- Ou utiliser un flag pour éviter les appels récursifs

### Hypothèse 2: Double appel à `play()`
Il pourrait y avoir un double appel:
1. Dans `musicService.play()` (protégé)
2. Dans `play.ts` après l'ajout de la track (protégé)

Si les deux se déclenchent en même temps, cela pourrait causer une récursion.

### Hypothèse 3: Handler `playerStart` manquant
Le handler `playerStart` est désactivé. Si discord-player s'attend à ce qu'un handler existe et tente de le déclencher de manière récursive en cas d'absence, cela pourrait être la cause.

### Hypothèse 4: Bug dans discord-player
La récursion pourrait être interne à `discord-player` lors de l'appel à `queue.node.play()`. Cela nécessiterait une mise à jour de la bibliothèque ou un workaround.

### Hypothèse 5: `audioTrackAdd` ou `audioTracksAdd` déclenchent `play()`
Les handlers `audioTrackAdd` et `audioTracksAdd` sont enregistrés mais ne font que logger. Si discord-player appelle automatiquement `play()` après ces événements, et qu'un autre code appelle aussi `play()`, cela pourrait créer une récursion.

---

## Fichiers Complets pour Analyse

### Fichier 1: src/services/MusicService.ts
```typescript
import {
  Client,
  VoiceBasedChannel,
  EmbedBuilder,
  GuildMember,
  TextBasedChannel,
} from 'discord.js';
import { Player, Track, QueueRepeatMode, GuildQueue } from 'discord-player';
import { YoutubeiExtractor } from 'discord-player-youtubei';
import { SpotifyExtractor, SoundCloudExtractor } from '@discord-player/extractor';

// Type alias pour la lisibilité
type Queue = GuildQueue;
import { logger } from './LoggerService';
import { prisma } from '../database/client';
import { createErrorEmbed } from '../utils/embeds';
import { createNowPlayingEmbed as createNowPlayingEmbedUtil } from '../utils/musicEmbeds';

/**
 * Service de gestion de la musique
 */
export class MusicService {
  private player: Player;
  private nowPlayingMessages: Map<string, string> = new Map(); // guildId -> messageId
  private extractorsReady: boolean = false;

  private constructor(client: Client) {
    this.player = new Player(client, {
      ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      },
      connectionTimeout: 30000,
    });

    this.setupPlayer();
    this.setupPlayerEvents(client);
  }

  static async create(client: Client): Promise<MusicService> {
    const service = new MusicService(client);
    await service.initializeExtractors();
    return service;
  }

  private async initializeExtractors(): Promise<void> {
    try {
      logger.info('🔄 Chargement des extracteurs...');
      let extractorsLoaded = false;

      try {
        await this.player.extractors.register(YoutubeiExtractor, {});
        logger.info('✅ YouTubei extractor enregistré');
        extractorsLoaded = true;
      } catch (error) {
        logger.error('❌ Erreur lors de l\'enregistrement de YouTubei extractor:', error);
        throw error;
      }

      try {
        await this.player.extractors.register(SpotifyExtractor, {});
        logger.info('✅ Spotify extractor enregistré');
      } catch (error) {
        logger.warn('⚠️ Spotify extractor non disponible:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      try {
        await this.player.extractors.register(SoundCloudExtractor, {});
        logger.info('✅ SoundCloud extractor enregistré');
      } catch (error) {
        logger.debug('ℹ️ SoundCloud extractor non disponible (optionnel)');
      }

      if (!extractorsLoaded) {
        logger.error('❌ AUCUN EXTRACTEUR CHARGÉ !');
        throw new Error('Aucun extracteur n\'a pu être chargé');
      }

      this.extractorsReady = true;
      const extractorCount = this.player.extractors.size;
      logger.info(`✅ ${extractorCount} extracteur(s) chargé(s) avec succès`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      logger.error('❌ ERREUR CRITIQUE: Impossible de charger les extracteurs', error);
      this.extractorsReady = false;
      throw error;
    }
  }

  isReady(): boolean {
    return this.extractorsReady;
  }

  private setupPlayer(): void {
    this.player.events.on('error', (error) => {
      logger.error('Erreur du lecteur audio:', error);
    });

    this.player.events.on('playerError', async (queue, error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);

      if (
        errorString.includes('[YOUTUBEJS]') ||
        errorString.includes('InnertubeError') ||
        errorString.includes('ListView not found') ||
        errorString.includes('ParsingError')
      ) {
        logger.debug(`Erreur YouTube.js non critique ignorée: ${errorMessage.substring(0, 100)}`);
        return;
      }

      logger.error(`Erreur dans la queue ${queue.guild.id}:`, {
        error: errorMessage,
        guildId: queue.guild.id,
      });

      let channel: TextBasedChannel | undefined;
      try {
        const channelId = (queue.metadata as any)?.channelId;
        if (channelId && queue.guild) {
          const fetchedChannel = await queue.guild.channels.fetch(channelId);
          if (fetchedChannel?.isTextBased()) {
            channel = fetchedChannel;
          }
        }
      } catch {
        // Ignorer
      }

      if (channel?.isTextBased()) {
        try {
          await channel.send({
            embeds: [
              createErrorEmbed({
                title: '❌ Erreur de lecture',
                description: `Impossible de lire **${queue.currentTrack?.title || 'la musique'}**\n\n${
                  errorMessage.includes('Premium') || errorMessage.includes('extract stream')
                    ? 'Cette vidéo nécessite YouTube Premium ou n\'est pas accessible.'
                    : 'Une erreur est survenue lors de la lecture.'
                }`,
                guild: queue.guild,
              }),
            ],
          });
        } catch (sendError) {
          logger.debug('Impossible de notifier l\'erreur au canal', {
            error: sendError instanceof Error ? sendError.message : String(sendError),
          });
        }
      }

      if (queue.tracks.size > 0) {
        setImmediate(async () => {
          try {
            await new Promise(resolve => setTimeout(resolve, 50));
            
            if (!queue) return;
            const stillExists = this.player.nodes.get(queue.guild.id);
            if (!stillExists || stillExists !== queue) return;
            
            logger.info(`Passage automatique à la musique suivante dans ${queue.guild.name}`);
            queue.node.skip(); // ⚠️ APPEL POTENTIELLEMENT RÉCURSIF
          } catch (skipError) {
            const errorMsg = skipError instanceof Error ? skipError.message : String(skipError);
            if (!errorMsg.includes('Maximum call stack')) {
              logger.error('Impossible de skip après erreur:', skipError);
            }
            try {
              if (queue) {
                const stillExists = this.player.nodes.get(queue.guild.id);
                if (stillExists && stillExists === queue) {
                  queue.delete();
                  this.removeNowPlayingMessage(queue.guild.id);
                }
              }
            } catch {
              // Ignorer
            }
          }
        });
      } else {
        logger.info(`Aucune musique suivante, arrêt de la queue dans ${queue.guild.name}`);
        setImmediate(() => {
          try {
            if (queue) {
              const stillExists = this.player.nodes.get(queue.guild.id);
              if (stillExists && stillExists === queue) {
                queue.delete();
                this.removeNowPlayingMessage(queue.guild.id);
              }
            }
          } catch {
            // Ignorer
          }
        });
      }
    });
  }

  private setupPlayerEvents(_client: Client): void {
    this.player.events.on('audioTrackAdd', (queue, track) => {
      logger.debug(`Musique ajoutée: ${track.title} dans ${queue.guild.name}`);
    });

    this.player.events.on('audioTracksAdd', (queue, tracks) => {
      logger.debug(`${tracks.length} musiques ajoutées dans ${queue.guild.name}`);
    });

    this.player.events.on('disconnect', (queue) => {
      logger.info(`Déconnexion du canal vocal dans ${queue.guild.name}`);
      this.removeNowPlayingMessage(queue.guild.id);
    });

    this.player.events.on('emptyChannel', (queue) => {
      logger.info(`Canal vocal vide dans ${queue.guild.name}`);
      setTimeout(() => {
        if (queue && !queue.connection) {
          queue.delete();
          this.removeNowPlayingMessage(queue.guild.id);
        }
      }, 300000);
    });

    logger.warn('⚠️ [DIAGNOSTIC] Handler playerStart TEMPORAIREMENT DÉSACTIVÉ pour test');
  }

  async canControlMusic(member: GuildMember, queue: Queue | null): Promise<boolean> {
    if (!queue) return false;
    try {
      const config = await prisma.musicConfig.findUnique({
        where: { guildId: queue.guild.id },
      });
      if (!config?.djRole) return true;
      return (
        member.roles.cache.has(config.djRole) ||
        member.id === queue.guild.ownerId ||
        member.permissions.has('Administrator')
      );
    } catch (error) {
      logger.debug(`Base de données non disponible pour canControlMusic, autorisation pour tous`);
      return true;
    }
  }

  async joinVoiceChannel(
    channel: VoiceBasedChannel,
    textChannel: TextBasedChannel
  ): Promise<Queue> {
    try {
      const botMember = channel.guild.members.me;
      if (!botMember) {
        throw new Error('Le bot n\'est pas membre du serveur');
      }

      const permissions = channel.permissionsFor(botMember);
      if (!permissions) {
        throw new Error('Impossible de vérifier les permissions');
      }

      if (!permissions.has('Connect')) {
        throw new Error('❌ Je n\'ai pas la permission de me connecter à ce canal vocal');
      }

      if (!permissions.has('Speak')) {
        throw new Error('❌ Je n\'ai pas la permission de parler dans ce canal vocal');
      }

      let queue = this.player.nodes.get(channel.guild.id);
      if (queue) {
        return queue;
      }

      queue = this.player.nodes.create(channel.guild, {
        metadata: {
          channelId: textChannel.id,
          guildId: channel.guild.id,
        },
        volume: await this.getDefaultVolume(channel.guild.id),
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000,
        leaveOnEnd: false,
        leaveOnStop: false,
      });

      if (!queue.connection) {
        await queue.connect(channel);
      }

      return queue;
    } catch (error) {
      logger.error('Erreur lors de la connexion au canal vocal:', error);
      throw error;
    }
  }

  async play(
    query: string,
    member: GuildMember,
    channel: TextBasedChannel
  ): Promise<{ track: Track; queue: Queue }> {
    const guildId = member.guild.id;
    
    try {
      let queue = this.player.nodes.get(guildId);

      if (!queue) {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          throw new Error('Vous devez être dans un canal vocal !');
        }
        queue = await this.joinVoiceChannel(voiceChannel, channel);
      }

      if (!queue) {
        throw new Error('Impossible de créer ou récupérer la queue');
      }

      let maxQueueSize = 100;
      try {
        const config = await prisma.musicConfig.findUnique({
          where: { guildId },
        });
        maxQueueSize = config?.maxQueueSize || 100;
      } catch (error) {
        logger.debug(`Base de données non disponible pour vérifier maxQueueSize, utilisation de la valeur par défaut (100)`);
      }

      if (queue.tracks.size >= maxQueueSize) {
        throw new Error(`La file d'attente est pleine (maximum ${maxQueueSize} musiques)`);
      }

      const result = await this.player.search(query, {
        requestedBy: member.user,
      });

      if (!result.hasTracks()) {
        throw new Error('Aucun résultat trouvé pour cette recherche !');
      }

      if (result.playlist) {
        queue.tracks.add(result.tracks);
        
        const isCurrentlyPlaying = queue.node.isPlaying();
        const isCurrentlyPaused = queue.node.isPaused();
        
        if (!isCurrentlyPlaying && !isCurrentlyPaused) {
          logger.info(`🎵 [PLAY] Démarrage playlist dans ${member.guild.name} (${result.tracks.length} tracks)`);
          
          setImmediate(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
              if (queue && !queue.node.isPlaying() && !queue.node.isPaused() && queue.tracks.size > 0) {
                await queue.node.play();
                logger.info(`✅ [PLAY] Playlist démarrée avec succès`);
              }
            } catch (playError) {
              const errorMsg = playError instanceof Error ? playError.message : String(playError);
              if (!errorMsg.includes('Maximum call stack')) {
                logger.error(`❌ [PLAY] Erreur lors du play() playlist:`, playError);
              }
            }
          });
        }
        
        return { track: result.tracks[0], queue };
      } else {
        const track = result.tracks[0];
        queue.tracks.add(track);
        
        const isCurrentlyPlaying = queue.node.isPlaying();
        const isCurrentlyPaused = queue.node.isPaused();
        
        if (!isCurrentlyPlaying && !isCurrentlyPaused) {
          logger.info(`🎵 [PLAY] Démarrage track "${track.title}" dans ${member.guild.name}`);
          
          setImmediate(async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            try {
              if (queue && !queue.node.isPlaying() && !queue.node.isPaused() && queue.tracks.size > 0) {
                await queue.node.play();
                logger.info(`✅ [PLAY] Track démarré avec succès`);
              }
            } catch (playError) {
              const errorMsg = playError instanceof Error ? playError.message : String(playError);
              if (!errorMsg.includes('Maximum call stack')) {
                logger.error(`❌ [PLAY] Erreur lors du play() track:`, playError);
              }
            }
          });
        }
        
        return { track, queue };
      }
    } catch (error) {
      logger.error('Erreur lors de la lecture:', error);
      throw error;
    }
  }

  pause(queue: Queue): void {
    if (queue.node.isPaused()) {
      queue.node.resume();
    } else {
      queue.node.pause();
    }
  }

  stop(queue: Queue): void {
    queue.delete();
  }

  skip(queue: Queue): Track | null {
    return queue.node.skip(); // ⚠️ APPEL DIRECT, NON PROTÉGÉ
  }

  back(queue: Queue): void {
    if (queue.history.size > 0) {
      queue.history.back();
    }
  }

  setVolume(queue: Queue, volume: number): void {
    queue.node.setVolume(Math.max(0, Math.min(100, volume)));
  }

  setLoopMode(queue: Queue, mode: QueueRepeatMode): void {
    queue.setRepeatMode(mode);
  }

  shuffle(queue: Queue): void {
    queue.tracks.shuffle();
  }

  remove(queue: Queue, index: number): Track | null {
    const track = queue.tracks.at(index - 1);
    if (track) {
      queue.tracks.remove(track);
      return track;
    }
    return null;
  }

  async seek(queue: Queue, position: number): Promise<void> {
    if (!queue.currentTrack) {
      throw new Error('Aucune musique en cours de lecture');
    }

    const duration = queue.currentTrack.durationMS;
    const seekPosition = Math.max(0, Math.min(position * 1000, duration));
    await queue.node.seek(seekPosition);
  }

  async getDefaultVolume(guildId: string): Promise<number> {
    try {
      const config = await prisma.musicConfig.findUnique({
        where: { guildId },
      });
      return config?.defaultVolume || 50;
    } catch (error) {
      logger.debug(`Base de données non disponible pour getDefaultVolume, utilisation de la valeur par défaut (50)`);
      return 50;
    }
  }

  getQueue(guildId: string): Queue | null {
    return this.player.nodes.get(guildId) || null;
  }

  createNowPlayingEmbed(queue: Queue): EmbedBuilder {
    return createNowPlayingEmbedUtil(queue);
  }

  async searchTracks(
    query: string,
    requestedBy: GuildMember['user'],
    limit: number = 10
  ): Promise<{ tracks: Track[]; playlist?: any }> {
    if (!this.extractorsReady) {
      throw new Error('⏳ Extracteurs en cours de chargement, veuillez patienter...');
    }

    const sanitizedQuery = query.trim();
    if (sanitizedQuery.length < 2) {
      throw new Error('La recherche doit contenir au moins 2 caractères');
    }

    if (sanitizedQuery.length > 200) {
      throw new Error('La recherche ne peut pas dépasser 200 caractères');
    }

    try {
      const result = await this.player.search(sanitizedQuery, {
        requestedBy,
        fallbackSearchEngine: 'youtube',
      });

      if (!result.hasTracks()) {
        throw new Error('Aucun résultat trouvé pour cette recherche !');
      }

      const limitedTracks = limit > 0 ? result.tracks.slice(0, limit) : result.tracks;

      return {
        tracks: limitedTracks,
        playlist: result.playlist || undefined,
      };
    } catch (error) {
      logger.error('Erreur lors de la recherche:', { query: sanitizedQuery, error });
      throw error;
    }
  }

  getRepeatModeText(mode: QueueRepeatMode): string {
    switch (mode) {
      case QueueRepeatMode.TRACK:
        return '🔂 Musique';
      case QueueRepeatMode.QUEUE:
        return '🔁 File';
      case QueueRepeatMode.AUTOPLAY:
        return '♾️ Autoplay';
      default:
        return '❌ Désactivé';
    }
  }

  saveNowPlayingMessage(guildId: string, messageId: string): void {
    this.nowPlayingMessages.set(guildId, messageId);
  }

  getNowPlayingMessage(guildId: string): string | undefined {
    return this.nowPlayingMessages.get(guildId);
  }

  removeNowPlayingMessage(guildId: string): void {
    this.nowPlayingMessages.delete(guildId);
  }
}
```

### Fichier 2: src/commands/music/play.ts
**Lignes critiques:**
- Lignes 394, 435, 516, 555: `await queue.node.play()` - tous protégés avec `setImmediate` + `setTimeout` (100ms)
- **IMPORTANT:** Cette commande N'UTILISE PAS `musicService.play()`. Elle fait tout manuellement:
  1. Récupère/crée la queue
  2. Recherche les tracks avec `musicService.searchTracks()`
  3. Ajoute les tracks avec `queue.tracks.add()`
  4. Appelle directement `queue.node.play()`
- Il y a donc DEUX chemins: `musicService.play()` (dans MusicService.ts) et le chemin manuel (dans play.ts)

### Fichier 3: src/events/interactionCreate.ts
**Ligne critique:**
- Ligne 254: `musicService.skip(queue)` - appelle directement `queue.node.skip()` via la méthode publique `skip()` qui n'est PAS protégée
- Ligne 244: `musicService.createNowPlayingEmbed(queue)` - peut accéder à `queue.node` pour créer l'embed

### Fichier 4: src/utils/musicEmbeds.ts
**Lignes critiques:**
- Lignes 238-248: Accès à `queue.node.getTimestamp()`, `queue.node.isPaused()`, `queue.node.volume`
- **PROTÉGÉ:** Tous les accès sont dans des try-catch avec vérifications de type

### Fichier 5: src/core/Bot.ts
- Initialise `MusicService` de manière asynchrone
- Attache le bot au client: `(this.client as any).bot = this;`

### Fichier 6: src/index.ts
- Filtre les erreurs "Maximum call stack size exceeded" mais continue de logger
- Intercepte `console.error` et `console.warn` pour supprimer les logs YouTube.js

### Fichier 7: package.json
```json
{
  "name": "MaruBot",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "@discord-player/extractor": "^4.4.0",
    "discord-player": "^6.6.0",
    "discord-player-youtubei": "^1.5.0",
    "discord.js": "^14.14.1"
  }
}
```

---

## Logs d'erreur observés

```
2025-12-07 18:09:02 [error]: ⚠️ Maximum call stack size exceeded détecté - possible récursion infinie: {"service":"MaruBot","error":{"error":"Maximum call stack size exceeded"}}
```

**Contexte:**
- La musique est trouvée avec succès
- Le bot se connecte au canal vocal
- La lecture ne démarre pas
- L'erreur se produit immédiatement après l'appel à `/play`

---

## Actions recommandées pour l'analyse

1. **Activer des logs détaillés avec stack traces** avant chaque appel à `queue.node.play()` et `queue.node.skip()`
2. **Désactiver temporairement** le skip automatique dans `playerError`
3. **Réactiver le handler `playerStart`** avec une protection anti-récursion stricte
4. **Vérifier la compatibilité** des versions discord-player et discord.js
5. **Isoler l'appel à `play()`** pour voir si la récursion vient de discord-player lui-même
6. **Utiliser un débogueur Node.js** pour capturer la stack trace complète au moment de la récursion

---

## Questions à résoudre

1. La récursion se produit-elle avant ou après l'appel à `queue.node.play()` ?
2. Quel est l'ordre exact des appels dans la stack trace ?
3. Y a-t-il des événements discord-player qui se déclenchent en boucle ?
4. Le problème est-il spécifique à certaines musiques/URLs ou général ?
5. La récursion se produit-elle à chaque appel ou seulement parfois ?

---

---

## Points critiques identifiés

### ⚠️ CRITIQUE 1: `skip()` non protégé
**Fichier:** `src/services/MusicService.ts` - Ligne 516
- La méthode publique `skip()` appelle directement `queue.node.skip()` sans protection
- Utilisée dans `interactionCreate.ts` ligne 254
- Utilisée dans `playerError` handler ligne 203

### ⚠️ CRITIQUE 2: Double chemin pour jouer de la musique
**Fichiers:** `MusicService.ts` ET `play.ts`
- `MusicService.play()` existe mais n'est PAS utilisée dans `play.ts`
- `play.ts` gère tout manuellement et appelle directement `queue.node.play()`
- **OK pour l'instant, mais `musicService.play()` est toujours appelée depuis `playlist.ts` ligne 272**
- **Si `playlist.ts` utilise `musicService.play()`, et que cette méthode ajoute la track puis appelle `play()`, et que ensuite un handler déclenche un autre `play()`, récursion possible**

### ⚠️ CRITIQUE 3: Handler `playerStart` désactivé
- Le handler `playerStart` est complètement désactivé
- Si discord-player attend ce handler et déclenche des événements de manière récursive en son absence, cela pourrait être la cause

### ⚠️ CRITIQUE 4: `queue.node.skip()` dans `playerError`
- Même avec `setImmediate`, si `skip()` déclenche un `playerError` qui déclenche un `skip()`, récursion infinie

---

## Solutions à tester immédiatement (par ordre de priorité)

### Solution 1 (PRIORITÉ MAXIMALE): Désactiver complètement le skip automatique dans `playerError`
**Fichier:** `src/services/MusicService.ts` lignes 188-239
Temporairement commenter TOUT le bloc qui appelle `queue.node.skip()` dans le handler `playerError`.
**Hypothèse:** `skip()` déclenche un `playerError` → `playerError` appelle `skip()` → boucle infinie

### Solution 2: Protéger la méthode `skip()` publique avec flag anti-récursion
**Fichier:** `src/services/MusicService.ts` ligne 515
```typescript
private processingSkip: Set<string> = new Set(); // guildId en cours de skip

skip(queue: Queue): Track | null {
  const guildId = queue.guild.id;
  
  // Protection anti-récursion stricte
  if (this.processingSkip.has(guildId)) {
    logger.warn(`⚠️ Skip déjà en cours pour ${guildId}, ignoré`);
    return null;
  }
  
  this.processingSkip.add(guildId);
  
  try {
    return queue.node.skip();
  } finally {
    // Retirer le flag après un court délai
    setTimeout(() => {
      this.processingSkip.delete(guildId);
    }, 200);
  }
}
```

### Solution 3: Ajouter un flag pour désactiver le skip automatique si erreur récursive
**Fichier:** `src/services/MusicService.ts` dans `playerError` handler
Détecter si l'erreur est "Maximum call stack" et ne PAS appeler `skip()` dans ce cas.

### Solution 4: Réactiver `playerStart` avec handler minimal vide
**Fichier:** `src/services/MusicService.ts` lignes 275-284
Ajouter un handler `playerStart` qui ne fait QUE logger, sans aucune autre action:
```typescript
this.player.events.on('playerStart', (queue, track) => {
  logger.info(`🎵 Musique démarrée: ${track.title} dans ${queue.guild.name}`);
  // RIEN D'AUTRE - handler minimal pour éviter récursion
});
```

### Solution 5: Vérifier que `play.ts` n'utilise PAS `musicService.play()`
**VÉRIFIÉ:** `play.ts` n'appelle PAS `musicService.play()`, donc pas de double appel.
**MAIS:** `playlist.ts` ligne 272 utilise `musicService.play()`, ce qui pourrait causer un conflit.

---

---

## Résumé exécutif

Le problème de récursion "Maximum call stack size exceeded" est **très probablement causé par**:

1. **`queue.node.skip()` dans le handler `playerError`** (ligne 203 de MusicService.ts)
   - Si `skip()` déclenche un nouvel `playerError`, boucle infinie garantie
   - **ACTION IMMÉDIATE:** Désactiver ce skip automatique temporairement

2. **Méthode `skip()` publique non protégée** (ligne 516 de MusicService.ts)
   - Appelée depuis `interactionCreate.ts` ligne 254
   - Aucune protection anti-récursion

3. **Handler `playerStart` désactivé**
   - Si discord-player s'attend à ce handler et tente de le déclencher de manière récursive, problème possible

### Test immédiat recommandé

**Étape 1:** Commenter complètement le bloc `queue.node.skip()` dans `playerError` (lignes 188-239)
**Étape 2:** Tester si la récursion disparaît
**Étape 3:** Si oui → le problème vient du skip automatique
**Étape 4:** Si non → le problème vient d'ailleurs (probablement discord-player lui-même)

---

---

## FICHIERS COMPLETS - Code Source Complet pour Analyse

### ⚠️ IMPORTANT: Les fichiers complets sont disponibles via les outils de lecture de fichier
Pour une analyse complète, Claude devra lire directement:
- `src/services/MusicService.ts` (746 lignes)
- `src/commands/music/play.ts` (596 lignes)  
- `src/events/interactionCreate.ts` (320 lignes)
- `src/utils/musicEmbeds.ts` (432 lignes)
- `src/core/Bot.ts` (156 lignes)
- `src/index.ts` (109 lignes)
- `package.json` (76 lignes)

Tous ces fichiers sont déjà analysés ci-dessus avec leurs lignes critiques identifiées.

---

**Document créé le:** 2025-12-07 18:15  
**Dernière analyse:** Analyse approfondie complète avec tous les fichiers  
**Statut:** 4 points critiques identifiés - Solution prioritaire: Désactiver skip automatique dans playerError  
**Fichier généré pour:** Analyse par Claude AI  
**Action recommandée:** Commencer par désactiver le skip automatique dans `playerError` handler (lignes 346-391 de MusicService.ts)

