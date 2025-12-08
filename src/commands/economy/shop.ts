import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Affiche la boutique du serveur'),

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

      // Récupérer les articles de la boutique
      const shopItems = await prisma.shopItem.findMany({
        where: {
          guildId: interaction.guild.id,
          enabled: true,
        },
        orderBy: {
          price: 'asc',
        },
      });

      if (shopItems.length === 0) {
        await interaction.editReply({
          embeds: [
            createInfoEmbed({
              title: '🛒 Boutique',
              description: 'La boutique est vide pour le moment.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      const currency = economyConfig.currency || '💰';
      const shopText = shopItems
        .map((item, index) => {
          const stockText = item.stock !== null ? ` (Stock: ${item.stock})` : '';
          return `${index + 1}. **${item.name}** - ${currency} ${item.price.toLocaleString()}${stockText}\n   ${item.description}`;
        })
        .join('\n\n');

      await interaction.editReply({
        embeds: [
          createInfoEmbed({
            title: '🛒 Boutique',
            description: shopText,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la récupération de la boutique:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la récupération de la boutique.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


