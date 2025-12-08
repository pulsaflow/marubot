import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Track, QueueRepeatMode, GuildQueue } from 'discord-player';

// Type alias pour la lisibilité
type Queue = GuildQueue;
import { createEmbed, createSuccessEmbed } from './embeds';
import { formatDuration as formatDurationUtil } from './formatters';
import { logger } from '../services/LoggerService';

// Alias pour éviter les conflits
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Crée une barre de progression visuelle pour la musique
 */
export function createProgressBar(current: number, total: number, paused = false): string {
  if (total <= 0) return '```\n[                    ] 0%\n```';

  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * 20);
  const empty = 20 - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const emoji = paused ? '⏸️' : '▶️';

  return `\`\`\`\n${emoji} [${bar}] ${Math.round(percentage)}%\n\`\`\``;
}

/**
 * Crée un embed de sélection avec plusieurs résultats de recherche
 */
export function createSearchResultsEmbed(
  tracks: Track[],
  query: string,
  page: number = 1
): EmbedBuilder {
  const tracksPerPage = 10;
  const startIndex = (page - 1) * tracksPerPage;
  const endIndex = Math.min(startIndex + tracksPerPage, tracks.length);
  const pageTracks = tracks.slice(startIndex, endIndex);

  let description = `**Résultats pour:** \`${query}\`\n\n`;
  description += `📊 **${tracks.length} résultat(s) trouvé(s)**\n\n`;

  pageTracks.forEach((track, index) => {
    const globalIndex = startIndex + index + 1;
    const duration = track.duration || 'Inconnue';
    description += `**${globalIndex}.** [${track.title}](${track.url})\n`;
    description += `    👤 ${track.author || 'Inconnu'} • ⏱️ ${duration}\n\n`;
  });

  if (tracks.length > tracksPerPage) {
    description += `\n*Page ${page} sur ${Math.ceil(tracks.length / tracksPerPage)}*`;
  }

  const embed = createEmbed({
    title: '🎵 Résultats de recherche',
    description,
    color: '#5865F2',
    footer: {
      text: 'Sélectionnez une musique en cliquant sur le bouton correspondant (1-10)',
    },
  });

  return embed;
}

/**
 * Crée des boutons de sélection pour les résultats de recherche
 */
export function createSearchResultButtons(
  tracks: Track[],
  page: number = 1,
  interactionId: string
): ActionRowBuilder<ButtonBuilder>[] {
  const tracksPerPage = 10;
  const startIndex = (page - 1) * tracksPerPage;
  const endIndex = Math.min(startIndex + tracksPerPage, tracks.length);
  const pageTracks = tracks.slice(startIndex, endIndex);

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  // Boutons numérotés pour chaque résultat (1-10)
  pageTracks.forEach((track, index) => {
    const globalIndex = startIndex + index + 1;
    const button = new ButtonBuilder()
      .setCustomId(`select_track_${interactionId}_${globalIndex - 1}`)
      .setLabel(`${globalIndex}`)
      .setStyle(ButtonStyle.Primary);

    currentRow.addComponents(button);

    // Maximum 5 boutons par ligne (Discord limite)
    if (currentRow.components.length >= 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  });

  // Ajouter la dernière ligne si elle n'est pas vide
  if (currentRow.components.length > 0) {
    rows.push(currentRow);
  }

  // Boutons de navigation si plusieurs pages
  if (tracks.length > tracksPerPage) {
    const navRow = new ActionRowBuilder<ButtonBuilder>();
    const totalPages = Math.ceil(tracks.length / tracksPerPage);

    if (page > 1) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`search_page_${interactionId}_${page - 1}`)
          .setLabel('◀️ Précédent')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`search_page_info_${interactionId}`)
        .setLabel(`Page ${page}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );

    if (page < totalPages) {
      navRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`search_page_${interactionId}_${page + 1}`)
          .setLabel('Suivant ▶️')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    navRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`search_cancel_${interactionId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );

    rows.push(navRow);
  } else {
    // Si une seule page, ajouter juste le bouton annuler
    const cancelRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`search_cancel_${interactionId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger)
    );
    rows.push(cancelRow);
  }

  return rows;
}

/**
 * Crée un embed de prévisualisation avant de jouer une musique
 */
export function createTrackPreviewEmbed(
  track: Track,
  position?: number,
  queueSize?: number
): EmbedBuilder {
  const embed = createEmbed({
    title: '🎵 Prévisualisation de la musique',
    description: `**[${track.title}](${track.url})**\n\n*La musique sera ajoutée dans quelques instants...*`,
    color: '#FFD700', // Or
    thumbnail: track.thumbnail || undefined,
    image: track.thumbnail || undefined,
    fields: [
      {
        name: '👤 Artiste',
        value: track.author || 'Inconnu',
        inline: true,
      },
      {
        name: '⏱️ Durée',
        value: track.duration || 'Inconnue',
        inline: true,
      },
      {
        name: '🔗 Source',
        value: `[Voir sur ${track.source}](${track.url})`,
        inline: false,
      },
    ],
  });

  if (position && queueSize) {
    embed.addFields({
      name: '📊 Position dans la file',
      value: `Sera ajoutée en position **${position}** sur **${queueSize}** musique(s)`,
      inline: false,
    });
  }

  embed.setFooter({
    text: '⏳ Ajout en cours...',
  });

  return embed;
}

/**
 * Crée un embed "Now Playing" amélioré avec barre de progression
 */
export function createNowPlayingEmbed(queue: Queue): EmbedBuilder {
  // Protection anti-récursion : utiliser des valeurs sécurisées
  const track = queue.currentTrack;
  if (!track) {
    return createEmbed({
      title: '❌ Aucune musique',
      description: "Aucune musique n'est actuellement en cours de lecture.",
      color: '#ED4245',
    });
  }

  // Lire les valeurs de manière sécurisée pour éviter les getters récursifs
  let timestamp;
  let currentTime = 0;
  let paused = false;
  let volume = 50;
  
  try {
    // Essayer de lire l'état sans déclencher d'événements
    if (queue.node && typeof queue.node.getTimestamp === 'function') {
      timestamp = queue.node.getTimestamp();
      currentTime = timestamp?.current?.value || 0;
    }
    
    if (queue.node && typeof queue.node.isPaused === 'function') {
      paused = queue.node.isPaused();
    }
    
    if (queue.node && typeof queue.node.volume !== 'undefined') {
      volume = queue.node.volume;
    }
  } catch (error) {
    // Si erreur, utiliser des valeurs par défaut (ne pas logger pour éviter la récursion)
    // Les valeurs par défaut sont déjà définies ci-dessus
  }

  const totalTime = track.durationMS || 0;
  const progressBar = createProgressBar(currentTime, totalTime, paused);
  const currentFormatted = formatDuration(currentTime / 1000);
  const totalFormatted = formatDuration(totalTime / 1000);

  const embed = createEmbed({
    title: paused ? '⏸️ Musique en pause' : '🎵 Lecture en cours',
    description: `**[${track.title}](${track.url})**`,
    color: paused ? '#FEE75C' : '#57F287',
    thumbnail: track.thumbnail || undefined,
    image: track.thumbnail || undefined,
    fields: [
      {
        name: '👤 Artiste',
        value: track.author || 'Inconnu',
        inline: true,
      },
      {
        name: '⏱️ Durée',
        value: `${currentFormatted} / ${totalFormatted}`,
        inline: true,
      },
      {
        name: '🔊 Volume',
        value: `${volume}%`,
        inline: true,
      },
      {
        name: '📊 Progression',
        value: progressBar,
        inline: false,
      },
      {
        name: '🔄 Mode de répétition',
        value: getRepeatModeText(queue.repeatMode),
        inline: true,
      },
      {
        name: "📋 File d'attente",
        value:
          queue.tracks.size > 0
            ? `${queue.tracks.size} musique(s) en attente`
            : 'Aucune musique en attente',
        inline: true,
      },
    ],
    footer: {
      text: `Demandé par ${track.requestedBy?.username || 'Inconnu'}`,
      iconURL: track.requestedBy?.displayAvatarURL() || undefined,
    },
  });

  return embed;
}

/**
 * Crée un embed pour une musique ajoutée à la queue
 */
export function createTrackAddedEmbed(
  track: Track,
  position: number,
  queueSize: number
): EmbedBuilder {
  return createSuccessEmbed({
    title: '✅ Musique ajoutée',
    description: `**[${track.title}](${track.url})**`,
    thumbnail: track.thumbnail || undefined,
    fields: [
      {
        name: '👤 Artiste',
        value: track.author || 'Inconnu',
        inline: true,
      },
      {
        name: '⏱️ Durée',
        value: track.duration || 'Inconnue',
        inline: true,
      },
      {
        name: '📊 Position',
        value: `Position ${position} sur ${queueSize} musique(s)`,
        inline: false,
      },
    ],
  });
}

/**
 * Crée un embed pour une playlist ajoutée
 */
export function createPlaylistAddedEmbed(
  playlistName: string,
  tracksCount: number,
  firstTrack: Track
): EmbedBuilder {
  return createSuccessEmbed({
    title: '✅ Playlist ajoutée',
    description: `**${playlistName}**`,
    thumbnail: firstTrack.thumbnail || undefined,
    fields: [
      {
        name: '🎵 Musiques',
        value: `${tracksCount} musique(s) ajoutée(s)`,
        inline: true,
      },
      {
        name: '🎼 Première musique',
        value: `[${firstTrack.title}](${firstTrack.url})`,
        inline: false,
      },
    ],
  });
}

/**
 * Crée les boutons de contrôle pour la musique
 */
export function createMusicControls(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('music_pause')
      .setLabel('Pause')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏸️'),
    new ButtonBuilder()
      .setCustomId('music_skip')
      .setLabel('Skip')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⏭️'),
    new ButtonBuilder()
      .setCustomId('music_stop')
      .setLabel('Stop')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⏹️'),
    new ButtonBuilder()
      .setCustomId('music_loop')
      .setLabel('Loop')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔁'),
    new ButtonBuilder()
      .setCustomId('music_queue')
      .setLabel('Queue')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋')
  );
}

/**
 * Obtient le texte du mode de répétition
 */
function getRepeatModeText(mode: QueueRepeatMode | number): string {
  // Discord-player utilise des constantes numériques
  // 0 = OFF, 1 = TRACK, 2 = QUEUE, 3 = AUTOPLAY
  if (typeof mode === 'number') {
    switch (mode) {
      case 1:
        return '🔂 Musique actuelle';
      case 2:
        return "🔁 File d'attente";
      case 3:
        return '♾️ Autoplay';
      default:
        return '❌ Désactivé';
    }
  }

  // Si c'est une constante QueueRepeatMode
  if (mode === QueueRepeatMode.TRACK) return '🔂 Musique actuelle';
  if (mode === QueueRepeatMode.QUEUE) return "🔁 File d'attente";
  if (mode === QueueRepeatMode.AUTOPLAY) return '♾️ Autoplay';
  return '❌ Désactivé';
}

/**
 * Export pour utilisation externe
 */
export { getRepeatModeText };
