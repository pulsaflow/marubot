import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('sanctions')
    .setDescription("Affiche les sanctions d'un membre")
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à consulter').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.options.getUser('membre', true);

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
      const sanctions = await prisma.sanction.findMany({
        where: {
          guildId: interaction.guild.id,
          userId: user.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      if (sanctions.length === 0) {
        await interaction.editReply({
          embeds: [
            createInfoEmbed({
              title: '📋 Sanctions',
              description: `${user.tag} n'a aucune sanction enregistrée.`,
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const sanctionsText = sanctions
        .map((sanction, index) => {
          const typeEmoji = {
            NOTE: '📝',
            WARN: '⚠️',
            MUTE: '🔇',
            KICK: '👢',
            BAN: '🔨',
          }[sanction.type];

          const date = new Date(sanction.createdAt).toLocaleDateString('fr-FR');
          const active = sanction.active ? '✅' : '❌';

          return `${index + 1}. ${typeEmoji} **${sanction.type}** ${active}\n   Raison: ${sanction.reason}\n   Date: ${date}`;
        })
        .join('\n\n');

      await interaction.editReply({
        embeds: [
          createInfoEmbed({
            title: `📋 Sanctions de ${user.tag}`,
            description: sanctionsText,
            fields: [
              {
                name: 'Total',
                value: sanctions.length.toString(),
                inline: true,
              },
              {
                name: 'Actives',
                value: sanctions.filter((s) => s.active).length.toString(),
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération des sanctions:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération des sanctions.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


