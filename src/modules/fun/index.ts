import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Fun & Jeux
 */
export class FunModule implements Module {
  config: ModuleConfig = {
    name: 'fun',
    description: 'Mini-jeux, commandes fun, blagues',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Fun chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Fun déchargé');
  }
}

export default new FunModule();


