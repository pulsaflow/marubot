import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from 'discord.js';
import { Command } from '@/types';
import { createErrorEmbed } from '@/utils/embeds';
import {
  createTrackAddedEmbed,
  createPlaylistAddedEmbed,
} from '@/utils/musicEmbeds';
import { prisma } from '@/database/client';
import { getBotFromClient } from '@/core/Bot';
import { logger } from '@/services/LoggerService';
import { isGuildMember } from '@/utils/typeGuards';

// Fonctions utilitaires
function formatDurationForAutocomplete(durationMs: number | string): string {
  let duration: number;
  if (typeof durationMs === 'string') {
    // Si c'est déjà formaté (ex: "3:49"), on le retourne
    if (durationMs.includes(':')) {
      return durationMs;
    }
    duration = parseInt(durationMs);
  } else {
    duration = durationMs;
  }

  if (!duration || isNaN(duration)) return '0:00';

  const totalSeconds = Math.floor(duration / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSourceEmoji(source: string): string {
  const sourceMap: Record<string, string> = {
    youtube: '📺',
    spotify: '🟢',
    soundcloud: '🟠',
    apple_music: '🍎',
    arbitrary: '🔗',
  };
  return sourceMap[source?.toLowerCase()] || '🎵';
}

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Joue une musique depuis YouTube, Spotify, SoundCloud, etc.')
    .addStringOption((option) =>
      option
        .setName('recherche')
        .setDescription('URL ou nom de la musique/playlist à jouer')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  cooldown: 3,
  guildOnly: true,

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    // Vérifier si déjà répondu (protection contre double appel)
    try {
      // Tenter de vérifier si l'interaction est déjà traitée
      if (interaction.responded) {
        return;
      }
    } catch {
      // Si la propriété n'existe pas, continuer
    }

    const bot = getBotFromClient(interaction.client);

    if (!bot || !bot.musicService) {
      try {
        return await interaction.respond([]);
      } catch {
        return;
      }
    }

    const focusedValue = interaction.options.getFocused();

    // Minimum 2 caractères
    if (focusedValue.length < 2) {
      try {
        return await interaction.respond([
          {
            name: '🔍 Tapez au moins 2 caractères pour rechercher...',
            value: 'placeholder_min',
          },
        ]);
      } catch {
        return;
      }
    }

    // Vérifier l'âge de l'interaction (si > 2.5s, ne pas répondre)
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 2500) {
      // Interaction trop vieille, ne pas répondre
      return;
    }

    try {
      // Vérifier si c'est une URL - si oui, retourner directement
      const isUrl = /^https?:\/\//i.test(focusedValue);
      if (isUrl) {
        try {
          return await interaction.respond([
            {
              name: '🔗 URL détectée - Appuyez sur Entrée pour jouer',
              value: focusedValue,
            },
          ]);
        } catch (error) {
          // Si déjà répondu ou expiré, ignorer
          return;
        }
      }

      // Timeout de 2.5 secondes (Discord limite à 3s, on prend une marge de sécurité)
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 2500)
      );

      // Vérifier que le service musique est prêt
      if (!bot.musicService || !bot.musicService.isReady()) {
        try {
          return await interaction.respond([
            {
              name: '⏳ Module musique en cours de chargement...',
              value: focusedValue,
            },
          ]);
        } catch {
          return;
        }
      }

      // Limiter à 10 résultats pour être plus rapide
      const searchPromise = bot.musicService.searchTracks(focusedValue, interaction.user, 10);

      const searchResult = await Promise.race([searchPromise, timeoutPromise]);

      // Si aucun résultat
      if (!searchResult || !searchResult.tracks || searchResult.tracks.length === 0) {
        try {
          return await interaction.respond([
            {
              name: '❌ Aucun résultat trouvé',
              value: focusedValue,
            },
          ]);
        } catch {
          return; // Ignorer si expiré
        }
      }

      // Préparer les choix pour l'autocomplétion (déjà limité à 10 dans searchTracks)
      const choices = searchResult.tracks.map((track) => {
        // Formater la durée
        const duration = formatDurationForAutocomplete(track.durationMS || 0);

        // Obtenir l'emoji de source
        const sourceEmoji = getSourceEmoji(track.source || '');

        // Format : "Emoji Artiste - Titre - Durée"
        let displayName = `${sourceEmoji} ${track.author || 'Inconnu'} - ${track.title} - ${duration}`;

        // Tronquer si trop long (Discord limite à 100 caractères)
        if (displayName.length > 100) {
          displayName = displayName.substring(0, 97) + '...';
        }

        return {
          name: displayName,
          value: track.url, // L'URL sera utilisée lors de l'exécution
        };
      });

      try {
        await interaction.respond(choices);
      } catch (error) {
        // Si l'interaction a expiré ou déjà répondue, ignorer silencieusement
        if (
          error instanceof Error &&
          (error.message.includes('Unknown interaction') ||
            error.message.includes('already been acknowledged'))
        ) {
          return;
        }
        throw error;
      }
    } catch (error) {
      // Ne pas logger les erreurs "Unknown interaction" ou "already acknowledged"
      if (
        error instanceof Error &&
        (error.message.includes('Unknown interaction') ||
          error.message.includes('already been acknowledged'))
      ) {
        return;
      }

      if (error instanceof Error && error.message === 'Timeout') {
        logger.warn(`Timeout de recherche pour "${focusedValue}" (${Date.now() - interaction.createdTimestamp}ms)`);
        try {
          return await interaction.respond([
            {
              name: '⏱️ Recherche trop longue, continuez à taper...',
              value: focusedValue,
            },
          ]);
        } catch {
          return; // Ignorer si expiré
        }
      }

      // Si c'est une erreur d'extracteurs non prêts
      if (error instanceof Error && error.message.includes('Extracteurs en cours de chargement')) {
        try {
          return await interaction.respond([
            {
              name: '⏳ Module musique en cours d\'initialisation, réessayez dans quelques secondes...',
              value: focusedValue,
            },
          ]);
        } catch {
          return;
        }
      }

      logger.error("Erreur lors de l'autocomplete:", error);

      // En cas d'erreur, permettre la saisie manuelle
      try {
        return await interaction.respond([
          {
            name: '⚠️ Erreur - Vous pouvez entrer une URL directement',
            value: focusedValue,
          },
        ]);
      } catch {
        // Ignorer si expiré
        return;
      }
    }
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // NOTE: deferReply() est déjà fait dans interactionCreate.ts
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const member = interaction.member;
    // Type guard pour vérifier que member est un GuildMember avec voice
    if (!isGuildMember(member)) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous devez être dans un canal vocal pour utiliser cette commande.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous devez être dans un canal vocal !',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const rawQuery = interaction.options.getString('recherche', true);

    // Validation de la requête
    if (rawQuery.length > 200) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Requête trop longue',
            description: 'La recherche ne peut pas dépasser 200 caractères.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const query = rawQuery.trim();

    if (query.length < 2) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Requête trop courte',
            description: 'La recherche doit contenir au moins 2 caractères.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const bot = getBotFromClient(interaction.client);

    if (!bot || !bot.musicService) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Le service de musique n'est pas disponible.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const musicService = bot.musicService;

    try {
      // Afficher un message de chargement
      await interaction.editReply({
        content: '🔍 Traitement de votre demande...',
      });

      let queue = musicService.getQueue(interaction.guild!.id);

      if (!queue) {
        queue = await musicService.joinVoiceChannel(voiceChannel, interaction.channel as any);
      }

      // Vérifier si c'est une URL (sélection depuis autocomplete) ou un terme de recherche
      const isUrl = /^https?:\/\//i.test(query);

      // Si c'est une URL (venant de l'autocomplete), jouer directement
      if (isUrl) {
        const searchResult = await musicService.searchTracks(query, member.user, 0); // 0 = pas de limite pour URL

        // Vérifier si c'est une playlist
        if (searchResult.playlist) {
          const tracks = searchResult.tracks;

          // Vérifier la taille de la queue (avec fallback si DB indisponible)
          let maxQueueSize = 100; // Valeur par défaut
          try {
            const config = await prisma.musicConfig.findUnique({
              where: { guildId: interaction.guild!.id },
            });
            maxQueueSize = config?.maxQueueSize || 100;
          } catch (error) {
            // Si la base de données n'est pas disponible, utiliser la valeur par défaut
            logger.debug(`Base de données non disponible pour vérifier maxQueueSize, utilisation de la valeur par défaut (100)`);
          }

          if (queue.tracks.size + tracks.length > maxQueueSize) {
            await interaction.editReply({
              content: '',
              embeds: [
                createErrorEmbed({
                  title: '❌ Trop de musiques',
                  description: `Cette playlist contient ${tracks.length} musique(s), mais la file d'attente ne peut contenir que ${maxQueueSize} musiques maximum.`,
                  guild: interaction.guild ?? undefined,
                }),
              ],
            });
            return;
          }

          // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate (évite double appel avec MusicService.play())
          queue.tracks.add(tracks);
          if (!queue.node.isPlaying() && !queue.node.isPaused()) {
            logger.info(`[play.ts] Appel queue.node.play() - Playlist (${tracks.length} tracks)`);
            logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
            // ⚠️ NE PAS accéder à queue.connection?.channel?.name - cause récursion dans Discord.js toJSON()
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
              
              // Attendre un peu pour laisser le temps au player de démarrer
              await new Promise(resolve => setTimeout(resolve, 500));
              
              logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
              logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : undefined;
              // ✅ Ne pas logger l'objet error directement (contient Player/Queue avec références circulaires)
              logger.error(`[play.ts] Erreur lors de play() playlist:`, {
                message: errorMsg,
                stack: errorStack,
              });
            }
          }

          const previewEmbed = createPlaylistAddedEmbed(
            searchResult.playlist.title || 'Playlist',
            tracks.length,
            tracks[0]
          );

          await interaction.editReply({
            content: '',
            embeds: [previewEmbed],
          });

          // Le message "Now Playing" sera créé automatiquement par l'événement playerStart
          return;
        }

        // Musique unique sélectionnée depuis l'autocomplete
        const track = searchResult.tracks[0];
        const currentTracksInQueue = queue.tracks.size;
        const position = currentTracksInQueue + (queue.currentTrack ? 1 : 0) + 1;

        // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate (évite double appel avec MusicService.play())
        queue.tracks.add(track);
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`[play.ts] Appel queue.node.play() - Track unique: ${track.title}`);
          logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
          // ⚠️ NE PAS accéder à queue.connection?.channel?.name - cause récursion dans Discord.js toJSON()
          logger.info(`[play.ts] Connection status: ${queue.connection ? 'EXISTS' : 'NULL'}`);
            try {
              // ✅ CRITIQUE : Attendre que la connection soit prête avant de jouer
              if (queue.connection && queue.connection.state?.status !== 'ready') {
                const initialStatus = queue.connection.state?.status || 'unknown';
                logger.info(`[play.ts] Connection en état '${initialStatus}', attente de 'ready'...`);
                let attempts = 0;
                const maxAttempts = 30; // 6 secondes max (30 * 200ms) - Discord peut prendre du temps
                while (queue.connection && queue.connection.state?.status !== 'ready' && attempts < maxAttempts) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                  attempts++;
                  const currentStatus = queue.connection.state?.status || 'unknown';
                  // Logger tous les 5 essais pour voir la progression
                  if (attempts % 5 === 0) {
                    logger.info(`[play.ts] Attente connexion... (${attempts * 200}ms) - État: ${currentStatus}`);
                  }
                }
                const finalStatus = queue.connection?.state?.status || 'unknown';
                if (finalStatus !== 'ready') {
                  logger.warn(`⚠️ [play.ts] Connection toujours pas prête après ${maxAttempts * 200}ms - Status: ${finalStatus}`);
                  logger.warn(`⚠️ [play.ts] État initial: ${initialStatus} → État final: ${finalStatus}`);
                  // Si la connexion est bloquée, on essaie quand même de jouer
                  // discord-player peut gérer certaines situations où la connexion n'est pas 'ready'
                  logger.warn(`⚠️ [play.ts] Tentative de lecture malgré l'état '${finalStatus}'...`);
                } else {
                  logger.info(`✅ [play.ts] Connection prête après ${attempts * 200}ms`);
                }
              }
              
              // ✅ LOGS DÉTAILLÉS POUR DIAGNOSTIC
              console.log('\n🎵 [play.ts] Tentative de lecture...');
              console.log('Track:', track.title);
              console.log('Queue size:', queue.tracks.size);
              console.log('Is playing:', queue.node.isPlaying());
              console.log('Connection:', queue.connection?.state?.status || 'NULL');
              console.log('FFmpeg path:', process.env.FFMPEG_PATH);
              
              // ⚠️ CRITIQUE : Essayer de jouer même si la connexion n'est pas 'ready'
              // Parfois discord-player peut gérer une connexion en 'connecting' ou 'signalling'
              logger.info(`[play.ts] Appel de queue.node.play() avec connexion en état '${queue.connection?.state?.status || 'unknown'}'...`);
              
              try {
                // Appel direct sans process.nextTick - parfois ça fonctionne mieux
                await queue.node.play();
                logger.info(`✅ [play.ts] queue.node.play() appelé avec succès (pas d'erreur immédiate)`);
              } catch (playError) {
                const errorMsg = playError instanceof Error ? playError.message : String(playError);
                const errorStack = playError instanceof Error ? playError.stack : undefined;
                logger.error(`[play.ts] Erreur dans queue.node.play():`, {
                  message: errorMsg,
                  stack: errorStack?.split('\n').slice(0, 10).join('\n'), // Limiter la stack
                  errorType: playError instanceof Error ? playError.constructor.name : typeof playError,
                });
                // Ne pas throw immédiatement - attendre un peu et voir si ça démarre quand même
              }
              
              // Attendre un peu pour laisser le temps au player de démarrer
              // Parfois discord-player démarre la lecture de manière asynchrone
              logger.info(`[play.ts] Attente 2 secondes pour voir si la lecture démarre...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              
              console.log('\n✅ [play.ts] Après play()');
              console.log('Is playing:', queue.node.isPlaying());
              console.log('Current track:', queue.currentTrack?.title);
              
              logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
              // ⚠️ NE PAS accéder à queue.connection?.state?.status directement - peut causer sérialisation
              logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
              
              // Vérifier si la lecture a réellement démarré
              if (!queue.node.isPlaying() && !queue.node.isPaused()) {
                logger.warn(`⚠️ [play.ts] La lecture n'a pas démarré après play() - isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              }
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : undefined;
              const errorType = error instanceof Error ? error.constructor.name : typeof error;
              // ✅ Améliorer le logging de l'erreur
              logger.error(`[play.ts] Erreur lors de play() track:`, {
                message: errorMsg,
                stack: errorStack,
                errorType: errorType,
                trackTitle: track.title,
                trackUrl: track.url,
              });
            }
        }

        // Message de confirmation
        const addedEmbed = createTrackAddedEmbed(
          track,
          position,
          queue.tracks.size + (queue.currentTrack ? 1 : 0)
        );

        await interaction.editReply({
          content: '',
          embeds: [addedEmbed],
        });

        // Le message "Now Playing" sera créé automatiquement par l'événement playerStart
      } else {
        // Si ce n'est pas une URL, c'est une recherche manuelle (fallback)
        // On prend le premier résultat
        const searchResult = await musicService.searchTracks(query, member.user, 0); // 0 = pas de limite pour recherche manuelle

        if (!searchResult.tracks || searchResult.tracks.length === 0) {
          await interaction.editReply({
            content: '',
            embeds: [
              createErrorEmbed({
                title: '❌ Aucun résultat',
                description: 'Aucune musique trouvée pour cette recherche.',
                guild: interaction.guild ?? undefined,
              }),
            ],
          });
          return;
        }

        // Vérifier si c'est une playlist
        if (searchResult.playlist) {
          const tracks = searchResult.tracks;

          // Vérifier la taille de la queue (avec fallback si DB indisponible)
          let maxQueueSize = 100; // Valeur par défaut
          try {
            const config = await prisma.musicConfig.findUnique({
              where: { guildId: interaction.guild!.id },
            });
            maxQueueSize = config?.maxQueueSize || 100;
          } catch (error) {
            // Si la base de données n'est pas disponible, utiliser la valeur par défaut
            logger.debug(`Base de données non disponible pour vérifier maxQueueSize, utilisation de la valeur par défaut (100)`);
          }

          if (queue.tracks.size + tracks.length > maxQueueSize) {
            await interaction.editReply({
              content: '',
              embeds: [
                createErrorEmbed({
                  title: '❌ Trop de musiques',
                  description: `Cette playlist contient ${tracks.length} musique(s), mais la file d'attente ne peut contenir que ${maxQueueSize} musiques maximum.`,
                  guild: interaction.guild ?? undefined,
                }),
              ],
            });
            return;
          }

          // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate (évite double appel avec MusicService.play())
          queue.tracks.add(tracks);
          if (!queue.node.isPlaying() && !queue.node.isPaused()) {
            logger.info(`[play.ts] Appel queue.node.play() - Playlist (${tracks.length} tracks)`);
            logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
            // ⚠️ NE PAS accéder à queue.connection?.channel?.name - cause récursion dans Discord.js toJSON()
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
              
              // Attendre un peu pour laisser le temps au player de démarrer
              await new Promise(resolve => setTimeout(resolve, 500));
              
              logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
              logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
              logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              const errorStack = error instanceof Error ? error.stack : undefined;
              // ✅ Ne pas logger l'objet error directement (contient Player/Queue avec références circulaires)
              logger.error(`[play.ts] Erreur lors de play() playlist:`, {
                message: errorMsg,
                stack: errorStack,
              });
            }
          }

          const previewEmbed = createPlaylistAddedEmbed(
            searchResult.playlist.title || 'Playlist',
            tracks.length,
            tracks[0]
          );

          await interaction.editReply({
            content: '',
            embeds: [previewEmbed],
          });

          return;
        }

        // Prendre le premier résultat
        const track = searchResult.tracks[0];
        const currentTracksInQueue = queue.tracks.size;
        const position = currentTracksInQueue + (queue.currentTrack ? 1 : 0) + 1;

        // ✅ SIMPLIFIÉ - Appel direct, pas de setImmediate (évite double appel avec MusicService.play())
        queue.tracks.add(track);
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          logger.info(`[play.ts] Appel queue.node.play() - Track unique (recherche manuelle): ${track.title}`);
          logger.info(`[play.ts] État AVANT: isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}, size=${queue.tracks.size}`);
          // ⚠️ CRITIQUE : Utiliser process.nextTick pour éviter récursion synchrone (comme les autres occurrences)
          try {
            // ✅ LOGS DÉTAILLÉS POUR DIAGNOSTIC
            console.log('\n🎵 [play.ts] Tentative de lecture (recherche manuelle)...');
            console.log('Track:', track.title);
            console.log('Queue size:', queue.tracks.size);
            console.log('Is playing:', queue.node.isPlaying());
            console.log('Connection:', queue.connection?.state?.status || 'NULL');
            console.log('FFmpeg path:', process.env.FFMPEG_PATH);
            
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
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('\n✅ [play.ts] Après play() (recherche manuelle)');
            console.log('Is playing:', queue.node.isPlaying());
            console.log('Current track:', queue.currentTrack?.title);
            
            logger.info(`[play.ts] État APRÈS play(): isPlaying=${queue.node.isPlaying()}, isPaused=${queue.node.isPaused()}`);
            logger.info(`[play.ts] Current track: ${queue.currentTrack?.title || 'AUCUNE'}`);
            // ⚠️ NE PAS accéder à queue.connection?.state?.status directement - peut causer sérialisation
            logger.info(`[play.ts] Connection exists: ${queue.connection ? 'YES' : 'NO'}`);
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            // ✅ Ne pas logger l'objet error directement (contient Player/Queue avec références circulaires)
            logger.error(`[play.ts] Erreur lors de play() track (recherche manuelle):`, {
              message: errorMsg,
              stack: errorStack,
            });
          }
        }

        const addedEmbed = createTrackAddedEmbed(
          track,
          position,
          queue.tracks.size + (queue.currentTrack ? 1 : 0)
        );

        await interaction.editReply({
          content: '',
          embeds: [addedEmbed],
        });

        // Le message "Now Playing" sera créé automatiquement par l'événement playerStart
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';

      await interaction.editReply({
        content: '',
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: errorMessage,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
    }
  },
} as Command;
