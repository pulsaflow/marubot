import { Guild } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * S'assure qu'un Guild existe dans la base de données
 */
export async function ensureGuildExists(guild: Guild): Promise<void> {
  try {
    await prisma.guild.upsert({
      where: { id: guild.id },
      update: {
        name: guild.name,
        updatedAt: new Date(),
      },
      create: {
        id: guild.id,
        name: guild.name,
        prefix: '!',
        language: 'fr',
        premium: false,
      },
    });
  } catch (error) {
    logger.error(`Erreur lors de la création/mise à jour du guild ${guild.id}:`, error);
    throw error;
  }
}






