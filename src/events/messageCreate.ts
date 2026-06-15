import { Message, Events } from 'discord.js';
import type { Bot } from '@/core/Bot';
import { handleMessageXP } from '@/events/levels/messageCreate';

/**
 * Événement déclenché lorsqu'un message est créé
 */
export default {
  name: Events.MessageCreate,
  async execute(message: Message, bot: Bot): Promise<void> {
    // Gérer l'attribution d'XP pour le système de niveaux
    await handleMessageXP(message);
  },
};








