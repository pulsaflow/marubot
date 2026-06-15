import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module de niveaux et XP
 */
export class LevelsModule implements Module {
  config: ModuleConfig = {
    name: 'levels',
    description: 'Système XP avec classements et récompenses',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Niveaux chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Niveaux déchargé');
  }
}

export default new LevelsModule();








