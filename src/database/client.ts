import { PrismaClient } from '@prisma/client';
import { logger } from '../services/LoggerService';

/**
 * Instance Prisma singleton
 */
export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Logging des erreurs Prisma
prisma.$on('error' as never, (e: { message: string }) => {
  // ✅ Extraire seulement le message pour éviter les références circulaires
  logger.error('Erreur Prisma:', {
    message: e.message,
  });
});

prisma.$on('warn' as never, (e: unknown) => {
  const message =
    typeof e === 'object' && e !== null && 'message' in e
      ? String((e as { message: unknown }).message)
      : 'Avertissement inconnu';
  logger.warn('Avertissement Prisma:', { message });
});

// Gestion propre de la connexion
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
