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
import fs from 'fs';

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
  // Variables pour playerStart handler (temporairement désactivé)
  // private playerStartHandlerRegistered: boolean = false;
  // private processingPlayerStart: Set<string> = new Set(); // guildId en cours de traitement
  // private playerStartCallCount: Map<string, number> = new Map(); // guildId -> nombre d'appels
  // private playerStartCallStack: Map<string, string[]> = new Map(); // guildId -> stack traces

  private constructor(client: Client) {
    // Note: L'interception de Client.toJSON() est déjà faite dans Bot.ts (constructeur)
    // Pas besoin de la refaire ici - cela éviterait même des conflits
    
    // ✅ Vérifier que FFmpeg est disponible
    const ffmpegPath = process.env.FFMPEG_PATH;
    if (!ffmpegPath) {
      logger.warn('⚠️ FFMPEG_PATH non défini - le module musique pourrait ne pas fonctionner');
    } else {
      // Vérifier que le fichier existe vraiment
      if (fs.existsSync(ffmpegPath)) {
        logger.info(`✅ FFmpeg trouvé et accessible: ${ffmpegPath}`);
      } else {
        logger.error(`❌ FFmpeg introuvable au chemin: ${ffmpegPath}`);
      }
    }
    
    // Créer une instance de Player au lieu d'utiliser useMainPlayer
    const playerOptions: any = {
      ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      },
      connectionTimeout: 30000,
    };
    
    // ✅ Spécifier explicitement le chemin FFmpeg si disponible
    if (ffmpegPath) {
      playerOptions.ffmpegPath = ffmpegPath;
      logger.info(`✅ Chemin FFmpeg configuré pour le Player: ${ffmpegPath}`);
    }
    
    this.player = new Player(client, playerOptions);

    // ✅ LOGS DE DEBUG TEMPORAIRES - DIAGNOSTIC
    this.player.events.on('debug', (message) => {
      logger.debug(`[discord-player] ${message}`);
    });

    // ✅ Réactiver playerStart TEMPORAIREMENT pour diagnostic (logs uniquement)
    // ⚠️ CRITIQUE : Ne PAS accéder à queue.connection?.state?.status - cause récursion
    this.player.events.on('playerStart', (queue, track) => {
      logger.info(`[EVENT playerStart] Track: ${track.title}, Guild: ${queue.guild.name}`);
      try {
        logger.info(`[EVENT playerStart] State: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        // ⚠️ NE PAS accéder à queue.connection?.state?.status - cause récursion dans Discord.js toJSON()
        logger.info(`[EVENT playerStart] Connection: ${queue.connection ? 'EXISTS' : 'NULL'}`);
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
      } catch (error) {
        logger.warn('⚠️ Spotify extractor non disponible:', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Enregistrer SoundCloud extractor (optionnel)
      try {
        await this.player.extractors.register(SoundCloudExtractor, {});
        logger.info('✅ SoundCloud extractor enregistré');
      } catch (error) {
        logger.debug('ℹ️ SoundCloud extractor non disponible (optionnel)');
      }

      if (!extractorsLoaded) {
        logger.error('❌ AUCUN EXTRACTEUR CHARGÉ ! Le module musique ne fonctionnera pas.');
        throw new Error('Aucun extracteur n\'a pu être chargé');
      }

      this.extractorsReady = true;

      const extractorCount = this.player.extractors.size;
      logger.info(`✅ ${extractorCount} extracteur(s) chargé(s) avec succès`);
      
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
      // ⚠️ IMPORTANT : L'événement 'error' peut recevoir une GuildQueue au lieu d'une Error
      // C'est un comportement étrange de discord-player, on doit le détecter
      if (error && typeof error === 'object' && 'guild' in error) {
        // C'est une queue, pas une erreur - ignorer ou logger différemment
        const queue = error as any;
        logger.warn(`⚠️ [EVENT error] Reçu une GuildQueue au lieu d'une Error - Guild: ${queue.guild?.name || 'unknown'}`);
        console.error('\n═══════════════════════════════════');
        console.error('⚠️ [EVENT error] Reçu une GuildQueue au lieu d\'une Error:');
        console.error('Guild:', queue.guild?.name || 'unknown');
        console.error('Queue connection:', queue.connection ? 'EXISTS' : 'NULL');
        console.error('Current track:', queue.currentTrack?.title || 'NULL');
        console.error('═══════════════════════════════════\n');
        return; // Ne pas logger comme une erreur normale
      }

      // C'est une vraie erreur
      console.error('\n═══════════════════════════════════');
      console.error('🔴 ERREUR LECTEUR AUDIO COMPLÈTE:');
      console.error('Type:', typeof error);
      console.error('Constructor:', error?.constructor?.name);
      console.error('Message:', error?.message);
      console.error('Name:', error?.name);
      console.error('Code:', (error as any)?.code);
      console.error('Errno:', (error as any)?.errno);
      console.error('Syscall:', (error as any)?.syscall);
      console.error('Path:', (error as any)?.path);
      console.error('\nObjet complet:');
      console.error(error);
      console.error('\nStack trace:');
      console.error(error?.stack);
      console.error('═══════════════════════════════════\n');

      logger.error('Erreur lecteur audio:', {
        message: error?.message || String(error),
        code: (error as any)?.code,
        errno: (error as any)?.errno,
      });
    });

    this.player.events.on('playerError', async (queue, error) => {
      console.error('\n═══════════════════════════════════');
      console.error('🔴 ERREUR PLAYER ERROR COMPLÈTE:');
      console.error('Guild:', queue.guild.name, `(${queue.guild.id})`);
      console.error('Track:', queue.currentTrack?.title);
      console.error('Connection status:', queue.connection?.state?.status || 'NULL');
      console.error('Is playing:', queue.node.isPlaying());
      console.error('Type:', typeof error);
      console.error('Constructor:', error?.constructor?.name);
      console.error('Message:', error?.message);
      console.error('Name:', error?.name);
      console.error('Code:', (error as any)?.code);
      console.error('Errno:', (error as any)?.errno);
      console.error('Syscall:', (error as any)?.syscall);
      console.error('Path:', (error as any)?.path);
      console.error('\nObjet complet:');
      console.error(error);
      console.error('\nStack trace (200 premiers chars):');
      console.error(error?.stack?.substring(0, 200));
      console.error('═══════════════════════════════════\n');

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
        return;
      }

      logger.error(`Erreur dans la queue ${queue.guild.id}:`, {
        error: errorMessage,
        guildId: queue.guild.id,
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

      // Skip automatique DÉSACTIVÉ pour diagnostic
      logger.warn(`⚠️ Skip automatique DÉSACTIVÉ - test anti-récursion`);
      
      // CODE DÉSACTIVÉ TEMPORAIREMENT - TEST
      // if (queue.tracks.size > 0) {
      //   setImmediate(async () => {
      //     try {
      //       await new Promise(resolve => setTimeout(resolve, 50));
      //       
      //       if (!queue) return;
      //       const stillExists = this.player.nodes.get(queue.guild.id);
      //       if (!stillExists || stillExists !== queue) return;
      //       
      //       logger.info(`Passage automatique à la musique suivante dans ${queue.guild.name}`);
      //       queue.node.skip();
      //     } catch (skipError) {
      //       const errorMsg = skipError instanceof Error ? skipError.message : String(skipError);
      //       if (!errorMsg.includes('Maximum call stack')) {
      //         logger.error('Impossible de skip après erreur:', skipError);
      //       }
      //       try {
      //         if (queue) {
      //           const stillExists = this.player.nodes.get(queue.guild.id);
      //           if (stillExists && stillExists === queue) {
      //             queue.delete();
      //             this.removeNowPlayingMessage(queue.guild.id);
      //           }
      //         }
      //       } catch {
      //         // Ignorer
      //       }
      //     }
      //   });
      // } else {
      //   // Aucune musique suivante, arrêter proprement
      //   logger.info(`Aucune musique suivante, arrêt de la queue dans ${queue.guild.name}`);
      //   setImmediate(() => {
      //     try {
      //       if (queue) {
      //         const stillExists = this.player.nodes.get(queue.guild.id);
      //         if (stillExists && stillExists === queue) {
      //           queue.delete();
      //           this.removeNowPlayingMessage(queue.guild.id);
      //         }
      //       }
      //     } catch {
      //       // Ignorer si déjà supprimée
      //     }
      //   });
      // }
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
   * Vérifie si un membre peut contrôler la musique (DJ ou propriétaire)
   */
  async canControlMusic(member: GuildMember, queue: Queue | null): Promise<boolean> {
    if (!queue) return false;

    try {
      const config = await prisma.musicConfig.findUnique({
        where: { guildId: queue.guild.id },
      });

      // Si pas de rôle DJ configuré, tout le monde peut contrôler
      if (!config?.djRole) return true;

      // Vérifier si le membre a le rôle DJ ou est propriétaire
      return (
        member.roles.cache.has(config.djRole) ||
        member.id === queue.guild.ownerId ||
        member.permissions.has('Administrator')
      );
    } catch (error) {
      // Si la base de données n'est pas disponible, permettre à tout le monde de contrôler
      logger.debug(`Base de données non disponible pour canControlMusic, autorisation pour tous`);
      return true;
    }
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

      // ✅ CRITIQUE : Attendre que la connection soit prête avant de retourner
      // La connection peut être en état 'signalling' ou 'connecting' (pas encore prête)
      let attempts = 0;
      const maxAttempts = 30; // 6 secondes max (30 * 200ms) - Discord peut prendre du temps
      const initialStatus = queue.connection?.state?.status || 'unknown';
      logger.info(`[joinVoiceChannel] Connexion initiée, état initial: ${initialStatus}`);
      
      while (queue.connection && queue.connection.state?.status !== 'ready' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 200));
        attempts++;
        const currentStatus = queue.connection?.state?.status || 'unknown';
        // Logger tous les 5 essais pour voir la progression
        if (attempts % 5 === 0) {
          logger.info(`[joinVoiceChannel] Attente connexion... (${attempts * 200}ms) - État: ${currentStatus}`);
        }
      }
      
      const finalStatus = queue.connection?.state?.status || 'unknown';
      if (finalStatus !== 'ready') {
        logger.warn(`⚠️ Connection pas encore prête après ${maxAttempts * 200}ms - Status: ${finalStatus}`);
        logger.warn(`⚠️ État initial: ${initialStatus} → État final: ${finalStatus}`);
        // ⚠️ NE PAS reconnecter automatiquement - le bot est peut-être déjà connecté visuellement
        // Discord peut prendre plus de temps pour signaler 'ready' même si la connexion fonctionne
        logger.warn(`⚠️ La connexion peut fonctionner même si l'état n'est pas 'ready' - on continue quand même`);
      } else {
        logger.info(`✅ [joinVoiceChannel] Connection prête après ${attempts * 200}ms`);
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

      // Vérifier que la queue existe (ne devrait jamais être null ici, mais TypeScript)
      if (!queue) {
        throw new Error('Impossible de créer ou récupérer la queue');
      }

      // Vérifier la taille de la queue (avec fallback si DB indisponible)
      let maxQueueSize = 100; // Valeur par défaut
      try {
        const config = await prisma.musicConfig.findUnique({
          where: { guildId },
        });
        maxQueueSize = config?.maxQueueSize || 100;
      } catch (error) {
        // Si la base de données n'est pas disponible, utiliser la valeur par défaut
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
        // Ajouter toute la playlist
        queue.tracks.add(result.tracks);
        
        // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`🎵 [PLAY] Avant play() - Playlist (${result.tracks.length} tracks) dans ${member.guild.name}`);
          logger.info(`[PLAY] Queue state AVANT: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
          // ⚠️ NE PAS accéder à queue.connection?.channel?.name - cause récursion dans Discord.js toJSON()
          logger.info(`[PLAY] Connection AVANT: ${queue.connection ? 'EXISTS' : 'NULL'}`);
          logger.info(`[PLAY] Volume AVANT: ${queue.node.volume || 'NULL'}`);
          
          try {
            // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone
            logger.info(`[PLAY] Tentative de démarrage de la lecture (playlist)...`);
            await new Promise<void>((resolve, reject) => {
              process.nextTick(async () => {
                try {
                  logger.debug(`[PLAY] Appel interne queue.node.play() (playlist)...`);
                  await queue.node.play();
                  logger.debug(`[PLAY] queue.node.play() terminé avec succès (playlist)`);
                  resolve();
                } catch (error) {
                  logger.error(`[PLAY] Erreur dans queue.node.play() (playlist):`, {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    errorType: error instanceof Error ? error.constructor.name : typeof error,
                  });
                  reject(error);
                }
              });
            });
            
            // Attendre un peu pour laisser le temps au player de démarrer
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            logger.info(`✅ [PLAY] Après play() - Playlist`);
            logger.info(`[PLAY] Queue state APRÈS: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            logger.info(`[PLAY] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
            // ⚠️ NE PAS accéder à queue.connection?.state?.status directement - peut causer sérialisation
            logger.info(`[PLAY] Connection APRÈS: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            logger.info(`[PLAY] Volume APRÈS: ${queue.node.volume || 'NULL'}`);
            
            // Vérifier si la lecture a réellement démarré
            if (!queue.node.isPlaying() && !queue.node.isPaused()) {
              logger.warn(`⚠️ [PLAY] La lecture n'a pas démarré après play() (playlist) - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            }
          } catch (playError) {
            const errorMsg = playError instanceof Error ? playError.message : String(playError);
            const errorStack = playError instanceof Error ? playError.stack : undefined;
            const errorType = playError instanceof Error ? playError.constructor.name : typeof playError;
            
            // ✅ Améliorer le logging de l'erreur
            logger.error(`❌ [PLAY] Erreur lors du play() playlist:`, {
              message: errorMsg,
              stack: errorStack,
              errorType: errorType,
              tracksCount: result.tracks.length,
              firstTrackTitle: result.tracks[0]?.title,
            });
            
            if (!errorMsg.includes('Maximum call stack')) {
              throw playError;
            }
            // Si c'est une récursion, ne pas throw pour voir l'état après
          }
        } else {
          logger.warn(`[PLAY] Playlist NON démarrée - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        }
        
        // Retirer le flag AVANT le return
        this.playingGuilds.delete(guildId);
        
        return { track: result.tracks[0], queue };
      } else {
        // Ajouter une seule musique
        const track = result.tracks[0];
        queue.tracks.add(track);
        
        // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`🎵 [PLAY] Avant play() - Track unique: ${track.title} dans ${member.guild.name}`);
          logger.info(`[PLAY] Queue state AVANT: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
          // ⚠️ NE PAS accéder à queue.connection?.channel?.name - cause récursion dans Discord.js toJSON()
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
            
            // Attendre un peu pour laisser le temps au player de démarrer
            await new Promise(resolve => setTimeout(resolve, 500));
            
            logger.info(`✅ [PLAY] Après play() - Track unique`);
            logger.info(`[PLAY] Queue state APRÈS: size=${queue.tracks.size}, isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            logger.info(`[PLAY] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
            // ⚠️ NE PAS accéder à queue.connection?.state?.status directement - peut causer sérialisation
            logger.info(`[PLAY] Connection APRÈS: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            logger.info(`[PLAY] Volume APRÈS: ${queue.node.volume || 'NULL'}`);
          } catch (playError) {
            const errorMsg = playError instanceof Error ? playError.message : String(playError);
            const errorStack = playError instanceof Error ? playError.stack : undefined;
            // ✅ Ne pas logger l'objet error directement (contient Player/Queue avec références circulaires)
            logger.error(`❌ [PLAY] Erreur lors du play() track:`, {
              message: errorMsg,
              stack: errorStack,
            });
            if (!errorMsg.includes('Maximum call stack')) {
              throw playError;
            }
            // Si c'est une récursion, ne pas throw pour voir l'état après
          }
        } else {
          logger.warn(`[PLAY] Track NON démarré - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
        }
        
        // Retirer le flag AVANT le return
        this.playingGuilds.delete(guildId);
        
        return { track, queue };
      }
    } catch (error) {
      // Retirer le flag même en cas d'erreur
      this.playingGuilds.delete(guildId);
      
      // ✅ Ne pas logger l'objet error directement (peut contenir Player/Queue avec références circulaires)
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Erreur lors de la lecture:', {
        message: errorMsg,
        stack: errorStack,
      });
      throw error;
    }
  }

  /**
   * Pause la musique
   */
  pause(queue: Queue): void {
    if (queue.node.isPaused()) {
      queue.node.resume();
    } else {
      queue.node.pause();
    }
  }

  /**
   * Arrête la musique et vide la queue
   */
  stop(queue: Queue): void {
    queue.delete();
  }

  /**
   * Passe à la musique suivante
   * PROTECTION ANTI-RÉCURSION : Utilise un flag pour éviter les appels multiples
   */
  skip(queue: Queue): Track | null {
    const guildId = queue.guild.id;
    
    // Protection anti-récursion stricte
    if (this.processingSkip.has(guildId)) {
      logger.warn(`⚠️ Skip déjà en cours pour ${guildId}, appel ignoré pour éviter récursion`);
      return null;
    }
    
    // Ajouter le flag
    this.processingSkip.add(guildId);
    
    try {
      const result = queue.node.skip();
      
      // Retirer le flag après un court délai
      setTimeout(() => {
        this.processingSkip.delete(guildId);
      }, 200);
      
      return result;
    } catch (error) {
      // Retirer le flag même en cas d'erreur
      this.processingSkip.delete(guildId);
      
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (!errorMsg.includes('Maximum call stack')) {
        // ✅ Ne pas logger l'objet error directement (peut contenir Player/Queue avec références circulaires)
        const errorMsgForSkip = error instanceof Error ? error.message : String(error);
        const errorStackForSkip = error instanceof Error ? error.stack : undefined;
        logger.error(`Erreur lors du skip pour ${guildId}:`, {
          message: errorMsgForSkip,
          stack: errorStackForSkip,
        });
      }
      
      throw error;
    }
  }

  /**
   * Revient à la musique précédente
   */
  back(queue: Queue): void {
    if (queue.history.size > 0) {
      queue.history.back();
    }
  }

  /**
   * Change le volume
   */
  setVolume(queue: Queue, volume: number): void {
    queue.node.setVolume(Math.max(0, Math.min(100, volume)));
  }

  /**
   * Change le mode de répétition
   */
  setLoopMode(queue: Queue, mode: QueueRepeatMode): void {
    queue.setRepeatMode(mode);
  }

  /**
   * Mélange la queue
   */
  shuffle(queue: Queue): void {
    queue.tracks.shuffle();
  }

  /**
   * Retire une musique de la queue
   */
  remove(queue: Queue, index: number): Track | null {
    const track = queue.tracks.at(index - 1);
    if (track) {
      queue.tracks.remove(track);
      return track;
    }
    return null;
  }

  /**
   * Avance dans la musique
   */
  async seek(queue: Queue, position: number): Promise<void> {
    if (!queue.currentTrack) {
      throw new Error('Aucune musique en cours de lecture');
    }

    const duration = queue.currentTrack.durationMS;
    const seekPosition = Math.max(0, Math.min(position * 1000, duration));

    await queue.node.seek(seekPosition);
  }

  /**
   * Obtient le volume par défaut du serveur
   * Fallback à 50 si la base de données n'est pas disponible
   */
  async getDefaultVolume(guildId: string): Promise<number> {
    try {
      const config = await prisma.musicConfig.findUnique({
        where: { guildId },
      });
      return config?.defaultVolume || 50;
    } catch (error) {
      // Si la base de données n'est pas disponible, utiliser la valeur par défaut
      logger.debug(`Base de données non disponible pour getDefaultVolume, utilisation de la valeur par défaut (50)`);
      return 50;
    }
  }

  /**
   * Obtient la queue d'un serveur
   */
  getQueue(guildId: string): Queue | null {
    return this.player.nodes.get(guildId) || null;
  }

  /**
   * Crée un embed pour la musique en cours
   */
  createNowPlayingEmbed(queue: Queue): EmbedBuilder {
    return createNowPlayingEmbedUtil(queue);
  }

  /**
   * Recherche une musique sans l'ajouter à la queue
   */
  async searchTracks(
    query: string,
    requestedBy: GuildMember['user'],
    limit: number = 10
  ): Promise<{ tracks: Track[]; playlist?: any }> {
    // Vérifier que les extracteurs sont prêts
    if (!this.extractorsReady) {
      throw new Error('⏳ Extracteurs en cours de chargement, veuillez patienter...');
    }

    // Validation de la requête
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
        fallbackSearchEngine: 'youtube', // Utilisera YoutubeiExtractor maintenant
      });

      if (!result.hasTracks()) {
        throw new Error('Aucun résultat trouvé pour cette recherche !');
      }

      // Limiter les résultats pour l'autocomplete (si limit spécifié)
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

  /**
   * Crée une barre de progression
   */
  private createProgressBar(queue: Queue): string {
    const track = queue.currentTrack;
    if (!track) return '```\n[                    ]\n```';

    const timestamp = queue.node.getTimestamp();
    if (!timestamp) return '```\n[                    ]\n```';

    const current = timestamp.current.value || 0;
    const total = track.durationMS;
    const percentage = total > 0 ? (current / total) * 100 : 0;

    const filled = Math.round((percentage / 100) * 20);
    const empty = 20 - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const emoji = queue.node.isPaused() ? '⏸️' : '▶️';

    return `\`\`\`\n${emoji} [${bar}] ${Math.round(percentage)}%\n\`\`\``;
  }

  /**
   * Obtient les informations de la queue
   */
  private getQueueInfo(queue: Queue): { title: string; value: string } {
    const nextTracks = queue.tracks.toArray().slice(0, 5);
    const history = queue.history.toArray().slice(-3);

    let info = '';

    if (nextTracks.length > 0) {
      info += '**Prochaines musiques:**\n';
      nextTracks.forEach((track, index) => {
        info += `${index + 1}. [${track.title}](${track.url}) - ${track.author || 'Inconnu'}\n`;
      });

      if (queue.tracks.size > 5) {
        info += `\n*Et ${queue.tracks.size - 5} autre(s) musique(s)...*`;
      }
    } else {
      info += '*Aucune musique en attente*';
    }

    if (history.length > 0) {
      info += '\n\n**Historique récent:**\n';
      history.forEach((track: Track) => {
        info += `◀️ [${track.title}](${track.url})\n`;
      });
    }

    return {
      title: "📋 File d'attente",
      value: info || '*Vide*',
    };
  }

  /**
   * Obtient le texte du mode de répétition
   */
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

  /**
   * Sauvegarde le message "Now Playing"
   */
  saveNowPlayingMessage(guildId: string, messageId: string): void {
    this.nowPlayingMessages.set(guildId, messageId);
  }

  /**
   * Récupère le message "Now Playing"
   */
  getNowPlayingMessage(guildId: string): string | undefined {
    return this.nowPlayingMessages.get(guildId);
  }

  /**
   * Supprime le message "Now Playing"
   */
  removeNowPlayingMessage(guildId: string): void {
    this.nowPlayingMessages.delete(guildId);
  }
}
