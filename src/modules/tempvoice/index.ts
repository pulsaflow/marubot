import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Temp Voice
 */
export class TempVoiceModule implements Module {
  config: ModuleConfig = {
    name: 'tempvoice',
    description: 'Salons vocaux temporaires',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Temp Voice chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Temp Voice déchargé');
  }
}

export default new TempVoiceModule();


