/**
 * Initialise le chiffrement pour @discordjs/voice
 * CRITIQUE: Doit être appelé AVANT toute utilisation de @discordjs/voice
 */
export async function initializeCrypto(): Promise<void> {
  try {
    // Importer tweetnacl - CRITIQUE pour le chiffrement Discord Voice
    // En ES modules, tweetnacl peut être exporté comme default ou namespace
    const naclModule = await import('tweetnacl');
    const nacl = (naclModule as any).default || naclModule;
    
    // Vérifier que les fonctions nécessaires pour @discordjs/voice sont disponibles
    // @discordjs/voice utilise secretbox.open et secretbox pour le chiffrement
    if (nacl && nacl.secretbox && nacl.secretbox.open && nacl.randomBytes) {
      console.log('✅ tweetnacl chargé - chiffrement audio disponible');
      return;
    }
    
    throw new Error('tweetnacl importé mais secretbox ou randomBytes non disponibles');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ ERREUR CRITIQUE: tweetnacl non disponible - le module audio ne fonctionnera PAS');
    console.error(`   Détails: ${errorMsg}`);
    console.error('   Solution: npm install tweetnacl');
    throw new Error(`Impossible d'initialiser le chiffrement audio: ${errorMsg}`);
  }
}
