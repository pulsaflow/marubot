import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';
import { ensureGuildExists } from '@/utils/guild';

/**
 * Calcule le niveau à partir de l'XP
 */
function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Calcule l'XP nécessaire pour un niveau
 */
function xpForLevel(level: number): number {
  return Math.pow(level / 0.1, 2);
}

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Affiche le niveau et le classement d\'un membre')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à consulter').setRequired(false)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.options.getUser('membre') || interaction.user;

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
      // S'assurer que le Guild existe
      await ensureGuildExists(interaction.guild);

      // Récupérer ou créer la configuration
      let levelConfig = await prisma.levelConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!levelConfig) {
        levelConfig = await prisma.levelConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

      // Récupérer ou créer le niveau de l'utilisateur
      let userLevel = await prisma.userLevel.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: user.id,
          },
        },
      });

      if (!userLevel) {
        userLevel = await prisma.userLevel.create({
          data: {
            guildId: interaction.guild.id,
            userId: user.id,
            xp: 0,
            level: 0,
            messages: 0,
          },
        });
      }

      const level = calculateLevel(userLevel.xp);
      const currentLevelXP = xpForLevel(level);
      const nextLevelXP = xpForLevel(level + 1);
      const progress = userLevel.xp - currentLevelXP;
      const needed = nextLevelXP - currentLevelXP;
      const percentage = Math.floor((progress / needed) * 100);

      // Calculer le classement
      const allUsers = await prisma.userLevel.findMany({
        where: { guildId: interaction.guild.id },
        orderBy: { xp: 'desc' },
      });

      const rank = allUsers.findIndex((u) => u.userId === user.id) + 1;

      // Barre de progression
      const barLength = 20;
      const filled = Math.floor((progress / needed) * barLength);
      const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

      await interaction.editReply({
        embeds: [
          createInfoEmbed({
            title: `📊 Niveau de ${user.tag}`,
            description: `**Niveau:** ${level}\n**XP:** ${userLevel.xp.toLocaleString()}\n**Messages:** ${userLevel.messages.toLocaleString()}\n**Classement:** #${rank}`,
            fields: [
              {
                name: 'Progression',
                value: `${bar} ${percentage}%\n${progress.toLocaleString()} / ${needed.toLocaleString()} XP`,
              },
            ],
            thumbnail: user.displayAvatarURL(),
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération du niveau:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération du niveau.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








