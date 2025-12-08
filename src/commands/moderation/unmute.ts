import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retire le mute d\'un membre')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à unmute').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const member = interaction.options.getMember('membre');

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

    try {
      // Récupérer la configuration de modération
      const modConfig = await prisma.moderationConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!modConfig || !modConfig.muteRole) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Aucun rôle de mute configuré sur ce serveur.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const muteRole = interaction.guild.roles.cache.get(modConfig.muteRole);
      if (!muteRole) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Le rôle de mute n\'existe plus.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      if (!member.roles.cache.has(muteRole.id)) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Ce membre n\'est pas muté.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Retirer le rôle de mute
      await member.roles.remove(muteRole, `Unmute par ${interaction.user.tag}`);

      // Désactiver les sanctions de mute actives
      await prisma.sanction.updateMany({
        where: {
          guildId: interaction.guild.id,
          userId: member.user.id,
          type: 'MUTE',
          active: true,
        },
        data: {
          active: false,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Membre unmuté',
            description: `${member.user.tag} n'est plus muté.`,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de l\'unmute:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de l\'unmute.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


