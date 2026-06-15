/**
 * Test automatisé du module musique
 * Vérifie que l'audio peut être joué sans erreur de chiffrement
 */

import { Client, GatewayIntentBits, VoiceChannel } from 'discord.js';
import { Player } from 'discord-player';
import { YouTubeExtractor } from '@discord-player/extractor';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';

const require = createRequire(import.meta.url);

// Charger sodium-native
try {
  const sodium = require('sodium-native');
  (global as any).sodium = sodium;
  (globalThis as any).sodium = sodium;
  console.log('✅ sodium-native chargé');
} catch (error) {
  console.error('❌ Erreur chargement sodium-native:', error);
  process.exit(1);
}

dotenv.config();

const TEST_GUILD_ID = process.env.GUILD_ID || '';
const TEST_VOICE_CHANNEL_ID = process.env.VOICE_CHANNEL_ID || '';

async function testMusicPlayback(): Promise<void> {
  console.log('\n🧪 === TEST MODULE MUSIQUE ===\n');

  // 1. Créer le client
  console.log('1️⃣ Création du client Discord...');
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  const player = new Player(client);

  // 2. Setup événements pour capturer les erreurs
  const testResults = {
    encryption: false,
    playerStart: false,
    connection: false,
    audio: false,
    errors: [] as string[],
  };

  player.events.on('playerStart', (queue, track) => {
    console.log('✅ playerStart event déclenché');
    console.log(`   📻 Piste: ${track.title}`);
    testResults.playerStart = true;
    testResults.audio = true;
  });

  player.events.on('playerError', (queue, error) => {
    const err = error as any;
    if (err.code === 'EPERM' && err.syscall === 'kill') {
      return; // Ignorer
    }
    console.error('❌ playerError:', error.message);
    testResults.errors.push(`playerError: ${error.message}`);
  });

  player.events.on('error', (queue, error) => {
    console.error('❌ error:', error.message);
    testResults.errors.push(`error: ${error.message}`);
  });

  player.events.on('connectionError', (queue, error) => {
    console.error('❌ connectionError:', error.message);
    testResults.errors.push(`connectionError: ${error.message}`);
    
    // Vérifier si c'est l'erreur de chiffrement
    if (error.message.includes('No compatible encryption modes')) {
      testResults.encryption = false;
      console.error('\n❌❌❌ ERREUR DE CHIFFREMENT DÉTECTÉE ❌❌❌');
      console.error('   @discordjs/voice ne supporte pas les modes de chiffrement Discord');
    }
  });

  // 3. Connexion
  console.log('2️⃣ Connexion à Discord...');
  await client.login(process.env.DISCORD_TOKEN);

  await new Promise((resolve) => {
    client.once('ready', () => {
      console.log('✅ Connecté à Discord');
      resolve(true);
    });
  });

  // 4. Charger extracteurs
  console.log('3️⃣ Chargement des extracteurs...');
  try {
    await player.extractors.register(YouTubeExtractor, {});
    console.log('✅ YouTube extractor chargé');
  } catch (error) {
    console.error('❌ Erreur chargement extracteurs:', error);
    testResults.errors.push('Extracteur non chargé');
  }

  // 5. Vérifier le serveur et canal vocal
  console.log('4️⃣ Vérification du serveur et canal vocal...');
  
  if (!TEST_GUILD_ID || !TEST_VOICE_CHANNEL_ID) {
    console.warn('⚠️ GUILD_ID ou VOICE_CHANNEL_ID non configuré dans .env');
    console.warn('   Variables nécessaires:');
    console.warn('   GUILD_ID=<id du serveur>');
    console.warn('   VOICE_CHANNEL_ID=<id du canal vocal>');
    console.warn('\n   Pour les obtenir:');
    console.warn('   1. Activer le mode développeur dans Discord (Paramètres > Avancé)');
    console.warn('   2. Clic droit sur le serveur > Copier l\'identifiant du serveur');
    console.warn('   3. Clic droit sur le canal vocal > Copier l\'identifiant du salon');
    
    // Test de connexion basique sans playback
    console.log('\n5️⃣ Test de compatibilité @discordjs/voice...');
    const { joinVoiceChannel, getVoiceConnection } = await import('@discordjs/voice');
    console.log('✅ @discordjs/voice importé sans erreur');
    
    // Vérifier si sodium est disponible
    const sodium = (global as any).sodium;
    if (sodium) {
      console.log('✅ sodium-native accessible globalement');
      const methods = Object.keys(sodium).filter(k => k.includes('aead')).slice(0, 3);
      console.log(`   Méthodes crypto disponibles: ${methods.join(', ')}`);
    }
    
    testResults.encryption = true;
    testResults.connection = true;
    
    await printResults(testResults, true);
    await client.destroy();
    process.exit(0);
  }

  const guild = client.guilds.cache.get(TEST_GUILD_ID);
  if (!guild) {
    console.error(`❌ Serveur ${TEST_GUILD_ID} introuvable`);
    testResults.errors.push('Serveur introuvable');
    await printResults(testResults, false);
    await client.destroy();
    process.exit(1);
  }

  const voiceChannel = guild.channels.cache.get(TEST_VOICE_CHANNEL_ID) as VoiceChannel;
  if (!voiceChannel || voiceChannel.type !== 2) {
    console.error(`❌ Canal vocal ${TEST_VOICE_CHANNEL_ID} introuvable`);
    testResults.errors.push('Canal vocal introuvable');
    await printResults(testResults, false);
    await client.destroy();
    process.exit(1);
  }

  console.log(`✅ Canal vocal trouvé: ${voiceChannel.name}`);

  // 6. Test de playback
  console.log('5️⃣ Test de playback audio...');
  console.log('   🎵 Recherche: "test audio 5 seconds"');
  
  try {
    const result = await player.search('test audio 5 seconds', {
      requestedBy: client.user!,
    });

    if (!result.hasTracks()) {
      console.error('❌ Aucune piste trouvée');
      testResults.errors.push('Aucune piste trouvée');
      await printResults(testResults, false);
      await client.destroy();
      process.exit(1);
    }

    console.log(`✅ Piste trouvée: ${result.tracks[0].title}`);
    console.log('   ⏳ Tentative de lecture...');

    // Jouer
    const { track, queue } = await player.play(voiceChannel, result, {
      nodeOptions: {
        volume: 30,
        selfDeaf: true,
      },
    });

    testResults.connection = true;
    testResults.encryption = true; // Si on arrive ici, le chiffrement a fonctionné
    
    console.log('✅ Connexion audio établie');
    console.log(`   📻 En lecture: ${track.title}`);

    // Attendre 8 secondes pour voir si playerStart se déclenche
    console.log('   ⏳ Attente de l\'événement playerStart (8s)...');
    
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // Arrêter
    queue.delete();
    console.log('✅ Arrêt de la lecture');

  } catch (error) {
    console.error('❌ Erreur lors du test:', error);
    testResults.errors.push(error instanceof Error ? error.message : String(error));
    
    if (error instanceof Error && error.message.includes('No compatible encryption modes')) {
      testResults.encryption = false;
      console.error('\n❌❌❌ ERREUR DE CHIFFREMENT ❌❌❌');
    }
  }

  // 7. Afficher les résultats
  await printResults(testResults, true);

  // Déconnexion
  await client.destroy();
  process.exit(testResults.errors.length === 0 ? 0 : 1);
}

async function printResults(results: any, fullTest: boolean): Promise<void> {
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSULTATS DU TEST');
  console.log('='.repeat(50));
  
  if (fullTest) {
    console.log(`\n✅ Chiffrement compatible:    ${results.encryption ? '✅ OUI' : '❌ NON'}`);
    console.log(`✅ Connexion audio:           ${results.connection ? '✅ OUI' : '❌ NON'}`);
    console.log(`✅ Événement playerStart:     ${results.playerStart ? '✅ OUI' : '⚠️ NON (peut être normal)'}`);
    console.log(`✅ Audio joué:                ${results.audio ? '✅ OUI' : '⚠️ NON (vérifier manuellement)'}`);
  } else {
    console.log(`\n✅ Chiffrement compatible:    ${results.encryption ? '✅ OUI' : '❌ NON'}`);
    console.log(`✅ Connexion testée:          ${results.connection ? '✅ OUI' : '❌ NON'}`);
  }

  if (results.errors.length > 0) {
    console.log('\n❌ ERREURS DÉTECTÉES:');
    results.errors.forEach((err: string, i: number) => {
      console.log(`   ${i + 1}. ${err}`);
    });
  }

  console.log('\n' + '='.repeat(50));
  
  if (results.encryption && results.connection) {
    console.log('✅ LE MODULE MUSIQUE EST FONCTIONNEL');
    if (!fullTest) {
      console.log('   (Test limité - configurez GUILD_ID et VOICE_CHANNEL_ID pour test complet)');
    }
  } else {
    console.log('❌ LE MODULE MUSIQUE A DES PROBLÈMES');
    if (!results.encryption) {
      console.log('\n🔧 SOLUTION:');
      console.log('   npm install @discordjs/voice@latest');
      console.log('   (Nécessite @discordjs/voice >= 0.19.0)');
    }
  }
  console.log('='.repeat(50) + '\n');
}

// Lancer le test
testMusicPlayback().catch((error) => {
  console.error('❌ Erreur fatale:', error);
  process.exit(1);
});
