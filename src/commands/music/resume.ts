/**
 * Commande /resume - Reprend la musique
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Reprend la musique'),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const bot = getBotFromClient(interaction.client);
      const session = bot?.musicManager.getSession(interaction.guildId!);

      if (!session || !session.currentTrack) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'Aucune musique en pause.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const resumed = session.resume();

      if (!resumed) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'La musique n\'est pas en pause.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = createSuccessEmbed({
        title: '▶️ Reprise',
        description: 'La musique a repris.',
        guild: interaction.guild ?? undefined,
      });
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      const embed = createErrorEmbed({
        title: '❌ Erreur',
        description: 'Une erreur est survenue.',
        guild: interaction.guild ?? undefined,
      });
      await interaction.editReply({ embeds: [embed] });
    }
  },
} as Command;
