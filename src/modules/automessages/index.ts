import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Auto Messages
 */
export class AutoMessagesModule implements Module {
  config: ModuleConfig = {
    name: 'automessages',
    description: 'Messages automatiques périodiques',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Auto Messages chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Auto Messages déchargé');
  }
}

export default new AutoMessagesModule();


