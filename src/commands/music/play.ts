/**
 * Commande /play - Joue une musique
 */

import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import type { Command } from '@/types';
import { getBotFromClient } from '@/core/Bot';
import { resolveQuery } from '@/music/providers/resolver';
import { Track } from '@/music';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Joue une musique depuis YouTube')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('URL YouTube ou recherche')
        .setRequired(true)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
      }

      const member = interaction.member as GuildMember;
      if (!member.voice.channel) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'Vous devez être dans un salon vocal.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const query = interaction.options.getString('query', true);
      const bot = getBotFromClient(interaction.client);

      if (!bot?.musicManager) {
        throw new Error('MusicManager non initialisé');
      }

      // Résoudre la requête
      const tracks = await resolveQuery(query, interaction.user.id);

      if (tracks.length === 0) {
        const embed = createErrorEmbed({
          title: '❌ Erreur',
          description: 'Aucun résultat trouvé.',
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Créer ou récupérer la session
      const session = bot.musicManager.getOrCreateSession(
        interaction.guildId!,
        member.voice.channel,
        interaction.channel!
      );

      // Ajouter à la queue
      const trackObjects = tracks.map(t => new Track(t));
      const wasPlaying = session.currentTrack !== null;

      if (trackObjects.length === 1) {
        session.queue.push(trackObjects[0]);
        
        if (!wasPlaying) {
          await session.playNext();
        }

        const embed = createSuccessEmbed({
          title: wasPlaying ? '➕ Ajouté à la file' : '▶️ Lecture en cours',
          description: `**${trackObjects[0].title}**\n${trackObjects[0].durationFormatted}`,
          guild: interaction.guild ?? undefined,
        });

        if (trackObjects[0].thumbnail) {
          embed.setThumbnail(trackObjects[0].thumbnail);
        }

        await interaction.editReply({ embeds: [embed] });
      } else {
        session.queue.push(...trackObjects);
        
        if (!wasPlaying) {
          await session.playNext();
        }

        const embed = createSuccessEmbed({
          title: '➕ Playlist ajoutée',
          description: `**${trackObjects.length} pistes** ajoutées à la file d'attente`,
          guild: interaction.guild ?? undefined,
        });
        await interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      const embed = createErrorEmbed({
        title: '❌ Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        guild: interaction.guild ?? undefined,
      });
      await interaction.editReply({ embeds: [embed] });
    }
  },
} as Command;
