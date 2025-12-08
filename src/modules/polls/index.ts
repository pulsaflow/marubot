import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Polls
 */
export class PollsModule implements Module {
  config: ModuleConfig = {
    name: 'polls',
    description: 'Système de sondages',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Polls chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Polls déchargé');
  }
}

export default new PollsModule();


