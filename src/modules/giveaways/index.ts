import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Giveaways
 */
export class GiveawaysModule implements Module {
  config: ModuleConfig = {
    name: 'giveaways',
    description: 'Système de concours avec conditions',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Giveaways chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Giveaways déchargé');
  }
}

export default new GiveawaysModule();


