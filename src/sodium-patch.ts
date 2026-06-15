/**
 * Patch pour forcer @discordjs/voice à détecter sodium-native
 * @discordjs/voice utilise import() dynamique, donc on doit patcher import.meta.resolve
 */

import { createRequire } from 'module';
import { register } from 'module';

const require = createRequire(import.meta.url);

// 1. Charger sodium-native
const sodium = require('sodium-native');
console.log('✅ Patch: sodium-native chargé');

// 2. Patcher import() pour intercepter 'sodium-native'
const originalImport = (global as any).import || ((global as any).__importDefault);

// Créer un hook de chargement personnalisé
const sodiumModule = {
  default: sodium,
  ...sodium
};

// Exposer via globalThis pour que import() dynamique le trouve
(globalThis as any)['sodium-native'] = sodiumModule;
(globalThis as any)['sodium'] = sodiumModule;
(global as any)['sodium-native'] = sodiumModule;
(global as any)['sodium'] = sodiumModule;

// Aussi dans require.cache
const resolvedPath = require.resolve('sodium-native');
require.cache[resolvedPath] = {
  id: resolvedPath,
  filename: resolvedPath,
  loaded: true,
  exports: sodium,
  children: [],
  paths: [],
} as any;

console.log('✅ Patch: sodium-native exposé pour import() dynamique');

export {};
