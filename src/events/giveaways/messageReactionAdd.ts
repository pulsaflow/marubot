import { MessageReaction, User, Events } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * Gère l'ajout de réactions aux giveaways
 */
export async function handleGiveawayReaction(
  reaction: MessageReaction,
  user: User
): Promise<void> {
  if (user.bot) return;

  try {
    const giveaway = await prisma.giveaway.findUnique({
      where: { messageId: reaction.message.id },
    });

    if (!giveaway || giveaway.ended) return;

    // Ajouter le participant s'il n'est pas déjà dans la liste
    if (!giveaway.participants.includes(user.id)) {
      await prisma.giveaway.update({
        where: { id: giveaway.id },
        data: {
          participants: {
            push: user.id,
          },
        },
      });
    }
  } catch (error) {
    logger.error('Erreur lors de la gestion de la réaction giveaway:', error);
  }
}








