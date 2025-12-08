import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module de modération
 */
export class ModerationModule implements Module {
  config: ModuleConfig = {
    name: 'moderation',
    description: 'Système complet de sanctions, auto-modération, logs',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Modération chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Modération déchargé');
  }
}

export default new ModerationModule();


