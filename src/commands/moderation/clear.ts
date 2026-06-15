import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime plusieurs messages')
    .addIntegerOption((option) =>
      option
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1-100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageMessages],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ ephemeral: true });
    }

    const amount = interaction.options.getInteger('nombre', true);

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
      // Récupérer les messages (limite de 100)
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const filteredMessages = messages.filter(
        (msg) => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
      );

      if (filteredMessages.size === 0) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Aucun message récent à supprimer (les messages doivent avoir moins de 14 jours).',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Supprimer les messages
      await interaction.channel.bulkDelete(filteredMessages, true);

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Messages supprimés',
            description: `${filteredMessages.size} message(s) supprimé(s).`,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la suppression des messages:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la suppression des messages.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








