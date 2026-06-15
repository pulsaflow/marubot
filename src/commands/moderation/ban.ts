import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannit un membre du serveur')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à bannir').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Raison du bannissement').setRequired(false)
    )
    .addIntegerOption((option) =>
      option
        .setName('jours')
        .setDescription('Nombre de jours de messages à supprimer (0-7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.BanMembers],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.options.getUser('membre', true);
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';
    const deleteDays = interaction.options.getInteger('jours') || 0;

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

    if (user.id === interaction.user.id) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous ne pouvez pas vous bannir vous-même.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    try {
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (member) {
        if (
          member.roles.highest.position >= (interaction.member?.roles as any)?.highest?.position
        ) {
          await interaction.editReply({
            embeds: [
              createErrorEmbed({
                title: '❌ Erreur',
                description: 'Vous ne pouvez pas bannir ce membre (rôle supérieur ou égal).',
                guild: interaction.guild,
              }),
            ],
          });
          return;
        }
      }

      // Bannir le membre
      await interaction.guild.members.ban(user, {
        reason: `${interaction.user.tag}: ${reason}`,
        deleteMessageDays: deleteDays,
      });

      // Enregistrer la sanction
      await prisma.sanction.create({
        data: {
          guildId: interaction.guild.id,
          userId: user.id,
          moderatorId: interaction.user.id,
          type: 'BAN',
          reason,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Membre banni',
            description: `${user.tag} a été banni du serveur.`,
            fields: [
              { name: 'Raison', value: reason },
              { name: 'Messages supprimés', value: `${deleteDays} jour(s)` },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors du bannissement:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du bannissement.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








