import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription("Arrête la musique et vide la file d'attente"),

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

    if (!queue) {
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

    musicService.stop(queue);
    musicService.removeNowPlayingMessage(interaction.guild!.id);

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '⏹️ Arrêt',
          description: "La musique a été arrêtée et la file d'attente a été vidée.",
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
