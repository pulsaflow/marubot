import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Met en pause ou reprend la musique en cours'),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const bot = (interaction.client as any).bot as Bot;
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

    if (!musicService) {
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

    const wasPaused = queue.node.isPaused();
    musicService.pause(queue);

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: wasPaused ? '▶️ Reprise' : '⏸️ Pause',
          description: wasPaused ? 'La musique a été reprise.' : 'La musique a été mise en pause.',
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
