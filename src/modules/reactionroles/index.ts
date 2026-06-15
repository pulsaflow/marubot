import type { Module, ModuleConfig } from '@/types';
import { logger } from '@/services/LoggerService';

/**
 * Module Reaction Roles
 */
export class ReactionRolesModule implements Module {
  config: ModuleConfig = {
    name: 'reactionroles',
    description: 'Attribution de rôles par réaction',
    enabled: true,
  };

  async onLoad(): Promise<void> {
    logger.info('Module Reaction Roles chargé');
  }

  async onUnload(): Promise<void> {
    logger.info('Module Reaction Roles déchargé');
  }
}

export default new ReactionRolesModule();








