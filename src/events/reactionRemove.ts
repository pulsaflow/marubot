import { MessageReaction, User, Events } from 'discord.js';
import type { Bot } from '@/core/Bot';
import { handleReactionRoleRemove } from '@/events/reactionroles/messageReactionRemove';

/**
 * Événement déclenché lorsqu'une réaction est retirée
 */
export default {
  name: Events.MessageReactionRemove,
  async execute(reaction: MessageReaction, user: User, bot: Bot): Promise<void> {
    // Récupérer le membre si possible
    const member = reaction.message.guild?.members.cache.get(user.id) || null;

    // Gérer les reaction roles
    await handleReactionRoleRemove(reaction, user, member);
  },
};








