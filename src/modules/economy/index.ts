import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module d'économie
 */
export class EconomyModule implements Module {
  config: ModuleConfig = {
    name: 'economy',
    description: 'Monnaie virtuelle, boutique, inventaire, jeux d\'argent',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Économie chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Économie déchargé');
  }
}

export default new EconomyModule();


