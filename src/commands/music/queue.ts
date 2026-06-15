/**
 * Commande /queue - Affiche la file d'attente
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Affiche la file d\'attente'),

  cooldown: 3,
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
          description: 'Aucune musique en cours de lecture.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵 File d\'attente')
        .setColor(0x5865f2)
        .addFields({
          name: '▶️ En cours',
          value: `**${session.currentTrack.title}**\n${session.currentTrack.durationFormatted}`,
        });

      if (session.queue.length > 0) {
        const queueList = session.queue
          .slice(0, 10)
          .map((track, i) => `${i + 1}. **${track.title}** - ${track.durationFormatted}`)
          .join('\n');

        embed.addFields({
          name: `📋 Suivant (${session.queue.length} piste(s))`,
          value: queueList + (session.queue.length > 10 ? '\n...' : ''),
        });
      }

      embed.addFields({
        name: '🔁 Mode de répétition',
        value: session.loop === 'off' ? 'Désactivé' : session.loop === 'track' ? 'Piste actuelle' : 'File d\'attente',
        inline: true,
      });

      embed.addFields({
        name: '🔊 Volume',
        value: `${session.volume}%`,
        inline: true,
      });

      if (session.currentTrack.thumbnail) {
        embed.setThumbnail(session.currentTrack.thumbnail);
      }

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
