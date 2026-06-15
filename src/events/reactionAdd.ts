import { MessageReaction, User, Events } from 'discord.js';
import type { Bot } from '@/core/Bot';
import { handleGiveawayReaction } from '@/events/giveaways/messageReactionAdd';
import { handleReactionRole } from '@/events/reactionroles/messageReactionAdd';

/**
 * Événement déclenché lorsqu'une réaction est ajoutée
 */
export default {
  name: Events.MessageReactionAdd,
  async execute(reaction: MessageReaction, user: User, bot: Bot): Promise<void> {
    // Récupérer le membre si possible
    const member = reaction.message.guild?.members.cache.get(user.id) || null;

    // Gérer les giveaways
    await handleGiveawayReaction(reaction, user);

    // Gérer les reaction roles
    await handleReactionRole(reaction, user, member);
  },
};








