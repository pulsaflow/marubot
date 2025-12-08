import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Récupère votre récompense quotidienne'),

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
      // Récupérer ou créer la configuration
      let economyConfig = await prisma.economyConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!economyConfig) {
        economyConfig = await prisma.economyConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

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
        userEconomy = await prisma.userEconomy.create({
          data: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            balance: economyConfig.startBalance,
            bank: 0,
          },
        });
      }

      // Vérifier le cooldown
      const now = new Date();
      if (userEconomy.lastDaily) {
        const timeSinceLastDaily = now.getTime() - userEconomy.lastDaily.getTime();
        const hoursSinceLastDaily = timeSinceLastDaily / (1000 * 60 * 60);

        if (hoursSinceLastDaily < 24) {
          const hoursLeft = Math.ceil(24 - hoursSinceLastDaily);
          await interaction.editReply({
            embeds: [
              createErrorEmbed({
                title: '⏰ Cooldown',
                description: `Vous avez déjà récupéré votre récompense quotidienne. Réessayez dans ${hoursLeft} heure(s).`,
                guild: interaction.guild,
              }),
            ],
          });
          return;
        }
      }

      // Donner la récompense
      const newBalance = userEconomy.balance + economyConfig.dailyAmount;
      await prisma.userEconomy.update({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
        data: {
          balance: newBalance,
          lastDaily: now,
        },
      });

      const currency = economyConfig.currency || '💰';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Récompense quotidienne',
            description: `Vous avez reçu ${currency} ${economyConfig.dailyAmount.toLocaleString()} !`,
            fields: [
              {
                name: 'Nouveau solde',
                value: `${currency} ${newBalance.toLocaleString()}`,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération de la récompense quotidienne:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération de la récompense.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


