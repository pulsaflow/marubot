import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';
import { ensureGuildExists } from '@/utils/guild';

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute un membre du serveur')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à mute').setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('duree')
        .setDescription('Durée du mute en minutes')
        .setMinValue(1)
        .setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription('Raison du mute').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  cooldown: 3,
  guildOnly: true,
  permissions: [PermissionFlagsBits.ModerateMembers],

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const member = interaction.options.getMember('membre');
    const duration = interaction.options.getInteger('duree');
    const reason = interaction.options.getString('raison') || 'Aucune raison spécifiée';

    if (!member || !interaction.guild) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Membre introuvable ou serveur invalide.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    if (member.user.id === interaction.user.id) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous ne pouvez pas vous mute vous-même.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    try {
      // S'assurer que le Guild existe
      await ensureGuildExists(interaction.guild);

      // Récupérer ou créer la configuration de modération
      let modConfig = await prisma.moderationConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!modConfig) {
        modConfig = await prisma.moderationConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

      // Récupérer ou créer le rôle de mute
      let muteRole = modConfig.muteRole
        ? interaction.guild.roles.cache.get(modConfig.muteRole)
        : null;

      if (!muteRole) {
        // Créer le rôle de mute
        muteRole = await interaction.guild.roles.create({
          name: 'Muted',
          color: '#424549',
          reason: 'Rôle de mute automatique',
        });

        // Désactiver les permissions de parler dans tous les salons
        interaction.guild.channels.cache.forEach(async (channel) => {
          if (channel.isTextBased() || channel.isVoiceBased()) {
            await channel.permissionOverwrites.edit(muteRole!, {
              SendMessages: false,
              Speak: false,
              AddReactions: false,
            });
          }
        });

        // Mettre à jour la config
        await prisma.moderationConfig.update({
          where: { guildId: interaction.guild.id },
          data: { muteRole: muteRole.id },
        });
      }

      // Calculer la date d'expiration
      const durationSeconds = duration ? duration * 60 : null;
      const expiresAt = durationSeconds ? new Date(Date.now() + durationSeconds * 1000) : null;

      // Appliquer le mute
      await member.roles.add(muteRole, reason);

      // Enregistrer la sanction
      await prisma.sanction.create({
        data: {
          guildId: interaction.guild.id,
          userId: member.user.id,
          moderatorId: interaction.user.id,
          type: 'MUTE',
          reason,
          duration: durationSeconds,
          expiresAt,
        },
      });

      const durationText = duration ? `${duration} minute(s)` : 'Permanent';

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Membre muté',
            description: `${member.user.tag} a été muté.`,
            fields: [
              { name: 'Raison', value: reason },
              { name: 'Durée', value: durationText },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error('Erreur lors du mute:', error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors du mute.',
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;








