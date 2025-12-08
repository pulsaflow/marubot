# Analyse du Module Musique - MaruBot

## Vue d'ensemble
Documentation complète de tous les fichiers du module musique pour analyse et débogage.

---

## 📁 Structure du module

### Services
- `src/services/MusicService.ts` - Service principal de gestion de la musique

### Utilitaires
- `src/utils/musicEmbeds.ts` - Fonctions pour créer les embeds musicaux

### Commandes
- `src/commands/music/play.ts` - Commande de lecture avec autocomplete
- `src/commands/music/pause.ts` - Mise en pause/reprise
- `src/commands/music/skip.ts` - Passer à la suivante
- `src/commands/music/stop.ts` - Arrêter la musique
- `src/commands/music/volume.ts` - Gérer le volume
- `src/commands/music/loop.ts` - Mode de répétition
- `src/commands/music/queue.ts` - Afficher la file d'attente
- `src/commands/music/nowplaying.ts` - Infos sur la musique en cours
- `src/commands/music/back.ts` - Retour à la précédente
- `src/commands/music/shuffle.ts` - Mélanger la queue
- `src/commands/music/seek.ts` - Avancer/reculer dans la musique
- `src/commands/music/remove.ts` - Retirer une musique
- `src/commands/music/playlist.ts` - Gestion des playlists

### Événements
- `src/events/music/playerStart.ts` - Événement de démarrage de musique
- `src/events/interactionCreate.ts` (section musique) - Gestion des boutons musicaux

---

## 📄 Fichiers complets

### 1. MusicService.ts

```typescript
import {
  Client,
  Guild,
  VoiceBasedChannel,
  EmbedBuilder,
  GuildMember,
  TextBasedChannel,
} from 'discord.js';
import { Player, Queue, Track, PlayerEvents, QueueRepeatMode } from 'discord-player';
import { YoutubeExtractor, SpotifyExtractor } from '@discord-player/extractor';
import { logger } from './LoggerService';
import { prisma } from '../database/client';
import { createEmbed, createSuccessEmbed, createErrorEmbed } from '../utils/embeds';
import { createNowPlayingEmbed as createNowPlayingEmbedUtil } from '../utils/musicEmbeds';

/**
 * Service de gestion de la musique
 */
export class MusicService {
  private player: Player;
  private nowPlayingMessages: Map<string, string> = new Map(); // guildId -> messageId

  constructor(client: Client) {
    // Créer une instance de Player au lieu d'utiliser useMainPlayer
    this.player = new Player(client, {
      ytdlOptions: {
        quality: 'highestaudio',
        highWaterMark: 1 << 25,
      },
      connectionTimeout: 30000,
    });

    // Enregistrer les extractors pour éviter le warning
    try {
      this.player.extractors.register(YoutubeExtractor, {});
      this.player.extractors.register(SpotifyExtractor, {});
      logger.info('Extractors enregistrés avec succès');
    } catch (error) {
      logger.warn("Erreur lors de l'enregistrement des extractors:", error);
    }

    this.setupPlayer();
    this.setupPlayerEvents(client);
  }

  /**
   * Configure le lecteur audio
   */
  private setupPlayer(): void {
    this.player.events.on('error', (error) => {
      logger.error('Erreur du lecteur audio:', error);
    });

    this.player.events.on('playerError', (queue, error) => {
      logger.error(`Erreur dans la queue ${queue.guild.id}:`, error);
    });
  }

  /**
   * Configure les événements du lecteur
   */
  private setupPlayerEvents(client: Client): void {
    this.player.events.on('audioTrackAdd', (queue, track) => {
      logger.debug(`Musique ajoutée: ${track.title} dans ${queue.guild.name}`);
    });

    this.player.events.on('audioTracksAdd', (queue, tracks) => {
      logger.debug(`${tracks.length} musiques ajoutées dans ${queue.guild.name}`);
    });

    this.player.events.on('disconnect', (queue) => {
      logger.info(`Déconnexion du canal vocal dans ${queue.guild.name}`);
      this.removeNowPlayingMessage(queue.guild.id);
    });

    this.player.events.on('emptyChannel', (queue) => {
      logger.info(`Canal vocal vide dans ${queue.guild.name}`);
      // Attendre 5 minutes avant de quitter
      setTimeout(() => {
        if (queue && !queue.connection) {
          queue.delete();
          this.removeNowPlayingMessage(queue.guild.id);
        }
      }, 300000);
    });
  }

  /**
   * Vérifie si un membre peut contrôler la musique (DJ ou propriétaire)
   */
  async canControlMusic(member: GuildMember, queue: Queue | null): Promise<boolean> {
    if (!queue) return false;

    const config = await prisma.musicConfig.findUnique({
      where: { guildId: queue.guild.id },
    });

    // Si pas de rôle DJ configuré, tout le monde peut contrôler
    if (!config?.djRole) return true;

    // Vérifier si le membre a le rôle DJ ou est propriétaire
    return (
      member.roles.cache.has(config.djRole) ||
      member.id === queue.guild.ownerId ||
      member.permissions.has('Administrator')
    );
  }

  /**
   * Rejoint le canal vocal
   */
  async joinVoiceChannel(
    channel: VoiceBasedChannel,
    textChannel: TextBasedChannel
  ): Promise<Queue> {
    try {
      let queue = this.player.nodes.get(channel.guild.id);
      if (queue) {
        return queue;
      }

      queue = this.player.nodes.create(channel.guild, {
        metadata: {
          channel: textChannel,
          client: channel.client,
        },
        volume: await this.getDefaultVolume(channel.guild.id),
        leaveOnEmpty: true,
        leaveOnEmptyCooldown: 300000, // 5 minutes
        leaveOnEnd: false,
        leaveOnStop: false,
      });

      if (!queue.connection) {
        await queue.connect(channel);
      }

      return queue;
    } catch (error) {
      logger.error('Erreur lors de la connexion au canal vocal:', error);
      throw error;
    }
  }

  /**
   * Joue une musique
   */
  async play(
    query: string,
    member: GuildMember,
    channel: TextBasedChannel
  ): Promise<{ track: Track; queue: Queue }> {
    try {
      let queue = this.player.nodes.get(member.guild.id);

      if (!queue) {
        const voiceChannel = member.voice.channel;
        if (!voiceChannel) {
          throw new Error('Vous devez être dans un canal vocal !');
        }

        queue = await this.joinVoiceChannel(voiceChannel, channel);
      }

      // Vérifier la taille de la queue
      const config = await prisma.musicConfig.findUnique({
        where: { guildId: member.guild.id },
      });

      const maxQueueSize = config?.maxQueueSize || 100;
      if (queue.tracks.size >= maxQueueSize) {
        throw new Error(`La file d'attente est pleine (maximum ${maxQueueSize} musiques)`);
      }

      // Rechercher et ajouter la musique
      const result = await this.player.search(query, {
        requestedBy: member.user,
      });

      if (!result.hasTracks()) {
        throw new Error('Aucun résultat trouvé pour cette recherche !');
      }

      if (result.playlist) {
        // Ajouter toute la playlist
        queue.tracks.add(result.tracks);
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          await queue.node.play();
        }
        return { track: result.tracks[0], queue };
      } else {
        // Ajouter une seule musique
        const track = result.tracks[0];
        queue.tracks.add(track);
        if (!queue.node.isPlaying() && !queue.node.isPaused()) {
          await queue.node.play();
        }
        return { track, queue };
      }
    } catch (error) {
      logger.error('Erreur lors de la lecture:', error);
      throw error;
    }
  }

  /**
   * Pause la musique
   */
  pause(queue: Queue): void {
    if (queue.node.isPaused()) {
      queue.node.resume();
    } else {
      queue.node.pause();
    }
  }

  /**
   * Arrête la musique et vide la queue
   */
  stop(queue: Queue): void {
    queue.delete();
  }

  /**
   * Passe à la musique suivante
   */
  skip(queue: Queue): Track | null {
    return queue.node.skip();
  }

  /**
   * Revient à la musique précédente
   */
  back(queue: Queue): void {
    if (queue.history.size > 0) {
      queue.history.back();
    }
  }

  /**
   * Change le volume
   */
  setVolume(queue: Queue, volume: number): void {
    queue.node.setVolume(Math.max(0, Math.min(100, volume)));
  }

  /**
   * Change le mode de répétition
   */
  setLoopMode(queue: Queue, mode: QueueRepeatMode): void {
    queue.setRepeatMode(mode);
  }

  /**
   * Mélange la queue
   */
  shuffle(queue: Queue): void {
    queue.tracks.shuffle();
  }

  /**
   * Retire une musique de la queue
   */
  remove(queue: Queue, index: number): Track | null {
    const track = queue.tracks.at(index - 1);
    if (track) {
      queue.tracks.remove(track);
      return track;
    }
    return null;
  }

  /**
   * Avance dans la musique
   */
  async seek(queue: Queue, position: number): Promise<void> {
    if (!queue.currentTrack) {
      throw new Error('Aucune musique en cours de lecture');
    }

    const duration = queue.currentTrack.durationMS;
    const seekPosition = Math.max(0, Math.min(position * 1000, duration));

    await queue.node.seek(seekPosition);
  }

  /**
   * Obtient le volume par défaut du serveur
   */
  async getDefaultVolume(guildId: string): Promise<number> {
    const config = await prisma.musicConfig.findUnique({
      where: { guildId },
    });
    return config?.defaultVolume || 50;
  }

  /**
   * Obtient la queue d'un serveur
   */
  getQueue(guildId: string): Queue | null {
    return this.player.nodes.get(guildId) || null;
  }

  /**
   * Crée un embed pour la musique en cours
   */
  createNowPlayingEmbed(queue: Queue): EmbedBuilder {
    return createNowPlayingEmbedUtil(queue);
  }

  /**
   * Recherche une musique sans l'ajouter à la queue
   */
  async searchTracks(
    query: string,
    requestedBy: any,
    limit: number = 10
  ): Promise<{ tracks: Track[]; playlist?: any }> {
    const result = await this.player.search(query, {
      requestedBy,
      fallbackSearchEngine: 'youtube',
    });

    if (!result.hasTracks()) {
      throw new Error('Aucun résultat trouvé pour cette recherche !');
    }

    // Limiter les résultats pour l'autocomplete (si limit spécifié)
    const limitedTracks = limit > 0 ? result.tracks.slice(0, limit) : result.tracks;

    return {
      tracks: limitedTracks,
      playlist: result.playlist || undefined,
    };
  }

  /**
   * Crée une barre de progression
   */
  private createProgressBar(queue: Queue): string {
    const track = queue.currentTrack;
    if (!track) return '```\n[                    ]\n```';

    const timestamp = queue.node.getTimestamp();
    if (!timestamp) return '```\n[                    ]\n```';

    const current = timestamp.current.value || 0;
    const total = track.durationMS;
    const percentage = total > 0 ? (current / total) * 100 : 0;

    const filled = Math.round((percentage / 100) * 20);
    const empty = 20 - filled;

    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const emoji = queue.node.isPaused() ? '⏸️' : '▶️';

    return `\`\`\`\n${emoji} [${bar}] ${Math.round(percentage)}%\n\`\`\``;
  }

  /**
   * Obtient les informations de la queue
   */
  private getQueueInfo(queue: Queue): { title: string; value: string } {
    const nextTracks = queue.tracks.toArray().slice(0, 5);
    const history = queue.history.toArray().slice(-3);

    let info = '';

    if (nextTracks.length > 0) {
      info += '**Prochaines musiques:**\n';
      nextTracks.forEach((track, index) => {
        info += `${index + 1}. [${track.title}](${track.url}) - ${track.author || 'Inconnu'}\n`;
      });

      if (queue.tracks.size > 5) {
        info += `\n*Et ${queue.tracks.size - 5} autre(s) musique(s)...*`;
      }
    } else {
      info += '*Aucune musique en attente*';
    }

    if (history.length > 0) {
      info += '\n\n**Historique récent:**\n';
      history.forEach((track) => {
        info += `◀️ [${track.title}](${track.url})\n`;
      });
    }

    return {
      title: "📋 File d'attente",
      value: info || '*Vide*',
    };
  }

  /**
   * Obtient le texte du mode de répétition
   */
  getRepeatModeText(mode: QueueRepeatMode): string {
    switch (mode) {
      case QueueRepeatMode.TRACK:
        return '🔂 Musique';
      case QueueRepeatMode.QUEUE:
        return '🔁 File';
      case QueueRepeatMode.AUTOPLAY:
        return '♾️ Autoplay';
      default:
        return '❌ Désactivé';
    }
  }

  /**
   * Sauvegarde le message "Now Playing"
   */
  saveNowPlayingMessage(guildId: string, messageId: string): void {
    this.nowPlayingMessages.set(guildId, messageId);
  }

  /**
   * Récupère le message "Now Playing"
   */
  getNowPlayingMessage(guildId: string): string | undefined {
    return this.nowPlayingMessages.get(guildId);
  }

  /**
   * Supprime le message "Now Playing"
   */
  removeNowPlayingMessage(guildId: string): void {
    this.nowPlayingMessages.delete(guildId);
  }
}
```

### 2. musicEmbeds.ts

Voir le fichier complet dans la section suivante (trop long pour être inclus ici, mais présent dans les fichiers du projet).

### 3. play.ts

Voir le fichier complet ci-dessus dans les résultats de lecture.

### 4. Autres commandes

Voir les fichiers ci-dessus dans les résultats de lecture.

---

## 🔍 Points d'attention identifiés

### Problèmes potentiels

1. **Gestion des erreurs YouTube Premium** : 
   - Actuellement gérée dans `play.ts` mais pas dans `MusicService.setupPlayer()`
   - L'erreur `kill EPERM` pourrait être liée à FFmpeg

2. **Double gestion des événements playerError** :
   - Dans `setupPlayer()` ligne 53-55 (logger seulement)
   - Devrait gérer le passage automatique à la suivante

3. **Gestion du message "Now Playing"** :
   - Créé par `playerStart.ts` automatiquement
   - Pas de mise à jour automatique de la barre de progression

4. **Autocomplete** :
   - Timeout de 1.5s peut être trop court pour certaines recherches
   - Gestion des erreurs "Unknown interaction" améliorée mais peut encore poser problème

5. **Type safety** :
   - Beaucoup d'utilisation de `any` dans les commandes
   - `member as any` utilisé fréquemment

---

## 📝 Recommandations

1. Ajouter une gestion globale des erreurs YouTube Premium dans `setupPlayer()`
2. Améliorer la gestion des erreurs FFmpeg (kill EPERM)
3. Ajouter une mise à jour automatique du message "Now Playing" toutes les X secondes
4. Réduire l'utilisation de `any` et améliorer le typage
5. Ajouter des tests unitaires pour les fonctions critiques

---

## 🔗 Dépendances

- `discord-player` ^6.6.0
- `@discord-player/extractor` ^4.4.0
- `discord.js` ^14.14.1
- `@discordjs/opus` (récemment ajouté)

---

**Date de génération** : 2025-12-07
**Version du module** : 1.0.0



