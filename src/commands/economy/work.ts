import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

const jobs = [
  { name: 'Développeur', min: 50, max: 200 },
  { name: 'Designer', min: 40, max: 150 },
  { name: 'Serveur', min: 20, max: 80 },
  { name: 'Livreur', min: 15, max: 60 },
  { name: 'Étudiant', min: 10, max: 50 },
  { name: 'Youtuber', min: 100, max: 500 },
  { name: 'Streamer', min: 80, max: 400 },
  { name: 'Artiste', min: 30, max: 120 },
];

export default {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Travaillez pour gagner de l\'argent'),

  cooldown: 300, // 5 minutes
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
      if (userEconomy.lastWork) {
        const timeSinceLastWork = (now.getTime() - userEconomy.lastWork.getTime()) / 1000;

        if (timeSinceLastWork < economyConfig.cooldown) {
          const secondsLeft = Math.ceil(economyConfig.cooldown - timeSinceLastWork);
          await interaction.editReply({
            embeds: [
              createErrorEmbed({
                title: '⏰ Cooldown',
                description: `Vous devez attendre ${secondsLeft} seconde(s) avant de retravailler.`,
                guild: interaction.guild,
              }),
            ],
          });
          return;
        }
      }

      // Choisir un job aléatoire
      const job = jobs[Math.floor(Math.random() * jobs.length)];
      const earnings = Math.floor(
        Math.random() * (job.max - job.min + 1) + job.min
      );

      const newBalance = userEconomy.balance + earnings;
      await prisma.userEconomy.update({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
        data: {
          balance: newBalance,
          lastWork: now,
        },
      });

      const currency = economyConfig.currency || '💰';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '💼 Travail terminé',
            description: `Vous avez travaillé en tant que **${job.name}** et gagné ${currency} ${earnings.toLocaleString()} !`,
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
      logger.error('Erreur lors du travail:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du travail.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


