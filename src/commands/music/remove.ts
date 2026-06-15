/**
 * Commande /remove - Retire une musique de la queue
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Retire une musique de la file d\'attente')
    .addIntegerOption(option =>
      option
        .setName('position')
        .setDescription('Position dans la queue (1 = première)')
        .setRequired(true)
        .setMinValue(1)
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

      if (!session || session.queue.length === 0) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'La file d\'attente est vide.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const position = interaction.options.getInteger('position', true);

      if (position > session.queue.length) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: `Position invalide. La queue contient ${session.queue.length} piste(s).`,
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const removed = session.queue.splice(position - 1, 1)[0];

      const embed = createSuccessEmbed({
        title: '🗑️ Piste retirée',
        description: `**${removed.title}** a été retirée de la file d'attente.`,
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
