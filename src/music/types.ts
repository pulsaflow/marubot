/**
 * Types pour le module musique
 * Base: @discordjs/voice + play-dl
 */

import type { VoiceConnection, AudioPlayer } from '@discordjs/voice';
import type { VoiceBasedChannel, TextBasedChannel } from 'discord.js';
import type { Track } from './Track';

export interface TrackData {
  title: string;
  url: string;
  duration: number;
  thumbnail?: string;
  author?: string;
  requestedBy: string;
}

export type LoopMode = 'off' | 'track' | 'queue';

export interface GuildSessionData {
  guildId: string;
  voiceChannel: VoiceBasedChannel;
  textChannel: TextBasedChannel;
  connection: VoiceConnection;
  player: AudioPlayer;
  queue: Track[];
  currentTrack: Track | null;
  volume: number;
  loop: LoopMode;
}
