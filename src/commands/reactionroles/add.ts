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
    .setName('reactionrole')
    .setDescription('Configure un rôle par réaction')
    .addStringOption((option) =>
      option.setName('message').setDescription('ID du message').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('emoji').setDescription('Emoji à utiliser').setRequired(true)
    )
    .addRoleOption((option) =>
      option.setName('role').setDescription('Rôle à attribuer').setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('unique')
        .setDescription('Si vrai, retire les autres rôles de ce message')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ManageRoles],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const messageId = interaction.options.getString('message', true);
    const emojiInput = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);
    const unique = interaction.options.getBoolean('unique') || false;

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
      // Récupérer le message
      const message = await interaction.channel.messages.fetch(messageId).catch(() => null);

      if (!message) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Message introuvable. Assurez-vous que le message est dans ce salon.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Extraire l'emoji (peut être un emoji Unicode ou un emoji personnalisé)
      let emoji: string;
      const emojiMatch = emojiInput.match(/<a?:(\w+):(\d+)>/);
      if (emojiMatch) {
        emoji = emojiMatch[2]; // ID de l'emoji personnalisé
      } else {
        emoji = emojiInput; // Emoji Unicode
      }

      // Vérifier si le reaction role existe déjà
      const existing = await prisma.reactionRole.findUnique({
        where: {
          messageId_emoji: {
            messageId: message.id,
            emoji,
          },
        },
      });

      if (existing) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed({
              title: '❌ Erreur',
              description: 'Ce reaction role existe déjà pour ce message et cet emoji.',
              guild: interaction.guild,
            }),
          ],
        });
        return;
      }

      // Créer le reaction role
      await prisma.reactionRole.create({
        data: {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          messageId: message.id,
          emoji,
          roleId: role.id,
          unique,
        },
      });

      // Ajouter la réaction au message
      try {
        await message.react(emojiInput);
      } catch (error) {
        logger.warn('Impossible d\'ajouter la réaction au message:', error);
      }

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Reaction role créé',
            description: `Le rôle ${role} sera attribué lorsqu'un utilisateur réagit avec ${emojiInput} sur ce message.`,
            fields: [
              {
                name: 'Unique',
                value: unique ? 'Oui' : 'Non',
                inline: true,
              },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors de la création du reaction role:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de la création du reaction role.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


