/**
 * Commande /volume - Règle le volume
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Règle le volume de la musique')
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Niveau de volume (0-100)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(100)
    ),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const bot = getBotFromClient(interaction.client);
      const session = bot?.musicManager.getSession(interaction.guildId!);

      if (!session) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'Aucune session musicale active.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const volume = interaction.options.getInteger('level', true);
      session.setVolume(volume);

      const embed = createSuccessEmbed({
        title: '🔊 Volume modifié',
        description: `Le volume a été réglé sur **${volume}%**`,
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
