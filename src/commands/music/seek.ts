import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { formatDurationShort } from '@/utils/validators';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Avance dans la musique actuelle')
    .addIntegerOption((option) =>
      option
        .setName('secondes')
        .setDescription('Nombre de secondes (négatif pour reculer)')
        .setRequired(true)
    ),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const bot = (interaction.client as any).bot as Bot;
    const musicService = bot.musicService;

    const queue = musicService.getQueue(interaction.guild!.id);

    if (!queue || !queue.currentTrack) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Aucune musique n'est actuellement en cours de lecture.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const seconds = interaction.options.getInteger('secondes', true);
    const track = queue.currentTrack;
    const timestamp = queue.node.getTimestamp();

    if (!timestamp) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Impossible d'obtenir la position actuelle.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const currentPosition = timestamp.current.value || 0;
    const newPosition = Math.max(0, Math.min(currentPosition + seconds * 1000, track.durationMS));

    const member = interaction.member;
    if (isGuildMember(member)) {
      const canControl = await musicService.canControlMusic(member, queue);
      if (!canControl) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Permissions insuffisantes',
              description:
                "Vous n'avez pas la permission de contrôler la musique. Vous devez avoir le rôle DJ.",
              guild: interaction.guild ?? undefined,
            }),
          ],
        });
        return;
      }
    }

    try {
      await musicService.seek(queue, newPosition / 1000);

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '⏩ Position modifiée',
            description: `Position changée de ${seconds > 0 ? '+' : ''}${seconds} seconde(s).\nNouvelle position: ${formatDurationShort(newPosition / 1000)}`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      await interaction.editReply({
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
