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
    .setName('giveaway')
    .setDescription('Crée un giveaway')
    .addStringOption((option) =>
      option.setName('prize').setDescription('Le prix à gagner').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('duree')
        .setDescription('Durée en minutes')
        .setMinValue(1)
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('winners')
        .setDescription('Nombre de gagnants')
        .setMinValue(1)
        .setMaxValue(10)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageGuild],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const prize = interaction.options.getString('prize', true);
    const duration = interaction.options.getInteger('duree', true);
    const winners = interaction.options.getInteger('winners') || 1;

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
      const endAt = new Date(Date.now() + duration * 60 * 1000);

      // Créer le message du giveaway
      const embed = createSuccessEmbed({
        title: '🎉 Giveaway !',
        description: `**Prix:** ${prize}\n**Gagnants:** ${winners}\n**Fin:** <t:${Math.floor(endAt.getTime() / 1000)}:R>`,
        fields: [
          {
            name: 'Participants',
            value: '0',
            inline: true,
          },
        ],
        guild: interaction.guild,
      });

      const message = await interaction.channel.send({
        embeds: [embed],
      });

      // Ajouter la réaction
      await message.react('🎉');

      // Enregistrer le giveaway
      await prisma.giveaway.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          messageId: message.id,
          prize,
          winners,
          endAt,
          hostId: interaction.user.id,
        },
      });

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Giveaway créé',
            description: `Le giveaway a été créé avec succès !`,
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la création du giveaway:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la création du giveaway.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








