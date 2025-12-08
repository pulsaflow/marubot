# 🔍 Analyse Finale - Récursion "Maximum call stack size exceeded"

## 📊 Stack Trace du Problème

```
RangeError: Maximum call stack size exceeded
    at flatten (discord.js/src/util/Util.js:21:17)
    at flatten (discord.js/src/util/Util.js:52:58)
    at Client.toJSON (discord.js/src/client/BaseClient.js:107:12)
    at Client.toJSON (discord.js/src/client/Client.js:503:18)
```

**Diagnostic** : Discord.js tente de sérialiser le `Client` qui contient une référence circulaire. Cela se produit DANS `queue.node.play()`, probablement lorsqu'il essaie de logger ou sérialiser quelque chose.

---

## 📁 Fichiers Pertinents

### 1. `src/services/MusicService.ts`

```typescript
import { Player } from 'discord-player';
import { Client, GuildMember, TextBasedChannel, VoiceBasedChannel, EmbedBuilder } from 'discord.js';
import { Track, GuildQueue as Queue, QueueRepeatMode } from 'discord-player';
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
  private processingSkip: Set<string> = new Set(); // guildId en cours de skip - protection anti-récursion
  private playingGuilds: Set<string> = new Set(); // guildId en cours de play() - protection anti-récursion

  private constructor(client: Client) {
    // Créer une instance de Player au lieu d'utiliser useMainPlayer
    this.player = new Player(client, {
      ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      },
      connectionTimeout: 30000,
    });

    // ✅ LOGS DE DEBUG TEMPORAIRES - DIAGNOSTIC
    this.player.events.on('debug', (message) => {
      logger.debug(`[discord-player] ${message}`);
    });

    // ✅ Réactiver playerStart TEMPORAIREMENT pour diagnostic (logs uniquement)
    this.player.events.on('playerStart', (queue, track) => {
      logger.info(`[EVENT playerStart] Track: ${track.title}, Guild: ${queue.guild.name}`);
      try {
        logger.info(`[EVENT playerStart] State: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        logger.info(`[EVENT playerStart] Connection: ${queue.connection?.state?.status || 'UNKNOWN'}`);
        logger.info(`[EVENT playerStart] Current track: ${queue.currentTrack?.title || 'NULL'}`);
      } catch (error) {
        logger.error(`[EVENT playerStart] Erreur lors de la lecture des infos:`, error);
      }
    });

    this.player.events.on('audioTrackAdd', (queue, track) => {
      logger.info(`[EVENT audioTrackAdd] ${track.title} dans ${queue.guild.name}, queue size=${queue.tracks.size}`);
    });

    this.player.events.on('audioTracksAdd', (queue, tracks) => {
      logger.info(`[EVENT audioTracksAdd] ${tracks.length} tracks ajoutés dans ${queue.guild.name}, queue size=${queue.tracks.size}`);
    });

    this.setupPlayer();
    this.setupPlayerEvents(client);
  }

  /**
   * Factory method pour créer et initialiser le MusicService
   */
  static async create(client: Client): Promise<MusicService> {
    const service = new MusicService(client);
    await service.initializeExtractors();
    return service;
  }

  /**
   * Initialise les extracteurs de manière asynchrone
   */
  private async initializeExtractors(): Promise<void> {
    try {
      logger.info('🔄 Chargement des extracteurs...');

      let extractorsLoaded = false;

      // Enregistrer YouTubei (extracteur YouTube amélioré et stable)
      try {
        await this.player.extractors.register(YoutubeiExtractor, {});
        logger.info('✅ YouTubei extractor enregistré (extracteur YouTube stable)');
        extractorsLoaded = true;
      } catch (error) {
        logger.error('❌ Erreur lors de l\'enregistrement de YouTubei extractor:', error);
        throw error;
      }

      // Enregistrer Spotify extractor
      try {
        await this.player.extractors.register(SpotifyExtractor, {});
        logger.info('✅ Spotify extractor enregistré');
        extractorsLoaded = true;
      } catch (error) {
        logger.warn('⚠️ Spotify extractor non disponible:', error);
      }

      // Enregistrer SoundCloud extractor
      try {
        await this.player.extractors.register(SoundCloudExtractor, {});
        logger.info('✅ SoundCloud extractor enregistré');
        extractorsLoaded = true;
      } catch (error) {
        logger.warn('⚠️ SoundCloud extractor non disponible:', error);
      }

      if (!extractorsLoaded) {
        throw new Error('Aucun extracteur n\'a pu être chargé');
      }

      this.extractorsReady = true;
      logger.info('✅ Tous les extracteurs sont prêts !');

      // Attendre un peu pour s'assurer que tout est bien initialisé
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      logger.error('❌ ERREUR CRITIQUE: Impossible de charger les extracteurs', error);
      this.extractorsReady = false;
      throw new Error(
        `Le module musique ne peut pas démarrer: ${error instanceof Error ? error.message : 'Erreur inconnue'}\nVérifiez que discord-player-youtubei est bien installé: npm install discord-player-youtubei`
      );
    }
  }

  /**
   * Vérifie si les extracteurs sont prêts
   */
  isReady(): boolean {
    return this.extractorsReady;
  }

  /**
   * Configure le lecteur audio
   */
  private setupPlayer(): void {
    this.player.events.on('error', (error) => {
      logger.error('Erreur du lecteur audio:', error);
    });

    this.player.events.on('playerError', async (queue, error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorString = String(error);

      // Ignorer les erreurs YouTube.js (warnings du parser, non critiques)
      if (
        errorString.includes('[YOUTUBEJS]') ||
        errorString.includes('InnertubeError') ||
        errorString.includes('ListView not found') ||
        errorString.includes('ParsingError')
      ) {
        logger.debug(`Erreur YouTube.js non critique ignorée: ${errorMessage.substring(0, 100)}`);
        return; // Ignorer ces erreurs
      }

      logger.error(`[EVENT playerError] Erreur dans la queue ${queue.guild.id}:`, {
        error: errorMessage,
        errorString: errorString.substring(0, 200),
        guildId: queue.guild.id,
        currentTrack: queue.currentTrack?.title || 'NULL',
        queueSize: queue.tracks.size,
        connectionStatus: queue.connection?.state?.status || 'NULL',
      });

      // Gérer les erreurs spécifiques
      // Récupérer le channel depuis l'ID (metadata.channel causait récursion)
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
        // Ignorer si impossible de récupérer le channel
      }

      // Notifier l'utilisateur si possible
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
          // Ignorer si on ne peut pas envoyer le message
          logger.debug('Impossible de notifier l\'erreur au canal', {
            error: sendError instanceof Error ? sendError.message : String(sendError),
          });
        }
      }

      // ⚠️ DÉSACTIVÉ TEMPORAIREMENT - TEST DE DIAGNOSTIC
      logger.warn(`⚠️ [DIAGNOSTIC] Skip automatique DÉSACTIVÉ après playerError pour ${queue.guild.name} - test anti-récursion`);
    });
  }

  /**
   * Configure les événements du lecteur
   */
  private setupPlayerEvents(_client: Client): void {
    // Note: audioTrackAdd et audioTracksAdd sont déjà loggés dans le constructeur pour le diagnostic
    // On évite de les logger deux fois - ces handlers sont déjà enregistrés dans le constructeur

    this.player.events.on('disconnect', (queue) => {
      logger.info(`Déconnexion du canal vocal dans ${queue.guild.name}`);
      this.removeNowPlayingMessage(queue.guild.id);
    });

    this.player.events.on('emptyChannel', (queue) => {
      logger.info(`Canal vocal vide dans ${queue.guild.name}`);
      // Attendre 5 minutes avant de quitter
      setTimeout(() => {
        if (queue && !queue.connection) {
          queue.delete();
          this.removeNowPlayingMessage(queue.guild.id);
        }
      }, 300000);
    });

    // ✅ playerStart TOTALEMENT SUPPRIMÉ - Cause de récursion infinie identifiée
    // Si vous avez besoin d'un message "Now Playing", créez-le manuellement dans play.ts
  }

  /**
   * Rejoint le canal vocal
   */
  async joinVoiceChannel(
    channel: VoiceBasedChannel,
    textChannel: TextBasedChannel
  ): Promise<Queue> {
    try {
      // Vérifier les permissions du bot
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

      // Créer la queue avec metadata simplifié (éviter récursion lors sérialisation)
      // Stocker seulement l'ID du channel, pas l'objet complet
      queue = this.player.nodes.create(channel.guild, {
        metadata: {
          channelId: textChannel.id,
          guildId: channel.guild.id,
          // NE JAMAIS inclure 'channel' ou 'client' ici - cause récursion infinie dans discord.js toJSON()
        },
        volume: await this.getDefaultVolume(channel.guild.id),
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000, // 5 minutes
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

  /**
   * Joue une musique
   * PROTECTION ANTI-RÉCURSION : Vérifie si une lecture est déjà en cours avant d'appeler play()
   */
  async play(
    query: string,
    member: GuildMember,
    channel: TextBasedChannel
  ): Promise<{ track: Track; queue: Queue }> {
    const guildId = member.guild.id;
    
    // ✅ PROTECTION ANTI-RÉCURSION : Empêcher les appels multiples simultanés
    if (this.playingGuilds.has(guildId)) {
      logger.warn(`⚠️ Play() déjà en cours pour ${guildId}, blocage de l'appel dupliqué`);
      throw new Error('Une lecture est déjà en cours, veuillez patienter');
    }
    
    this.playingGuilds.add(guildId);
    
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

      // Vérifier la taille de la queue (avec fallback si DB indisponible)
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

      // Rechercher et ajouter la musique
      const result = await this.player.search(query, {
        requestedBy: member.user,
      });

      if (!result.hasTracks()) {
        throw new Error('Aucun résultat trouvé pour cette recherche !');
      }

      if (result.playlist) {
        queue.tracks.add(result.tracks);
        
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`🎵 [PLAY] Avant play() - Playlist (${result.tracks.length} tracks) dans ${member.guild.name}`);
          logger.info(`[PLAY] Queue state AVANT: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
          logger.info(`[PLAY] Connection AVANT: ${queue.connection ? 'EXISTS' : 'NULL'}`);
          logger.info(`[PLAY] Volume AVANT: ${queue.node.volume || 'NULL'}`);
          
          try {
            // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone
            await new Promise<void>((resolve, reject) => {
              process.nextTick(async () => {
                try {
                  await queue.node.play();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              });
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            logger.info(`✅ [PLAY] Après play() - Playlist`);
            logger.info(`[PLAY] Queue state APRÈS: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            logger.info(`[PLAY] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
            logger.info(`[PLAY] Connection APRÈS: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            logger.info(`[PLAY] Volume APRÈS: ${queue.node.volume || 'NULL'}`);
          } catch (playError) {
            const errorMsg = playError instanceof Error ? playError.message : String(playError);
            logger.error(`❌ [PLAY] Erreur lors du play() playlist:`, playError);
            if (!errorMsg.includes('Maximum call stack')) {
              throw playError;
            }
          }
        } else {
          logger.warn(`[PLAY] Playlist NON démarrée - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        }
        
        this.playingGuilds.delete(guildId);
        
        return { track: result.tracks[0], queue };
      } else {
        const track = result.tracks[0];
        queue.tracks.add(track);
        
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`🎵 [PLAY] Avant play() - Track unique: ${track.title} dans ${member.guild.name}`);
          logger.info(`[PLAY] Queue state AVANT: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
          logger.info(`[PLAY] Connection AVANT: ${queue.connection ? 'EXISTS' : 'NULL'}`);
          logger.info(`[PLAY] Volume AVANT: ${queue.node.volume || 'NULL'}`);
          
          try {
            // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone
            await new Promise<void>((resolve, reject) => {
              process.nextTick(async () => {
                try {
                  await queue.node.play();
                  resolve();
                } catch (error) {
                  reject(error);
                }
              });
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            logger.info(`✅ [PLAY] Après play() - Track unique`);
            logger.info(`[PLAY] Queue state APRÈS: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            logger.info(`[PLAY] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
            logger.info(`[PLAY] Connection APRÈS: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            logger.info(`[PLAY] Volume APRÈS: ${queue.node.volume || 'NULL'}`);
          } catch (playError) {
            const errorMsg = playError instanceof Error ? playError.message : String(playError);
            logger.error(`❌ [PLAY] Erreur lors du play() track:`, playError);
            if (!errorMsg.includes('Maximum call stack')) {
              throw playError;
            }
          }
        } else {
          logger.warn(`[PLAY] Track NON démarré - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        }
        
        this.playingGuilds.delete(guildId);
        
        return { track, queue };
      }
    } catch (error) {
      this.playingGuilds.delete(guildId);
      
      logger.error('Erreur lors de la lecture:', error);
      throw error;
    }
  }

  // ... autres méthodes (skip, pause, stop, etc.)
}
```

### 2. `src/commands/music/play.ts`

```typescript
// ... imports ...

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Joue une musique')
    .addStringOption(option =>
      option
        .setName('recherche')
        .setDescription('Nom de la musique, URL YouTube/Spotify ou playlist')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  autocomplete: async (interaction: AutocompleteInteraction) => {
    // ... autocomplete code ...
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // ... vérifications ...

    try {
      await interaction.editReply({
        content: '🔍 Traitement de votre demande...',
      });

      let queue = musicService.getQueue(interaction.guild!.id);

      if (!queue) {
        queue = await musicService.joinVoiceChannel(voiceChannel, interaction.channel as any);
      }

      const isUrl = /^https?:\/\//i.test(query);

      if (isUrl) {
        const searchResult = await musicService.searchTracks(query, member.user, 0);

        if (searchResult.playlist) {
          // ... playlist handling ...
          queue.tracks.add(tracks);
          if (!queue.node.isPlaying() && !queue.node.isPaused()) {
            logger.info(`[play.ts] Appel queue.node.play() - Playlist (${tracks.length} tracks)`);
            logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
            logger.info(`[play.ts] Connection status: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            try {
              // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone
              await new Promise<void>((resolve, reject) => {
                process.nextTick(async () => {
                  try {
                    await queue.node.play();
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                });
              });
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
              logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
            } catch (error) {
              logger.error(`[play.ts] Erreur lors de play() playlist:`, error);
            }
          }
          // ...
        } else {
          // Track unique
          queue.tracks.add(track);
          if (!queue.node.isPlaying() && !queue.node.isPaused()) {
            logger.info(`[play.ts] Appel queue.node.play() - Track unique: ${track.title}`);
            logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
            logger.info(`[play.ts] Connection status: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            try {
              // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone
              await new Promise<void>((resolve, reject) => {
                process.nextTick(async () => {
                  try {
                    await queue.node.play();
                    resolve();
                  } catch (error) {
                    reject(error);
                  }
                });
              });
              
              await new Promise(resolve => setTimeout(resolve, 500));
              
              logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
              logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
            } catch (error) {
              logger.error(`[play.ts] Erreur lors de play() track:`, error);
            }
          }
          // ...
        }
      } else {
        // Recherche manuelle
        // ... code similaire ...
      }
    } catch (error) {
      // ... error handling ...
    }
  },
} as Command;
```

### 3. `src/core/Bot.ts`

```typescript
// ... imports ...

export class Bot {
  public readonly client: Client;
  public readonly rest: REST;
  private commandRegistry: CommandRegistry;
  private eventHandler: EventHandler;
  public musicService: MusicService | null = null;

  constructor(token: string) {
    // ... initialization ...
  }

  async start(): Promise<void> {
    // ... setup ...

    // Initialiser le service de musique de manière asynchrone
    try {
      this.musicService = await MusicService.create(this.client);
      logger.info('✅ Module musique initialisé');
    } catch (error) {
      logger.error('❌ Impossible d\'initialiser le module musique:', error);
      this.musicService = null;
    }

    // ... reste de l'initialisation ...
  }

  // ...
}
```

---

## 🔍 Cause Identifiée

**Le problème** : `Client.toJSON()` est appelé en boucle lors de `queue.node.play()`. Cela signifie que quelque part dans `discord-player`, il essaie de sérialiser le `Client`.

**Hypothèse** : Le `Player` est créé avec le `client`, et quelque part dans le processus de `queue.node.play()`, discord-player essaie de logger ou sérialiser quelque chose qui contient une référence au `client`.

**Solution proposée** : Utiliser une version modifiée du `Player` qui ne stocke pas de référence directe au `client`, ou intercepter les appels `toJSON()` du `Client`.

---

## 💡 Solutions Possibles

### Solution 1 : Intercepter `Client.toJSON()`
Modifier temporairement le prototype de `Client.toJSON()` pour éviter la récursion.

### Solution 2 : Utiliser un proxy pour le client
Créer un proxy qui intercepte les accès aux propriétés du client.

### Solution 3 : Créer le Player sans référence au client
Créer le Player avec un client "mock" qui n'a pas de références circulaires.

---

**Fichier généré le** : 2025-12-07  
**Dernière erreur** : `Maximum call stack size exceeded` dans `Client.toJSON()`



