import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Stats
 */
export class StatsModule implements Module {
  config: ModuleConfig = {
    name: 'stats',
    description: 'Statistiques du serveur et des membres',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Stats chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Stats déchargé');
  }
}

export default new StatsModule();


