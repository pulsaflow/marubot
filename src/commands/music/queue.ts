import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createEmbed, createErrorEmbed } from '@/utils/embeds';
import { formatDuration } from '@/utils/formatters';
import type { Bot } from '@/core/Bot';

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription("Affiche la file d'attente des musiques")
    .addIntegerOption((option) =>
      option.setName('page').setDescription('Numéro de la page à afficher').setMinValue(1)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const bot = (interaction.client as any).bot as Bot;
    if (!bot || !bot.musicService) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Le service de musique n'est pas disponible.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }
    const musicService = bot.musicService;

    if (!musicService) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Le service de musique n'est pas disponible.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

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

    const page = (interaction.options.getInteger('page') || 1) - 1;
    const tracksPerPage = 10;
    const totalPages = Math.ceil(queue.tracks.size / tracksPerPage);

    if (page >= totalPages) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Page invalide',
            description: `Il n'y a que ${totalPages} page(s) disponible(s).`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const tracks = queue.tracks.toArray().slice(page * tracksPerPage, (page + 1) * tracksPerPage);

    const currentTrack = queue.currentTrack;
    const totalDuration =
      queue.tracks.reduce((acc: number, track: any) => acc + (track.durationMS || 0), 0) +
      (currentTrack?.durationMS || 0);

    let queueList = `**🎵 Lecture en cours:**\n[${currentTrack.title}](${currentTrack.url}) - ${formatDuration((currentTrack.durationMS || 0) / 1000)}\n\n`;

    if (tracks.length > 0) {
      queueList += "**📋 File d'attente:**\n";
      tracks.forEach((track: any, index: number) => {
        const position = page * tracksPerPage + index + 1;
        queueList += `${position}. [${track.title}](${track.url}) - ${formatDuration((track.durationMS || 0) / 1000)}\n`;
      });
    } else {
      queueList += '*Aucune musique en attente*';
    }

    const embed = createEmbed({
      title: "📋 File d'attente",
      description: queueList,
      fields: [
        {
          name: '📊 Statistiques',
          value: `**Total:** ${queue.tracks.size + 1} musique(s)\n**Durée totale:** ${formatDuration(totalDuration / 1000)}\n**Volume:** ${queue.node.volume}%\n**Mode répétition:** ${musicService.getRepeatModeText?.(queue.repeatMode) || 'Désactivé'}`,
          inline: false,
        },
      ],
      footer: {
        text: totalPages > 1 ? `Page ${page + 1}/${totalPages}` : '',
      },
      guild: interaction.guild ?? undefined,
    });

    await interaction.editReply({ embeds: [embed] });
  },
} as Command;
