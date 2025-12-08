import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * Calcule l'XP nécessaire pour un niveau
 */
function xpForLevel(level: number): number {
  return Math.pow(level / 0.1, 2);
}

export default {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Définit le niveau d\'un membre (admin)')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('niveau')
        .setDescription('Niveau à définir')
        .setMinValue(0)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.options.getUser('membre', true);
    const level = interaction.options.getInteger('niveau', true);

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

    try {
      // Récupérer ou créer la configuration
      let levelConfig = await prisma.levelConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!levelConfig) {
        levelConfig = await prisma.levelConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

      // Calculer l'XP pour ce niveau
      const xp = xpForLevel(level);

      // Récupérer ou créer le niveau de l'utilisateur
      await prisma.userLevel.upsert({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: user.id,
          },
        },
        create: {
          guildId: interaction.guild.id,
          userId: user.id,
          xp,
          level,
          messages: 0,
        },
        update: {
          xp,
          level,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Niveau défini',
            description: `Le niveau de ${user.tag} a été défini à **${level}** (${xp.toLocaleString()} XP).`,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la définition du niveau:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la définition du niveau.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


