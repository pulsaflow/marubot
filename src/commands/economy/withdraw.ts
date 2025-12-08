import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Retire de l\'argent de la banque')
    .addIntegerOption((option) =>
      option
        .setName('montant')
        .setDescription('Montant à retirer')
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
      // Récupérer l'économie de l'utilisateur
      const userEconomy = await prisma.userEconomy.findUnique({
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
              description: 'Vous n\'avez pas encore de compte.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const amount = interaction.options.getInteger('montant', true);

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

      if (amount > userEconomy.bank) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: `Vous n'avez que ${userEconomy.bank.toLocaleString()} en banque.`,
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
          balance: userEconomy.balance + amount,
          bank: userEconomy.bank - amount,
        },
      });

      const economyConfig = await prisma.economyConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });
      const currency = economyConfig?.currency || '💰';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Retrait effectué',
            description: `Vous avez retiré ${currency} ${amount.toLocaleString()} de la banque.`,
            fields: [
              {
                name: 'Nouveau solde',
                value: `${currency} ${(userEconomy.balance + amount).toLocaleString()}`,
                inline: true,
              },
              {
                name: 'Banque',
                value: `${currency} ${(userEconomy.bank - amount).toLocaleString()}`,
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors du retrait:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du retrait.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


