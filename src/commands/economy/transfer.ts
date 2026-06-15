import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('transfer')
    .setDescription('Transfère de l\'argent à un autre membre')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à qui transférer').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('montant').setDescription('Montant à transférer').setRequired(true)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const targetUser = interaction.options.getUser('membre', true);
    const amount = interaction.options.getInteger('montant', true);

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

    if (targetUser.id === interaction.user.id) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous ne pouvez pas vous transférer de l\'argent à vous-même.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    if (targetUser.bot) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous ne pouvez pas transférer de l\'argent à un bot.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    if (amount <= 0) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Le montant doit être supérieur à 0.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    try {
      // Récupérer l'économie de l'expéditeur
      let senderEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
      });

      if (!senderEconomy) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Vous n\'avez pas encore de compte. Utilisez `/daily` pour commencer.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      if (amount > senderEconomy.balance) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: `Vous n'avez que ${senderEconomy.balance.toLocaleString()} en portefeuille.`,
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Récupérer ou créer l'économie du destinataire
      let targetEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: targetUser.id,
          },
        },
      });

      if (!targetEconomy) {
        const economyConfig = await prisma.economyConfig.findUnique({
          where: { guildId: interaction.guild.id },
        });
        targetEconomy = await prisma.userEconomy.create({
          data: {
            guildId: interaction.guild.id,
            userId: targetUser.id,
            balance: economyConfig?.startBalance || 0,
            bank: 0,
          },
        });
      }

      // Effectuer le transfert
      await prisma.userEconomy.update({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
        data: {
          balance: senderEconomy.balance - amount,
        },
      });

      await prisma.userEconomy.update({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: targetUser.id,
          },
        },
        data: {
          balance: targetEconomy.balance + amount,
        },
      });

      const economyConfig = await prisma.economyConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });
      const currency = economyConfig?.currency || '💰';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Transfert effectué',
            description: `Vous avez transféré ${currency} ${amount.toLocaleString()} à ${targetUser.tag}.`,
            fields: [
              {
                name: 'Votre nouveau solde',
                value: `${currency} ${(senderEconomy.balance - amount).toLocaleString()}`,
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors du transfert:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du transfert.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








