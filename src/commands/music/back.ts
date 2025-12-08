import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder().setName('back').setDescription('Revient à la musique précédente'),

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

    if (queue.history.size === 0) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Aucune musique précédente dans l'historique.",
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

    musicService.back(queue);
    const currentTrack = queue.currentTrack;

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '⏮️ Retour',
          description: `Retour à la musique précédente.\n\n🎵 **Lecture en cours:** ${currentTrack?.title || 'Inconnu'}`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
