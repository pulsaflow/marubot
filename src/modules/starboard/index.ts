import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Starboard
 */
export class StarboardModule implements Module {
  config: ModuleConfig = {
    name: 'starboard',
    description: 'Tableau d\'honneur pour les messages populaires',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Starboard chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Starboard déchargé');
  }
}

export default new StarboardModule();


