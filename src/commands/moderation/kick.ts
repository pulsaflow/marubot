import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulse un membre du serveur')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à expulser').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription("Raison de l'expulsion").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.KickMembers],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const member = interaction.options.getMember('membre');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    if (!member || !interaction.guild) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Membre introuvable ou serveur invalide.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    if (member.user.id === interaction.user.id) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous ne pouvez pas vous expulser vous-même.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    if (!member.kickable) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description:
              'Ce membre ne peut pas être expulsé (rôle supérieur ou permissions insuffisantes).',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    try {
      // Expulser le membre
      await member.kick(`${interaction.user.tag}: ${reason}`);

      // Enregistrer la sanction
      await prisma.sanction.create({
        data: {
          guildId: interaction.guild.id,
          userId: member.user.id,
          moderatorId: interaction.user.id,
          type: 'KICK',
          reason,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Membre expulsé',
            description: `${member.user.tag} a été expulsé du serveur.`,
            fields: [{ name: 'Raison', value: reason }],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error("Erreur lors de l'expulsion:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Une erreur est survenue lors de l'expulsion.",
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


