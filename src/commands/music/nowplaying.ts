import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createErrorEmbed } from '@/utils/embeds';
import { createNowPlayingEmbed, createMusicControls } from '@/utils/musicEmbeds';
import type { Bot } from '@/core/Bot';

export default {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('Affiche les informations sur la musique en cours de lecture'),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // NOTE: deferReply() est déjà fait dans interactionCreate.ts
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const bot = (interaction.client as any).bot as Bot;
    if (!bot) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Le bot n'est pas initialisé.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }
    const musicService = bot.musicService;

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

    const embed = createNowPlayingEmbed(queue);
    const controls = createMusicControls();

    await interaction.editReply({ embeds: [embed], components: [controls] });
  },
} as Command;
