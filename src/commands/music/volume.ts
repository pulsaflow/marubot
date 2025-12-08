import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Change le volume de la musique')
    .addIntegerOption((option) =>
      option
        .setName('niveau')
        .setDescription('Volume entre 0 et 100')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(false)
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

    const volume = interaction.options.getInteger('niveau');

    if (volume === null) {
      // Afficher le volume actuel
      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '🔊 Volume actuel',
            description: `Le volume est réglé à **${queue.node.volume}%**.`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    musicService.setVolume(queue, volume);

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '🔊 Volume modifié',
          description: `Le volume a été réglé à **${volume}%**.`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
