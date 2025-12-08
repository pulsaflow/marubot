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
    .setName('ticket-close')
    .setDescription('Ferme un ticket')
    .addStringOption((option) =>
      option.setName('raison').setDescription('Raison de la fermeture').setRequired(false)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    if (!interaction.guild || !interaction.channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Cette commande ne peut être utilisée que dans un salon textuel.',
          }),
        ],
      });
      return;
    }

    try {
      // Vérifier si c'est un ticket
      const ticket = await prisma.ticket.findUnique({
        where: { channelId: interaction.channel.id },
      });

      if (!ticket) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Ce salon n\'est pas un ticket.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      if (ticket.closed) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Ce ticket est déjà fermé.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Vérifier les permissions
      const isOwner = ticket.userId === interaction.user.id;
      const isStaff =
        interaction.member &&
        typeof interaction.member.permissions !== 'string' &&
        interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !isStaff) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Vous n\'avez pas la permission de fermer ce ticket.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

      // Mettre à jour le ticket
      await prisma.ticket.update({
        where: { channelId: interaction.channel.id },
        data: {
          closed: true,
          closedAt: new Date(),
          closedBy: interaction.user.id,
          closeReason: reason,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Ticket fermé',
            description: `Le ticket a été fermé par <@${interaction.user.id}>.\n**Raison:** ${reason}`,
            guild: interaction.guild,
          }),
        ],
      });

      // Supprimer le salon après 5 secondes
      setTimeout(async () => {
        try {
          await interaction.channel?.delete();
        } catch (error) {
          logger.error('Erreur lors de la suppression du ticket:', error);
        }
      }, 5000);
    } catch (error) {
      logger.error('Erreur lors de la fermeture du ticket:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la fermeture du ticket.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


