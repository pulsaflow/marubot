import { MessageReaction, User, GuildMember } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * Gère l'attribution de rôles par réaction
 */
export async function handleReactionRole(
  reaction: MessageReaction,
  user: User,
  member: GuildMember | null
): Promise<void> {
  if (user.bot || !member || !reaction.message.guild) return;

  try {
    const reactionRole = await prisma.reactionRole.findUnique({
      where: {
        messageId_emoji: {
          messageId: reaction.message.id,
          emoji: reaction.emoji.id || reaction.emoji.name || '',
        },
      },
    });

    if (!reactionRole) return;

    // Vérifier si le rôle existe
    const role = reactionRole.guildId === reaction.message.guild.id
      ? reaction.message.guild.roles.cache.get(reactionRole.roleId)
      : null;

    if (!role) {
      logger.warn(`Rôle ${reactionRole.roleId} introuvable pour le reaction role ${reactionRole.id}`);
      return;
    }

    // Si unique, retirer les autres rôles de réaction de ce message
    if (reactionRole.unique) {
      const otherReactionRoles = await prisma.reactionRole.findMany({
        where: {
          guildId: reaction.message.guild.id,
          messageId: reaction.message.id,
          NOT: { id: reactionRole.id },
        },
      });

      for (const otherRole of otherReactionRoles) {
        const otherDiscordRole = reaction.message.guild.roles.cache.get(otherRole.roleId);
        if (otherDiscordRole && member.roles.cache.has(otherDiscordRole.id)) {
          await member.roles.remove(otherDiscordRole, 'Reaction role unique');
        }
      }
    }

    // Ajouter le rôle
    if (!member.roles.cache.has(role.id)) {
      await member.roles.add(role, 'Reaction role');
    }
  } catch (error) {
    logger.error('Erreur lors de l\'attribution du rôle par réaction:', error);
  }
}








