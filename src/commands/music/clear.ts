/**
 * Commande /clearqueue - Vide la file d'attente
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('clearqueue')
    .setDescription('Vide la file d\'attente musicale'),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const bot = getBotFromClient(interaction.client);
      const session = bot?.musicManager.getSession(interaction.guildId!);

      if (!session || session.queue.length === 0) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'La file d\'attente est déjà vide.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const count = session.queue.length;
      session.queue = [];

      const embed = createSuccessEmbed({
        title: '🗑️ File d\'attente vidée',
        description: `**${count}** piste(s) ont été retirées de la file d'attente.`,
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
