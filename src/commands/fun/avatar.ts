import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed } from '@/utils/embeds';

export default {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Affiche l\'avatar d\'un utilisateur')
    .addUserOption((option) =>
      option.setName('utilisateur').setDescription('L\'utilisateur').setRequired(false)
    ),

  cooldown: 3,
  guildOnly: false,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.options.getUser('utilisateur') || interaction.user;
    const avatarURL = user.displayAvatarURL({ size: 4096 });

    await interaction.editReply({
      embeds: [
        createInfoEmbed({
          title: `🖼️ Avatar de ${user.tag}`,
          image: avatarURL,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;








