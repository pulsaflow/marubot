import ffmpeg from 'ffmpeg-static';
process.env.FFMPEG_PATH = ffmpeg as string;
import { Client, GatewayIntentBits, Partials, REST, Routes } from 'discord.js';

// Map globale pour stocker l'instance du bot par client
// (alternative pour éviter références circulaires dans toJSON())
const botInstances = new WeakMap<Client, Bot>();

// Fonction utilitaire pour récupérer le bot depuis un client
export function getBotFromClient(client: Client): Bot | undefined {
  return botInstances.get(client) || (client as any).bot;
}
import { config } from '../services/ConfigService';
import { logger } from '../services/LoggerService';
import { cache } from '../services/CacheService';
import { MusicService } from '../services/MusicService';
import { GiveawayService } from '../services/GiveawayService';
import { EventHandler } from './EventHandler';
import { CommandRegistry } from './CommandRegistry';
import type { Command } from '../types';

/**
 * Classe principale du bot Discord
 */
export class Bot {
  public readonly client: Client;
  public readonly commands: CommandRegistry;
  public readonly events: EventHandler;
  public musicService!: MusicService; // Initialisé de manière asynchrone dans start()
  public giveawayService!: GiveawayService; // Initialisé de manière asynchrone dans start()
  private readonly rest: REST;

  constructor() {
    // Création du client Discord
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildEmojisAndStickers,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
        Partials.User,
        Partials.GuildMember,
      ],
      allowedMentions: {
        parse: ['users', 'roles'],
        repliedUser: false,
      },
    });

    // ✅ SOLUTION RADICALE : Désactiver complètement Client.toJSON() pour éviter récursion
    // Discord.js/discord-player essaie de sérialiser le Client qui contient des références circulaires
    // En retournant toujours un objet simple, on évite toute sérialisation récursive
    const originalToJSON = this.client.toJSON.bind(this.client);
    let toJSONCallCount = 0;
    
    this.client.toJSON = function(this: Client) {
      toJSONCallCount++;
      
      // Log uniquement les 3 premiers appels pour diagnostiquer
      if (toJSONCallCount <= 3) {
        logger.warn(`[FIX] Client.toJSON() appelé (${toJSONCallCount}) - retour objet simple pour éviter récursion/mémoire`);
      }
      
      // Retourner IMMÉDIATEMENT un objet simple - ne JAMAIS appeler originalToJSON()
      // car cela déclenche une sérialisation récursive qui consomme toute la mémoire
      return {
        id: this.user?.id || 'unknown',
        username: this.user?.username || 'unknown',
        _toJSONDisabled: true,
        _callCount: toJSONCallCount,
      };
    };

    // Initialisation du REST API
    this.rest = new REST().setToken(config.discordToken);

    // Initialisation des gestionnaires
    this.commands = new CommandRegistry();
    this.events = new EventHandler(this.client, this);
    // MusicService sera initialisé de manière asynchrone dans start()

    // ✅ Utiliser WeakMap pour éviter références circulaires
    botInstances.set(this.client, this);
    
    // Pour compatibilité avec le code existant, on garde aussi (client as any).bot
    // mais on le rend non-enumerable pour qu'il ne soit PAS sérialisé par toJSON()
    Object.defineProperty(this.client, 'bot', {
      value: this,
      enumerable: false, // CRITIQUE : non-enumerable = pas inclus dans toJSON()
      configurable: true,
      writable: false,
    });
  }

  /**
   * Initialise et démarre le bot
   */
  async start(): Promise<void> {
    try {
      logger.info('Démarrage de MaruBot...');

      // Connexion au cache
      const cacheEnabled = await cache.isEnabled(); // Initialise la connexion
      if (!cacheEnabled) {
        logger.warn('Cache non disponible, utilisation du cache mémoire uniquement');
      }

      // Initialisation du service musique (async avec extracteurs)
      logger.info('🔄 Initialisation du module musique...');
      this.musicService = await MusicService.create(this.client);
      logger.info('✅ Module musique initialisé avec succès');

      // Initialisation du service giveaways
      logger.info('🔄 Initialisation du service giveaways...');
      this.giveawayService = new GiveawayService(this.client);
      logger.info('✅ Service giveaways initialisé avec succès');

      // Chargement des commandes
      await this.commands.loadCommands();

      // Enregistrement des événements
      this.events.registerBaseEvents();
      await this.events.loadEvents();

      // Déploiement des commandes slash (à faire une seule fois ou via script)
      // await this.deployCommands();

      // Connexion au Discord
      await this.client.login(config.discordToken);
      logger.info('Connexion au Discord en cours...');
    } catch (error) {
      logger.error('Erreur lors du démarrage du bot:', error);
      process.exit(1);
    }
  }

  /**
   * Déploie les commandes slash sur Discord
   */
  async deployCommands(guildId?: string): Promise<void> {
    try {
      logger.info('Déploiement des commandes slash...');

      const commands = this.commands.getAll().map((command: Command) => {
        const data =
          typeof command.data.toJSON === 'function' ? command.data.toJSON() : command.data;
        return data;
      });

      if (guildId) {
        // Déploiement sur un serveur spécifique (pour tests)
        await this.rest.put(Routes.applicationGuildCommands(config.discordClientId, guildId), {
          body: commands,
        });
        logger.info(`${commands.length} commande(s) déployée(s) sur le serveur ${guildId}`);
      } else {
        // Déploiement global
        await this.rest.put(Routes.applicationCommands(config.discordClientId), {
          body: commands,
        });
        logger.info(`${commands.length} commande(s) déployée(s) globalement`);
      }
    } catch (error) {
      logger.error('Erreur lors du déploiement des commandes:', error);
      throw error;
    }
  }

  /**
   * Arrête le bot proprement
   */
  async stop(): Promise<void> {
    logger.info('Arrêt de MaruBot...');

    // Arrêt du service giveaways
    if (this.giveawayService) {
      this.giveawayService.stop();
    }

    // Fermeture du cache
    await cache.close();

    // Déconnexion du client
    void this.client.destroy();

    logger.info('Bot arrêté');
  }

  /**
   * Récupère les statistiques du bot
   */
  getStats() {
    return {
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      channels: this.client.channels.cache.size,
      uptime: this.client.uptime,
      memory: process.memoryUsage(),
      commands: this.commands.getAll().size,
    };
  }
}
