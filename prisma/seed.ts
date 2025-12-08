import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script de seed pour la base de données
 */
async function main(): Promise<void> {
  console.log('🌱 Seed de la base de données...');

  // Ajoutez ici vos données de seed

  console.log('✅ Seed terminé');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors du seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



