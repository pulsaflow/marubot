import { MessageReaction, User, GuildMember } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';

/**
 * Gère le retrait de rôles par réaction
 */
export async function handleReactionRoleRemove(
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

    if (!role) return;

    // Retirer le rôle
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role, 'Reaction role retiré');
    }
  } catch (error) {
    logger.error('Erreur lors du retrait du rôle par réaction:', error);
  }
}


