import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations d\'un utilisateur')
    .addUserOption((option) =>
      option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(false)
    ),

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

    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);

    if (!member) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Membre introuvable sur ce serveur.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    const roles = member.roles.cache
      .filter((role) => role.id !== interaction.guild!.id)
      .map((role) => role.toString())
      .slice(0, 10)
      .join(', ') || 'Aucun';

    const fields = [
      {
        name: '👤 Utilisateur',
        value: `${user.tag} (${user.id})`,
        inline: false,
      },
      {
        name: '📅 Compte créé le',
        value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`,
        inline: true,
      },
      {
        name: '📥 A rejoint le',
        value: member.joinedAt
          ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:D>`
          : 'Inconnu',
        inline: true,
      },
      {
        name: '🎭 Rôles',
        value: roles.length > 1024 ? roles.substring(0, 1021) + '...' : roles,
        inline: false,
      },
    ];

    if (member.premiumSince) {
      fields.push({
        name: '⭐ Boost depuis',
        value: `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:D>`,
        inline: true,
      });
    }

    await interaction.editReply({
      embeds: [
        createInfoEmbed({
          title: `ℹ️ Informations de ${user.tag}`,
          fields,
          thumbnail: user.displayAvatarURL(),
          guild: interaction.guild,
        }),
      ],
    });
  },
} as Command;








