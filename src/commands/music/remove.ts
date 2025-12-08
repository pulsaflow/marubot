import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription("Retire une musique de la file d'attente")
    .addIntegerOption((option) =>
      option
        .setName('position')
        .setDescription('Position de la musique à retirer (1 = première en attente)')
        .setMinValue(1)
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

    const position = interaction.options.getInteger('position', true);

    if (position > queue.tracks.size) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: `Position invalide. Il n'y a que ${queue.tracks.size} musique(s) dans la file d'attente.`,
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

    const removedTrack = musicService.remove(queue, position);

    if (!removedTrack) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Impossible de retirer cette musique.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '🗑️ Musique retirée',
          description: `**${removedTrack.title}** a été retirée de la file d'attente.`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
