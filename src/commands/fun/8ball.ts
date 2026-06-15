import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed } from '@/utils/embeds';

const responses = [
  { text: "C'est certain", emoji: '✅' },
  { text: "Sans aucun doute", emoji: '✅' },
  { text: 'Oui, absolument', emoji: '✅' },
  { text: 'Vous pouvez compter dessus', emoji: '✅' },
  { text: 'Comme je le vois, oui', emoji: '✅' },
  { text: 'Probablement', emoji: '🤔' },
  { text: 'Oui', emoji: '✅' },
  { text: 'Les signes pointent vers oui', emoji: '✅' },
  { text: 'Réponse floue, réessayez', emoji: '🤷' },
  { text: 'Demandez plus tard', emoji: '⏰' },
  { text: 'Mieux vaut ne pas vous le dire maintenant', emoji: '🤐' },
  { text: 'Impossible de prédire maintenant', emoji: '🔮' },
  { text: 'Concentrez-vous et redemandez', emoji: '🧘' },
  { text: "Ne comptez pas dessus", emoji: '❌' },
  { text: 'Ma réponse est non', emoji: '❌' },
  { text: 'Mes sources disent non', emoji: '❌' },
  { text: 'Très douteux', emoji: '❌' },
  { text: 'Outlook pas si bon', emoji: '❌' },
];

export default {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Posez une question à la boule magique')
    .addStringOption((option) =>
      option.setName('question').setDescription('Votre question').setRequired(true)
    ),

  cooldown: 3,
  guildOnly: false,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const question = interaction.options.getString('question', true);
    const response = responses[Math.floor(Math.random() * responses.length)];

    await interaction.editReply({
      embeds: [
        createInfoEmbed({
          title: '🎱 Boule magique',
          description: `**Question:** ${question}\n\n**${response.emoji} Réponse:** ${response.text}`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;








