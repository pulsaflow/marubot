import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Crée un ticket de support')
    .addStringOption((option) =>
      option
        .setName('categorie')
        .setDescription('Catégorie du ticket')
        .setRequired(false)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
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

    try {
      // Récupérer ou créer la configuration
      let ticketConfig = await prisma.ticketConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!ticketConfig) {
        ticketConfig = await prisma.ticketConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

      if (!ticketConfig.enabled) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Le système de tickets n\'est pas activé sur ce serveur.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Vérifier le nombre de tickets de l'utilisateur
      const userTickets = await prisma.ticket.count({
        where: {
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          closed: false,
        },
      });

      if (userTickets >= ticketConfig.maxPerUser) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Limite atteinte',
              description: `Vous avez déjà ${userTickets} ticket(s) ouvert(s). Fermez-en un avant d'en créer un nouveau.`,
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Créer le salon de ticket
      const categoryId = ticketConfig.category || undefined;
      const channel = await interaction.guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: categoryId || undefined,
        permissionOverwrites: [
          {
            id: interaction.guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      // Ajouter le rôle de support si configuré
      if (ticketConfig.supportRole) {
        await channel.permissionOverwrites.edit(ticketConfig.supportRole, {
          ViewChannel: true,
          SendMessages: true,
          ReadMessageHistory: true,
        });
      }

      // Enregistrer le ticket
      await prisma.ticket.create({
        data: {
          guildId: interaction.guild.id,
          channelId: channel.id,
          userId: interaction.user.id,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Ticket créé',
            description: `Votre ticket a été créé : <#${channel.id}>`,
            guild: interaction.guild,
          }),
        ],
      });

      // Message de bienvenue dans le ticket
      await channel.send({
        embeds: [
          createSuccessEmbed({
            title: '🎫 Nouveau ticket',
            description: `Bienvenue <@${interaction.user.id}> !\n\nDécrivez votre problème et un membre du staff vous répondra bientôt.`,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la création du ticket:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la création du ticket.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


