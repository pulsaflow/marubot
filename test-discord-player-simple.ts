/**
 * Test discord-player avec connexion vocale
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { Player } from 'discord-player';
import { YouTubeExtractor } from '@discord-player/extractor';
import * as dotenv from 'dotenv';
dotenv.config();

console.log('🧪 Test discord-player...\n');

// Attendre que @discordjs/voice charge ses méthodes
await new Promise(resolve => setTimeout(resolve, 1000));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const player = new Player(client);

// Events
player.events.on('error', (queue, error) => {
  console.error('❌ player error:', error.message);
});

player.events.on('connectionError', (queue, error) => {
  console.error('❌ connectionError:', error.message);
});

player.events.on('playerStart', (queue, track) => {
  console.log('✅ playerStart:', track.title);
});

await client.login(process.env.DISCORD_TOKEN);

await new Promise((resolve) => {
  client.once('ready', () => {
    console.log('✅ Bot connecté');
    resolve(true);
  });
});

// Charger extracteur
await player.extractors.register(YouTubeExtractor, {});
console.log('✅ Extracteur chargé\n');

const guild = client.guilds.cache.get(process.env.GUILD_ID || '');
if (!guild) {
  console.error('❌ Guild introuvable');
  process.exit(1);
}

const voiceChannel = guild.channels.cache.get(process.env.VOICE_CHANNEL_ID || '') as any;
if (!voiceChannel) {
  console.error('❌ Canal vocal introuvable');
  process.exit(1);
}

console.log('🎵 Recherche...');
const result = await player.search('test audio 5 seconds');

if (!result.hasTracks()) {
  console.error('❌ Aucune piste');
  process.exit(1);
}

console.log(`✅ Piste trouvée: ${result.tracks[0].title}`);
console.log('⏳ Lecture...\n');

try {
  const { track, queue } = await player.play(voiceChannel, result, {
    nodeOptions: {
      volume: 30,
      selfDeaf: true,
    },
  });

  console.log(`✅ En lecture: ${track.title}`);
  
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  queue.delete();
  console.log('✅ Arrêté');
  
} catch (error) {
  console.error('❌ Erreur play:', error instanceof Error ? error.message : error);
}

await client.destroy();
process.exit(0);
