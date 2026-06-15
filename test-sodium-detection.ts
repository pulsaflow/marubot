/**
 * Test de détection de sodium par @discordjs/voice
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Charger sodium-native
const sodium = require('sodium-native');
console.log('✅ sodium-native chargé directement');

// Importer @discordjs/voice
const { generateDependencyReport } = await import('@discordjs/voice');

console.log('\n📊 Rapport des dépendances @discordjs/voice:');
console.log(generateDependencyReport());
