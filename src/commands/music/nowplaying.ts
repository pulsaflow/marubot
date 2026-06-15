/**
 * Commande /nowplaying - Affiche la musique en cours
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Affiche la musique en cours'),

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

      const track = session.currentTrack;
      const embed = new EmbedBuilder()
        .setTitle('🎵 En cours de lecture')
        .setDescription(`**${track.title}**`)
        .setColor(0x5865f2)
        .addFields(
          { name: '⏱️ Durée', value: track.durationFormatted, inline: true },
          { name: '🔊 Volume', value: `${session.volume}%`, inline: true },
          { name: '🔁 Répétition', value: session.loop === 'off' ? 'Désactivé' : session.loop === 'track' ? 'Piste' : 'Queue', inline: true }
        );

      if (track.author) {
        embed.addFields({ name: '👤 Artiste', value: track.author, inline: true });
      }

      if (track.thumbnail) {
        embed.setThumbnail(track.thumbnail);
      }

      embed.addFields({ name: '🔗 Lien', value: track.url });

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
