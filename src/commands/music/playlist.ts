import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  SlashCommandSubcommandBuilder,
} from 'discord.js';
import { Command } from '@/types';
import { createSuccessEmbed, createErrorEmbed, createEmbed } from '@/utils/embeds';
import { prisma } from '@/database/client';
import type { Bot } from '@/core/Bot';
import { Track } from 'discord-player';
import { isGuildMember } from '@/utils/typeGuards';

export default {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Gère vos playlists')
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('save')
        .setDescription("Sauvegarde la file d'attente actuelle en playlist")
        .addStringOption((option) =>
          option.setName('nom').setDescription('Nom de la playlist').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('description')
            .setDescription('Description de la playlist')
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option.setName('public').setDescription('Rendre la playlist publique').setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('load')
        .setDescription("Charge une playlist dans la file d'attente")
        .addStringOption((option) =>
          option.setName('nom').setDescription('Nom de la playlist').setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('list')
        .setDescription('Liste vos playlists')
        .addUserOption((option) =>
          option
            .setName('utilisateur')
            .setDescription("Voir les playlists publiques d'un utilisateur")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('delete')
        .setDescription('Supprime une playlist')
        .addStringOption((option) =>
          option.setName('nom').setDescription('Nom de la playlist à supprimer').setRequired(true)
        )
    )
    .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
      subcommand
        .setName('show')
        .setDescription("Affiche le contenu d'une playlist")
        .addStringOption((option) =>
          option.setName('nom').setDescription('Nom de la playlist').setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('utilisateur')
            .setDescription('Propriétaire de la playlist (pour les playlists publiques)')
            .setRequired(false)
        )
    ),

  cooldown: 3,
  guildOnly: true,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const bot = (interaction.client as any).bot as Bot;
    const musicService = bot.musicService;
    const subcommand = interaction.options.getSubcommand();

    const guildId = interaction.guild!.id;
    const userId = interaction.user.id;

    // Assurer que la config existe
    await prisma.musicConfig.upsert({
      where: { guildId },
      create: { guildId },
      update: {},
    });

    try {
      switch (subcommand) {
        case 'save':
          await handleSave(interaction, musicService, guildId, userId);
          break;
        case 'load':
          await handleLoad(interaction, musicService, guildId, userId);
          break;
        case 'list':
          await handleList(interaction, guildId, userId);
          break;
        case 'delete':
          await handleDelete(interaction, guildId, userId);
          break;
        case 'show':
          await handleShow(interaction, guildId, userId);
          break;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: errorMessage,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
    }
  },
} as Command;

async function handleSave(
    interaction: ChatInputCommandInteraction,
    musicService: any,
    guildId: string,
    userId: string
  ): Promise<void> {
    const queue = musicService.getQueue(guildId);

    if (!queue || queue.tracks.size === 0) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: "La file d'attente est vide. Ajoutez des musiques avant de sauvegarder.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const name = interaction.options.getString('nom', true);
    const description = interaction.options.getString('description');
    const isPublic = interaction.options.getBoolean('public') || false;

    // Récupérer toutes les musiques de la queue
    const tracks = [queue.currentTrack, ...queue.tracks.toArray()]
      .filter(Boolean)
      .map((track: Track) => ({
        title: track.title,
        url: track.url,
        author: track.author,
        duration: track.duration,
        thumbnail: track.thumbnail,
      }));

    await prisma.playlist.upsert({
      where: {
        guildId_userId_name: {
          guildId,
          userId,
          name,
        },
      },
      create: {
        guildId,
        userId,
        name,
        description: description || null,
        tracks: tracks as any,
        isPublic,
      },
      update: {
        description: description || null,
        tracks: tracks as any,
        isPublic,
        updatedAt: new Date(),
      },
    });

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '✅ Playlist sauvegardée',
          description: `Playlist **${name}** sauvegardée avec ${tracks.length} musique(s).`,
          fields: description
            ? [
                {
                  name: '📝 Description',
                  value: description,
                  inline: false,
                },
              ]
            : [],
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
}

async function handleLoad(
    interaction: ChatInputCommandInteraction,
    musicService: any,
    guildId: string,
    userId: string
  ): Promise<void> {
    const name = interaction.options.getString('nom', true);

    const playlist = await prisma.playlist.findUnique({
      where: {
        guildId_userId_name: {
          guildId,
          userId,
          name,
        },
      },
    });

    if (!playlist) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Playlist introuvable',
            description: `La playlist "${name}" n'existe pas.`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const member = interaction.member;
    if (!isGuildMember(member)) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Erreur',
            description: 'Vous devez être dans un canal vocal pour charger une playlist.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const tracks = playlist.tracks as any[];
    if (tracks.length === 0) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Playlist vide',
            description: 'Cette playlist est vide.',
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    // Charger les musiques une par une
    let loaded = 0;
    for (const trackData of tracks) {
      try {
        await musicService.play(
          trackData.url || trackData.title,
          member as any,
          interaction.channel as any
        );
        loaded++;
      } catch (error) {
        // Continuer même si une musique échoue
      }
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '✅ Playlist chargée',
          description: `Playlist **${name}** chargée avec ${loaded}/${tracks.length} musique(s).`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
}

async function handleList(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string
  ): Promise<void> {
    const targetUser = interaction.options.getUser('utilisateur');

    const playlists = await prisma.playlist.findMany({
      where: targetUser
        ? {
            guildId,
            userId: targetUser.id,
            isPublic: true,
          }
        : {
            guildId,
            userId,
          },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (playlists.length === 0) {
      await interaction.editReply({
        embeds: [
          createEmbed({
            title: '📋 Playlists',
            description: targetUser
              ? `${targetUser.username} n'a aucune playlist publique.`
              : "Vous n'avez aucune playlist. Utilisez `/playlist save` pour en créer une.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    let list = '';
    playlists.forEach((playlist, index) => {
      const tracksCount = Array.isArray(playlist.tracks) ? (playlist.tracks as any[]).length : 0;
      list += `${index + 1}. **${playlist.name}** (${tracksCount} musique(s))`;
      if (playlist.description) {
        list += ` - ${playlist.description}`;
      }
      if (playlist.isPublic) {
        list += ' 🌐';
      }
      list += '\n';
    });

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: `📋 Playlists ${targetUser ? `de ${targetUser.username}` : ''}`,
          description: list,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
}

async function handleDelete(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string
  ): Promise<void> {
    const name = interaction.options.getString('nom', true);

    const playlist = await prisma.playlist.deleteMany({
      where: {
        guildId,
        userId,
        name,
      },
    });

    if (playlist.count === 0) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Playlist introuvable',
            description: `La playlist "${name}" n'existe pas.`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        createSuccessEmbed({
          title: '✅ Playlist supprimée',
          description: `Playlist **${name}** supprimée avec succès.`,
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
}

async function handleShow(
    interaction: ChatInputCommandInteraction,
    guildId: string,
    userId: string
  ): Promise<void> {
    const name = interaction.options.getString('nom', true);
    const targetUser = interaction.options.getUser('utilisateur') || interaction.user;

    const playlist = await prisma.playlist.findUnique({
      where: {
        guildId_userId_name: {
          guildId,
          userId: targetUser.id,
          name,
        },
      },
    });

    if (!playlist) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Playlist introuvable',
            description: `La playlist "${name}" n'existe pas${targetUser.id !== userId ? " ou n'est pas publique" : ''}.`,
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    if (targetUser.id !== userId && !playlist.isPublic) {
      await interaction.editReply({
        embeds: [
          createErrorEmbed({
            title: '❌ Accès refusé',
            description: "Cette playlist n'est pas publique.",
            guild: interaction.guild ?? undefined,
          }),
        ],
      });
      return;
    }

    const tracks = (playlist.tracks as any[]) || [];
    let tracksList = '';
    tracks.slice(0, 15).forEach((track, index) => {
      tracksList += `${index + 1}. [${track.title}](${track.url || '#'}) - ${track.author || 'Inconnu'}\n`;
    });

    if (tracks.length > 15) {
      tracksList += `\n*Et ${tracks.length - 15} autre(s) musique(s)...*`;
    }

    await interaction.editReply({
      embeds: [
        createEmbed({
          title: `🎵 ${playlist.name}`,
          description: playlist.description || 'Aucune description',
          fields: [
            {
              name: '📊 Informations',
              value: `**Musiques:** ${tracks.length}\n**Propriétaire:** <@${playlist.userId}>\n**Visibilité:** ${playlist.isPublic ? '🌐 Publique' : '🔒 Privée'}\n**Créée:** ${new Date(playlist.createdAt).toLocaleDateString('fr-FR')}`,
              inline: false,
            },
            {
              name: '🎶 Musiques',
              value: tracksList || '*Aucune musique*',
              inline: false,
            },
          ],
          guild: interaction.guild ?? undefined,
        }),
      ],
    });
}
