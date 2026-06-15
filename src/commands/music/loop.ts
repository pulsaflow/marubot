/**
 * Commande /loop - Active/désactive la répétition
 */

import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { LoopMode } from '@/music/types';

export default {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Active/désactive la répétition')
    .addStringOption(option =>
      option
        .setName('mode')
        .setDescription('Mode de répétition')
        .setRequired(true)
        .addChoices(
          { name: 'Désactivé', value: 'off' },
          { name: 'Piste actuelle', value: 'track' },
          { name: 'File d\'attente', value: 'queue' }
        )
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

      const mode = interaction.options.getString('mode', true) as LoopMode;
      session.setLoop(mode);

      const modeText = mode === 'off' ? 'désactivée' : mode === 'track' ? 'activée (piste)' : 'activée (queue)';
      
      const embed = createSuccessEmbed({
        title: '🔁 Répétition',
        description: `La répétition a été **${modeText}**`,
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
