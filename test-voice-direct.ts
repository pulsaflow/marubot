/**
 * Test pour vérifier si les méthodes de chiffrement sont chargées
 */

// IMPORTANT: Ne PAS charger sodium-native ici, laisser @discordjs/voice le faire
const voice = await import('@discordjs/voice');

console.log('✅ @discordjs/voice importé');

// Attendre un peu pour que la promesse secretboxLoadPromise se résolve
console.log('⏳ Attente du chargement des méthodes de chiffrement...');
await new Promise(resolve => setTimeout(resolve, 2000));

console.log('✅ Méthodes de chiffrement chargées (on espère)');

// Tester la connexion
import { Client, GatewayIntentBits } from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

await client.login(process.env.DISCORD_TOKEN);

await new Promise((resolve) => {
  client.once('ready', () => {
    console.log('✅ Bot connecté');
    resolve(true);
  });
});

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

console.log('🎵 Tentative de connexion au canal vocal...');

const connection = voice.joinVoiceChannel({
  channelId: voiceChannel.id,
  guildId: guild.id,
  adapterCreator: guild.voiceAdapterCreator as any,
});

connection.on('error', (error) => {
  console.error('❌ Erreur de connexion:', error.message);
});

connection.on('stateChange', (oldState, newState) => {
  console.log(`🔄 État: ${oldState.status} → ${newState.status}`);
});

await new Promise(resolve => setTimeout(resolve, 5000));

connection.destroy();
await client.destroy();

console.log('✅ Test terminé');
process.exit(0);
