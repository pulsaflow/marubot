import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '@/types';
import { createInfoEmbed } from '@/utils/embeds';

const jokes = [
  "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau !",
  "Qu'est-ce qui est jaune et qui attend ? Jonathan.",
  "Pourquoi les poissons sont-ils si mauvais en mathématiques ? Parce qu'ils vivent dans l'eau !",
  "Qu'est-ce qui est petit, marron et qui fait du bruit ? Un pet dans une bibliothèque.",
  "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent dans le bateau !",
  "Qu'est-ce qui est vert et qui pousse dans le jardin ? Un haricot qui fait du sport !",
  "Pourquoi les oiseaux volent-ils vers le sud en hiver ? Parce que c'est trop loin de marcher !",
  "Qu'est-ce qui est blanc et qui monte ? Un pingouin qui prend l'ascenseur.",
  "Pourquoi les chats n'aiment-ils pas l'eau ? Parce qu'ils ne savent pas nager !",
  "Qu'est-ce qui est jaune et qui ne peut pas nager ? Un canard en plomb.",
];

export default {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Raconte une blague aléatoire'),

  cooldown: 3,
  guildOnly: false,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const joke = jokes[Math.floor(Math.random() * jokes.length)];

    await interaction.editReply({
      embeds: [
        createInfoEmbed({
          title: '😄 Blague',
          description: joke,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
  },
} as Command;


