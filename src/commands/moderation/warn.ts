import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertit un membre du serveur')
    .addUserOption((option) =>
      option.setName('membre').setDescription('Le membre à avertir').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('raison').setDescription("Raison de l'avertissement").setRequired(true)
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
    const reason = interaction.options.getString('raison', true);

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
            description: 'Vous ne pouvez pas vous avertir vous-même.',
            guild: interaction.guild,
          }),
        ],
      });
      return;
    }

    try {
      // Récupérer ou créer la configuration de modération
      let modConfig = await prisma.moderationConfig.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (!modConfig) {
        modConfig = await prisma.moderationConfig.create({
          data: { guildId: interaction.guild.id },
        });
      }

      // Créer la sanction
      const sanction = await prisma.sanction.create({
        data: {
          guildId: interaction.guild.id,
          userId: member.user.id,
          moderatorId: interaction.user.id,
          type: 'WARN',
          reason,
        },
      });

      // Compter les avertissements actifs
      const warningsCount = await prisma.sanction.count({
        where: {
          guildId: interaction.guild.id,
          userId: member.user.id,
          type: 'WARN',
          active: true,
        },
      });

      // Envoyer un message au membre
      try {
        await member.send({
          embeds: [
            createErrorEmbed({
              title: '⚠️ Avertissement',
              description: `Vous avez reçu un avertissement sur **${interaction.guild.name}**`,
              fields: [
                { name: 'Raison', value: reason },
                { name: 'Modérateur', value: `<@${interaction.user.id}>` },
                { name: 'Avertissements totaux', value: warningsCount.toString() },
              ],
            }),
          ],
        });
      } catch {
        // Ignorer si les DMs sont désactivés
      }

      // Vérifier si le membre doit être muté
      if (warningsCount >= modConfig.maxWarnings) {
        // Logique de mute automatique si nécessaire
        logger.info(
          `Membre ${member.user.id} a atteint ${warningsCount} avertissements sur ${interaction.guild.id}`
        );
      }

      await interaction.editReply({
        embeds: [
          createSuccessEmbed({
            title: '✅ Avertissement donné',
            description: `${member.user.tag} a été averti.`,
            fields: [
              { name: 'Raison', value: reason },
              { name: 'Avertissements totaux', value: warningsCount.toString() },
            ],
            guild: interaction.guild,
          }),
        ],
      });
    } catch (error) {
      logger.error("Erreur lors de l'avertissement:", error);
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "Une erreur est survenue lors de l'avertissement.",
            guild: interaction.guild,
          }),
        ],
      });
    }
  },
} as Command;


