import { Client, Events } from 'discord.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../services/LoggerService';
import type { Bot } from './Bot';

/**
 * Gestionnaire d'événements Discord
 */
export class EventHandler {
  private client: Client;
  private bot: Bot;

  constructor(client: Client, bot: Bot) {
    this.client = client;
    this.bot = bot;
  }

  /**
   * Charge tous les événements depuis le dossier events/
   */
  async loadEvents(): Promise<void> {
    const eventsPath = join(process.cwd(), 'src', 'events');

    if (!existsSync(eventsPath)) {
      logger.warn('Dossier events/ introuvable, aucun événement personnalisé ne sera chargé');
      return;
    }

    const eventFiles = readdirSync(eventsPath).filter(
      (file) => file.endsWith('.ts') || file.endsWith('.js')
    );

    if (eventFiles.length === 0) {
      logger.info('Aucun événement personnalisé trouvé');
      return;
    }

    logger.info(`Chargement de ${eventFiles.length} événement(s)...`);

    for (const file of eventFiles) {
      try {
        const eventPath = join(eventsPath, file);
        const eventModule = await import(`file://${eventPath}`);
        const event = eventModule.default || eventModule[Object.keys(eventModule)[0]];

        if (!event?.name || !event?.execute) {
          logger.warn(`Événement invalide dans ${file}, ignoré`);
          continue;
        }

        if (event.once) {
          this.client.once(event.name as Events, async (...args) => {
            try {
              await event.execute(...args, this.bot);
            } catch (error) {
              logger.error(`Erreur dans l'événement ${event.name}:`, error);
            }
          });
        } else {
          this.client.on(event.name as Events, async (...args) => {
            try {
              await event.execute(...args, this.bot);
            } catch (error) {
              logger.error(`Erreur dans l'événement ${event.name}:`, error);
            }
          });
        }

        logger.debug(`Événement chargé: ${event.name}`);
      } catch (error) {
        logger.error(`Erreur lors du chargement de l'événement ${file}:`, error);
      }
    }

    logger.info('Tous les événements ont été chargés');
  }

  /**
   * Enregistre les événements de base
   */
  registerBaseEvents(): void {
    // Événement ready
    this.client.once(Events.ClientReady, (client) => {
      logger.info(`Bot connecté en tant que ${client.user.tag}`);
      logger.info(`Actif sur ${client.guilds.cache.size} serveur(s)`);
      logger.info(`En train d'écouter ${client.users.cache.size} utilisateur(s)`);
    });

    // Événement d'erreur
    this.client.on(Events.Error, (error) => {
      logger.error('Erreur Discord.js:', error);
    });

    // Événement warn
    this.client.on(Events.Warn, (warning) => {
      logger.warn(`Avertissement Discord.js: ${warning}`);
    });

    // Événement de debug (seulement en mode debug)
    if (process.env.LOG_LEVEL === 'debug') {
      this.client.on(Events.Debug, (info) => {
        logger.debug(`Debug Discord.js: ${info}`);
      });
    }

    // Événement de déconnexion
    this.client.on(Events.ShardDisconnect, (event, shardId) => {
      logger.warn(`Shard ${shardId} déconnecté: ${event.reason}`);
    });

    // Événement de reconnexion
    this.client.on(Events.ShardReconnecting, (shardId) => {
      logger.info(`Shard ${shardId} en cours de reconnexion...`);
    });

    // Événement de connexion shard
    this.client.on(Events.ShardReady, (shardId) => {
      logger.info(`Shard ${shardId} prêt`);
    });
  }
}
