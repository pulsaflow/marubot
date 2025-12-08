import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Affiche le solde d\'un membre')
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
            userId: user.id,
          },
        },
      });

      if (!userEconomy) {
        userEconomy = await prisma.userEconomy.create({
          data: {
            guildId: interaction.guild.id,
            userId: user.id,
            balance: economyConfig.startBalance,
            bank: 0,
          },
        });
      }

      const currency = economyConfig.currency || '💰';
      const total = userEconomy.balance + userEconomy.bank;

      await interaction.editReply({
        embeds: [
          createInfoEmbed({
            title: `💰 Solde de ${user.tag}`,
            description: `**Portefeuille:** ${currency} ${userEconomy.balance.toLocaleString()}\n**Banque:** ${currency} ${userEconomy.bank.toLocaleString()}\n**Total:** ${currency} ${total.toLocaleString()}`,
            thumbnail: user.displayAvatarURL(),
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération du solde:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération du solde.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


