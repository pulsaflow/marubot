import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';
import type { Bot } from '@/core/Bot';

export default {
  data: new SlashCommandBuilder()
    .setName('giveaway-end')
    .setDescription('Termine un giveaway manuellement')
    .addStringOption((option) =>
      option.setName('message').setDescription('ID du message du giveaway').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const messageId = interaction.options.getString('message', true);

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
      const giveaway = await prisma.giveaway.findUnique({
        where: { messageId },
      });

      if (!giveaway) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Giveaway introuvable.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      if (giveaway.ended) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Ce giveaway est déjà terminé.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Terminer le giveaway via le service
      const bot = (interaction.client as any).bot as Bot;
      if (bot?.giveawayService) {
        await bot.giveawayService.endGiveaway(giveaway.id);
      } else {
        // Fallback si le service n'est pas disponible
        await prisma.giveaway.update({
          where: { id: giveaway.id },
          data: { ended: true },
        });
      }

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Giveaway terminé',
            description: 'Le giveaway a été terminé manuellement.',
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la fin du giveaway:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la fin du giveaway.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








