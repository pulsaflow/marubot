import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Affiche la latence du bot'),

  cooldown: 3,
  guildOnly: false,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Répondre immédiatement pour éviter le timeout
    try {
      // NOTE: deferReply() est déjà fait dans interactionCreate.ts
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const roundtrip = Date.now() - interaction.createdTimestamp;
      const websocket = interaction.client.ws.ping;

      const embed = createSuccessEmbed({
        title: '🏓 Pong!',
        description: `**Latence du bot:** ${roundtrip}ms\n**Latence WebSocket:** ${websocket}ms`,
        guild: interaction.guild ?? undefined,
      });

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      // Si l'interaction a expiré, on ne peut plus répondre
      if (error instanceof Error && error.message.includes('Unknown interaction')) {
        return;
      }

      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: 'Une erreur est survenue.',
            flags: 64, // EPHEMERAL
          });
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: 'Une erreur est survenue lors du calcul de la latence.',
          });
        }
      } catch {
        // Ignorer si on ne peut pas répondre
      }
    }
  },
} as Command;
