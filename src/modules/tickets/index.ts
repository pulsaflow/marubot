import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module de tickets
 */
export class TicketsModule implements Module {
  config: ModuleConfig = {
    name: 'tickets',
    description: 'Système de tickets avec catégories et transcriptions',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Tickets chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Tickets déchargé');
  }
}

export default new TicketsModule();








