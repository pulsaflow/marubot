import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { QueueRepeatMode } from 'discord-player';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import type { Bot } from '@/core/Bot';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Active ou désactive la répétition')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Mode de répétition')
        .setRequired(true)
        .addChoices(
          { name: 'Désactivé', value: 'off' },
          { name: 'Musique actuelle', value: 'track' },
          { name: "File d'attente", value: 'queue' },
          { name: 'Autoplay', value: 'autoplay' }
        )
    ),

  cooldown: 2,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const bot = (interaction.client as any).bot as Bot;
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

    const member = interaction.member;
    if (isGuildMember(member)) {
      const canControl = await musicService.canControlMusic(member, queue);
      if (!canControl) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Permissions insuffisantes',
              description:
                "Vous n'avez pas la permission de contrôler la musique. Vous devez avoir le rôle DJ.",
              guild: interaction.guild ?? undefined,
            }),
          ],
        });
        return;
      }
    }

    const mode = interaction.options.getString('mode', true);
    let repeatMode: QueueRepeatMode;
    let modeText: string;

    switch (mode) {
      case 'track':
        repeatMode = QueueRepeatMode.TRACK;
        modeText = '🔂 Musique actuelle';
        break;
      case 'queue':
        repeatMode = QueueRepeatMode.QUEUE;
        modeText = "🔁 File d'attente";
        break;
      case 'autoplay':
        repeatMode = QueueRepeatMode.AUTOPLAY;
        modeText = '♾️ Autoplay';
        break;
      default:
        repeatMode = QueueRepeatMode.OFF;
        modeText = '❌ Désactivé';
    }

    musicService.setLoopMode(queue, repeatMode);

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '🔄 Mode de répétition',
          description: `Mode de répétition réglé sur: **${modeText}**`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;
