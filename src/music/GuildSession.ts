/**
 * GuildSession - Gère l'état musical d'un serveur
 */

import {
  VoiceConnection,
  AudioPlayer,
  createAudioPlayer,
  joinVoiceChannel,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import type { VoiceBasedChannel, TextBasedChannel } from 'discord.js';
import { Track } from './Track';
import type { LoopMode } from './types';
import { createAudioResourceFromTrack } from './providers/resource';
import { logger } from '../services/LoggerService';

export class GuildSession {
  public readonly guildId: string;
  public voiceChannel: VoiceBasedChannel;
  public textChannel: TextBasedChannel;
  public connection: VoiceConnection;
  public player: AudioPlayer;
  public queue: Track[] = [];
  public currentTrack: Track | null = null;
  public volume: number = 100;
  public loop: LoopMode = 'off';

  constructor(guildId: string, voiceChannel: VoiceBasedChannel, textChannel: TextBasedChannel) {
    this.guildId = guildId;
    this.voiceChannel = voiceChannel;
    this.textChannel = textChannel;

    // Créer la connexion vocale
    this.connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    });

    // Créer le player
    this.player = createAudioPlayer();

    // Attacher le player à la connexion
    this.connection.subscribe(this.player);

    // Gérer les événements du player
    this.setupPlayerEvents();
    this.setupConnectionEvents();
  }

  private setupPlayerEvents(): void {
    this.player.on(AudioPlayerStatus.Playing, () => {
      logger.debug(`[Music] Lecture démarrée dans ${this.guildId}`);
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      logger.debug(`[Music] Player idle dans ${this.guildId}`);
      this.playNext();
    });

    this.player.on('error', (error) => {
      logger.error(`[Music] Erreur player dans ${this.guildId}:`, error);
      this.playNext();
    });
  }

  private setupConnectionEvents(): void {
    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });
  }

  async play(track: Track): Promise<void> {
    try {
      this.currentTrack = track;
      const resource = await createAudioResourceFromTrack(track, this.volume);
      this.player.play(resource);
    } catch (error) {
      logger.error(`[Music] Erreur lors de la lecture de ${track.title}:`, error);
      this.playNext();
    }
  }

  async playNext(): Promise<void> {
    // Gestion du mode loop
    if (this.loop === 'track' && this.currentTrack) {
      await this.play(this.currentTrack);
      return;
    }

    if (this.loop === 'queue' && this.currentTrack) {
      this.queue.push(this.currentTrack);
    }

    // Jouer la prochaine piste
    const nextTrack = this.queue.shift();
    if (nextTrack) {
      await this.play(nextTrack);
    } else {
      this.currentTrack = null;
    }
  }

  skip(): void {
    this.player.stop();
  }

  pause(): boolean {
    return this.player.pause();
  }

  resume(): boolean {
    return this.player.unpause();
  }

  stop(): void {
    this.queue = [];
    this.currentTrack = null;
    this.player.stop();
  }

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
  }

  setLoop(mode: LoopMode): void {
    this.loop = mode;
  }

  destroy(): void {
    this.player.stop();
    this.connection.destroy();
    this.queue = [];
    this.currentTrack = null;
  }
}
