import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Affiche les informations du serveur'),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (!interaction.guild) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Cette commande ne peut être utilisée que dans un serveur.',
          }),
        ],
      });
      return;
    }

    const guild = interaction.guild;
    const owner = await guild.fetchOwner();

    const fields = [
      {
        name: '👑 Propriétaire',
        value: owner.user.tag,
        inline: true,
      },
      {
        name: '👥 Membres',
        value: guild.memberCount.toString(),
        inline: true,
      },
      {
        name: '📅 Créé le',
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        inline: true,
      },
      {
        name: '📝 Salons',
        value: guild.channels.cache.size.toString(),
        inline: true,
      },
      {
        name: '😀 Emojis',
        value: guild.emojis.cache.size.toString(),
        inline: true,
      },
      {
        name: '🎭 Rôles',
        value: guild.roles.cache.size.toString(),
        inline: true,
      },
    ];

    await interaction.editReply({
      embeds: [
        createInfoEmbed({
          title: `📊 Informations de ${guild.name}`,
          description: guild.description || 'Aucune description',
          fields,
          thumbnail: guild.iconURL(),
          guild,
        }),
      ],
    });
  },
} as Command;


