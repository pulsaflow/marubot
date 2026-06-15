import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * Calcule le niveau à partir de l'XP
 */
function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Affiche le classement des membres par niveau')
    .addIntegerOption((option) =>
      option
        .setName('page')
        .setDescription('Numéro de page (10 membres par page)')
        .setMinValue(1)
        .setRequired(false)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const page = interaction.options.getInteger('page') || 1;
    const perPage = 10;

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
      const allUsers = await prisma.userLevel.findMany({
        where: { guildId: interaction.guild.id },
        orderBy: { xp: 'desc' },
        take: perPage * page,
      });

      if (allUsers.length === 0) {
        await interaction.editReply({
          embeds: [
            createInfoEmbed({
              title: '📊 Classement',
              description: 'Aucun membre n\'a encore gagné d\'XP.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const startIndex = (page - 1) * perPage;
      const pageUsers = allUsers.slice(startIndex, startIndex + perPage);
      const totalPages = Math.ceil(allUsers.length / perPage);

      if (page > totalPages) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: `Page invalide. Il y a ${totalPages} page(s) disponible(s).`,
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const leaderboardText = await Promise.all(
        pageUsers.map(async (userLevel, index) => {
          const rank = startIndex + index + 1;
          const level = calculateLevel(userLevel.xp);
          const user = await interaction.guild!.members.fetch(userLevel.userId).catch(() => null);
          const username = user?.user.tag || 'Utilisateur inconnu';

          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;

          return `${medal} **${username}** - Niveau ${level} (${userLevel.xp.toLocaleString()} XP)`;
        })
      );

      await interaction.editReply({
        embeds: [
          createInfoEmbed({
            title: '📊 Classement',
            description: leaderboardText.join('\n'),
            fields: [
              {
                name: 'Page',
                value: `${page} / ${totalPages}`,
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération du classement:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération du classement.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








