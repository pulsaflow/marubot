/**
 * MusicManager - Gestionnaire global des sessions musicales
 */

import { GuildSession } from './GuildSession';
import type { VoiceBasedChannel, TextBasedChannel, Client } from 'discord.js';

export class MusicManager {
  private sessions: Map<string, GuildSession> = new Map();

  getSession(guildId: string): GuildSession | undefined {
    return this.sessions.get(guildId);
  }

  createSession(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel
  ): GuildSession {
    const existingSession = this.sessions.get(guildId);
    if (existingSession) {
      existingSession.destroy();
    }

    const session = new GuildSession(guildId, voiceChannel, textChannel);
    this.sessions.set(guildId, session);
    return session;
  }

  deleteSession(guildId: string): void {
    const session = this.sessions.get(guildId);
    if (session) {
      session.destroy();
      this.sessions.delete(guildId);
    }
  }

  getOrCreateSession(
    guildId: string,
    voiceChannel: VoiceBasedChannel,
    textChannel: TextBasedChannel
  ): GuildSession {
    return this.getSession(guildId) ?? this.createSession(guildId, voiceChannel, textChannel);
  }

  tickAutoDisconnect(client: Client): void {
    for (const [guildId, session] of this.sessions.entries()) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          this.deleteSession(guildId);
          continue;
        }

        const voiceChannel = guild.channels.cache.get(session.voiceChannel.id);
        if (!voiceChannel || !voiceChannel.isVoiceBased()) {
          this.deleteSession(guildId);
          continue;
        }

        const members = voiceChannel.members.filter(m => !m.user.bot);
        if (members.size === 0) {
          this.deleteSession(guildId);
        }
      } catch (error) {
        this.deleteSession(guildId);
      }
    }
  }
}
