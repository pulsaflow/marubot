import {
  Events,
  ChatInputCommandInteraction,
  ButtonInteraction,
  AutocompleteInteraction,
  MessageFlags,
} from 'discord.js';
import { logger } from '../services/LoggerService';
import { createErrorEmbed } from '../utils/embeds';
import type { Bot } from '../core/Bot';
import { QueueRepeatMode } from 'discord-player';

export default {
  name: Events.InteractionCreate,
  async execute(
    interaction: ChatInputCommandInteraction | ButtonInteraction | AutocompleteInteraction,
    bot: Bot
  ): Promise<void> {
    try {
      // NOUVEAU : Gérer les autocomplete AVANT tout le reste
      if (interaction.isAutocomplete()) {
        const command = bot.commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`Commande ${interaction.commandName} non trouvée pour autocomplete`);
          return;
        }

        // Si la commande a une méthode autocomplete, l'exécuter
        if ('autocomplete' in command && typeof command.autocomplete === 'function') {
          // Vérifier si l'interaction n'a pas déjà expiré AVANT d'appeler la fonction
          const interactionAge = Date.now() - interaction.createdTimestamp;
          if (interactionAge > 2500) {
            // Interaction trop vieille, ne pas répondre
            return;
          }

          // Note: La vérification responded est faite dans la fonction autocomplete elle-même

          try {
            await command.autocomplete(interaction as AutocompleteInteraction);
          } catch (error) {
            // Si l'interaction a expiré ou déjà répondue, ne pas logger comme erreur
            if (
              error instanceof Error &&
              (error.message.includes('Unknown interaction') ||
                error.message.includes('already been acknowledged'))
            ) {
              return;
            }

            logger.error(`Erreur lors de l'autocomplete de ${interaction.commandName}:`, error);
            // En cas d'erreur, essayer de répondre avec un message d'erreur
            try {
              if (!(interaction as any).responded) {
                await interaction.respond([
                  {
                    name: '❌ Erreur de recherche',
                    value: interaction.options.getFocused() || 'error',
                  },
                ]);
              }
            } catch {
              // Ignorer si déjà répondu ou expiré
            }
          }
        }
        return; // IMPORTANT : Arrêter ici pour les autocomplete
      }

      // Gérer les boutons musicaux et de prévisualisation
      if (interaction.isButton()) {
        if (interaction.customId.startsWith('music_')) {
          await this.handleMusicButton(interaction as ButtonInteraction, bot);
          return;
        }
        if (interaction.customId.startsWith('play_')) {
          // Les boutons de prévisualisation sont gérés dans la commande play
          return;
        }
      }

      if (!interaction.isChatInputCommand()) return;

      const command = bot.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Commande ${interaction.commandName} non trouvée`);
        return;
      }

          // IMPORTANT: Déferrer IMMÉDIATEMENT pour éviter le timeout
          // On defer d'abord, puis on fait les vérifications
          try {
            await interaction.deferReply();
          } catch (error) {
            // Si déjà répondu ou expiré, on arrête
            if (error instanceof Error && error.message.includes('Unknown interaction')) {
              return;
            }
            throw error;
          }

      // Vérifications rapides (après defer, on utilisera editReply)
      if (command.guildOnly && !interaction.guild) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Commande serveur uniquement',
              description: 'Cette commande ne peut être utilisée que sur un serveur.',
              guild: undefined,
            }),
          ],
        });
        return;
      }

      // Vérification du cooldown
      if (bot.commands.isOnCooldown(interaction.user.id, interaction.commandName)) {
        const remaining = bot.commands.getCooldownRemaining(
          interaction.user.id,
          interaction.commandName
        );
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '⏱️ Cooldown actif',
              description: `Veuillez patienter ${remaining} seconde(s) avant de réutiliser cette commande.`,
              guild: interaction.guild ?? undefined,
            }),
          ],
        });
        return;
      }

      // Vérifications qui peuvent prendre du temps (après defer)
      const hasPermissions = await bot.commands.checkPermissions(interaction, command);
      if (!hasPermissions) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Permissions insuffisantes',
              description:
                "Vous n'avez pas les permissions nécessaires pour utiliser cette commande.",
              guild: interaction.guild ?? undefined,
            }),
          ],
        });
        return;
      }

      // Définition du cooldown
      bot.commands.setCooldown(interaction.user.id, interaction.commandName);

      // Exécution de la commande (qui n'a plus besoin de deferReply car c'est déjà fait)
      await command.execute(interaction as ChatInputCommandInteraction);

      if (interaction.isChatInputCommand()) {
        logger.debug(
          `Commande ${interaction.commandName} exécutée par ${interaction.user.tag} dans ${interaction.guild?.name || 'DM'}`
        );
      }
    } catch (error) {
      if (!interaction.isChatInputCommand() && !interaction.isButton()) {
        return;
      }

      const commandName = interaction.isChatInputCommand() ? interaction.commandName : 'bouton';

      logger.error(`Erreur lors de l'exécution de ${commandName}:`, error);

      const errorMessage =
        error instanceof Error ? error.message : 'Une erreur inconnue est survenue';

      const embed = createErrorEmbed({
        title: '❌ Erreur',
        description: `Une erreur est survenue lors de l'exécution de la commande:\n\`\`\`${errorMessage}\`\`\``,
        guild: interaction.guild ?? undefined,
      });

      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ embeds: [embed], flags: 64 }); // EPHEMERAL
        } catch (replyError) {
          logger.error("Impossible de répondre à l'interaction:", replyError);
        }
      } else if (interaction.deferred) {
        await interaction.editReply({ embeds: [embed] });
      } else {
        await interaction.followUp({ embeds: [embed], flags: 64 }); // EPHEMERAL
      }
    }
  },

  async handleMusicButton(interaction: ButtonInteraction, bot: Bot): Promise<void> {
    const customId = interaction.customId;
    const musicService = bot.musicService;
    const queue = musicService.getQueue(interaction.guild!.id);

    if (!queue) {
      await interaction.reply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Aucune musique n'est actuellement en cours de lecture.",
            guild: interaction.guild ?? undefined,
          }),
        ],
        flags: 64, // EPHEMERAL
      });
      return;
    }

    const member = interaction.member;
    if (isGuildMember(member)) {
      const canControl = await musicService.canControlMusic(member, queue);
      if (!canControl) {
        await interaction.reply({
          embeds: [
            createErrorEmbed({
              title: '❌ Permissions insuffisantes',
              description: "Vous n'avez pas la permission de contrôler la musique.",
              guild: interaction.guild ?? undefined,
            }),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    try {
      switch (customId) {
        case 'music_pause':
          musicService.pause(queue);
          await interaction.deferUpdate();
          // Mettre à jour l'embed
          const channel = interaction.channel;
          if (channel && channel.isTextBased()) {
            try {
              const messageId = musicService.getNowPlayingMessage(interaction.guild!.id);
              if (messageId) {
                const message = await channel.messages.fetch(messageId);
                const embed = musicService.createNowPlayingEmbed(queue);
                await message.edit({ embeds: [embed] });
              }
            } catch {
              // Ignorer les erreurs
            }
          }
          break;

        case 'music_skip':
          musicService.skip(queue);
          await interaction.reply({
            content: '⏭️ Musique passée',
            flags: MessageFlags.Ephemeral,
          });
          break;

        case 'music_stop':
          musicService.stop(queue);
          musicService.removeNowPlayingMessage(interaction.guild!.id);
          await interaction.reply({
            content: '⏹️ Musique arrêtée',
            flags: MessageFlags.Ephemeral,
          });
          break;

        case 'music_loop':
          const currentMode = queue.repeatMode;
          let nextMode: QueueRepeatMode;
          if (currentMode === QueueRepeatMode.OFF) {
            nextMode = QueueRepeatMode.TRACK;
          } else if (currentMode === QueueRepeatMode.TRACK) {
            nextMode = QueueRepeatMode.QUEUE;
          } else if (currentMode === QueueRepeatMode.QUEUE) {
            nextMode = QueueRepeatMode.AUTOPLAY;
          } else {
            nextMode = QueueRepeatMode.OFF;
          }
          musicService.setLoopMode(queue, nextMode);
          await interaction.reply({
            content: `🔄 Mode répétition: ${musicService.getRepeatModeText(nextMode)}`,
            flags: MessageFlags.Ephemeral,
          });
          break;

        case 'music_queue': {
          const tracks = queue.tracks.toArray().slice(0, 10);
          let queueList = `**🎵 Lecture en cours:**\n[${queue.currentTrack?.title}](${queue.currentTrack?.url})\n\n`;
          if (tracks.length > 0) {
            queueList += '**📋 Prochaines musiques:**\n';
            tracks.forEach((track: any, index: number) => {
              queueList += `${index + 1}. [${track.title}](${track.url})\n`;
            });
          }
          await interaction.reply({
            content: queueList,
            flags: MessageFlags.Ephemeral,
          });
          break;
        }
      }
    } catch (error) {
      logger.error('Erreur lors du traitement du bouton musical:', error);
      await interaction.reply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du traitement de votre demande.',
            guild: interaction.guild ?? undefined,
          }),
        ],
        flags: 64, // EPHEMERAL
      });
    }
  },
};
