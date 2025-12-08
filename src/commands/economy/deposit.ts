import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('deposit')
    .setDescription('Dépose de l\'argent à la banque')
    .addIntegerOption((option) =>
      option
        .setName('montant')
        .setDescription('Montant à déposer (ou "all" pour tout)')
        .setRequired(true)
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
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
      // Récupérer ou créer l'économie de l'utilisateur
      let userEconomy = await prisma.userEconomy.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
      });

      if (!userEconomy) {
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

      const amountInput = interaction.options.getInteger('montant', true);
      const amount = amountInput === -1 ? userEconomy.balance : amountInput;

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

      if (amount > userEconomy.balance) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: `Vous n'avez que ${userEconomy.balance.toLocaleString()} en portefeuille.`,
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      await prisma.userEconomy.update({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
        data: {
          balance: userEconomy.balance - amount,
          bank: userEconomy.bank + amount,
        },
      });

      const economyConfig = await prisma.economyConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });
      const currency = economyConfig?.currency || '💰';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Dépôt effectué',
            description: `Vous avez déposé ${currency} ${amount.toLocaleString()} à la banque.`,
            fields: [
              {
                name: 'Nouveau solde',
                value: `${currency} ${(userEconomy.balance - amount).toLocaleString()}`,
                inline: true,
              },
              {
                name: 'Banque',
                value: `${currency} ${(userEconomy.bank + amount).toLocaleString()}`,
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors du dépôt:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du dépôt.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


