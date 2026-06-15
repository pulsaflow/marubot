import { Client, GatewayIntentBits, Partials, REST, Routes } from "discord.js";
import { config } from "../services/ConfigService";
import { logger } from "../services/LoggerService";
import { cache } from "../services/CacheService";
import { GiveawayService } from "../services/GiveawayService";
import { MusicManager } from "../music"; // doit pointer vers le NOUVEAU module (export MusicManager)
import { EventHandler } from "./EventHandler";
import { CommandRegistry } from "./CommandRegistry";
import type { Command } from "../types";

// Map globale pour stocker l'instance du bot par client
const botInstances = new WeakMap<Client, Bot>();

export function getBotFromClient(client: Client): Bot | undefined {
  return botInstances.get(client) || (client as any).bot;
}

export class Bot {
  public readonly client: Client;
  public readonly commands: CommandRegistry;
  public readonly events: EventHandler;

  public giveawayService!: GiveawayService;
  public musicManager!: MusicManager;

  private readonly rest: REST;
  private musicAutoDisconnectInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates, // requis pour la musique
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
        parse: ["users", "roles"],
        repliedUser: false,
      },
    });

    // Init REST
    this.rest = new REST().setToken(config.discordToken);

    // Handlers
    this.commands = new CommandRegistry();
    this.events = new EventHandler(this.client, this);

    // Bot instance mapping (évite références circulaires sérialisables)
    botInstances.set(this.client, this);

    // Compat: client.bot non enumerable (OK à garder)
    Object.defineProperty(this.client, "bot", {
      value: this,
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }

  async start(): Promise<void> {
    try {
      // ✅ init crypto propre (pas de setTimeout random)
      const { initializeCrypto } = await import("../init");
      await initializeCrypto();

      logger.info("Démarrage de MaruBot...");

      // Cache
      const cacheEnabled = await cache.isEnabled();
      if (!cacheEnabled) {
        logger.warn("Cache non disponible, utilisation du cache mémoire uniquement");
      }

      // Giveaways (désactivé temporairement - Prisma DB down)
      // logger.info("🔄 Initialisation du service giveaways...");
      // this.giveawayService = new GiveawayService(this.client);
      // logger.info("✅ Service giveaways initialisé");

      // ✅ Musique (NOUVEAU module, from scratch)
      logger.info("🔄 Initialisation du gestionnaire de musique...");
      this.musicManager = new MusicManager();
      logger.info("✅ Gestionnaire de musique initialisé");

      // Auto-disconnect (évite que le bot reste en vocal)
      this.musicAutoDisconnectInterval = setInterval(() => {
        try {
          this.musicManager.tickAutoDisconnect(this.client);
        } catch (e) {
          logger.warn("Music auto-disconnect tick error:", e);
        }
      }, 20_000);

      // Commands
      await this.commands.loadCommands();
      logger.info(`Chargement de ${this.commands.getAll().size} commande(s)...`);
      logger.info("✅ Commandes chargées");

      // Events
      await this.events.loadEvents();

      // Login
      logger.info("Connexion au Discord en cours...");
      await this.client.login(config.discordToken);
    } catch (error) {
      logger.error("Erreur lors du démarrage du bot:", error);
      process.exit(1);
    }
  }

  async deployCommands(guildId?: string): Promise<void> {
    try {
      logger.info("Déploiement des commandes slash...");

      const commands = this.commands.getAll().map((command: Command) => {
        const data = typeof command.data.toJSON === "function" ? command.data.toJSON() : command.data;
        return data;
      });

      if (guildId) {
        await this.rest.put(
          Routes.applicationGuildCommands(config.discordClientId, guildId),
          { body: commands }
        );
        logger.info(`${commands.length} commande(s) déployée(s) sur le serveur ${guildId}`);
      } else {
        await this.rest.put(Routes.applicationCommands(config.discordClientId), { body: commands });
        logger.info(`${commands.length} commande(s) déployée(s) globalement`);
      }
    } catch (error) {
      logger.error("Erreur lors du déploiement des commandes:", error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info("Arrêt de MaruBot...");

    // Stop giveaways
    if (this.giveawayService) {
      this.giveawayService.stop();
    }

    // Stop musique
    if (this.musicAutoDisconnectInterval) {
      clearInterval(this.musicAutoDisconnectInterval);
      this.musicAutoDisconnectInterval = null;
    }

    // cache
    await cache.close();

    // discord
    void this.client.destroy();

    logger.info("Bot arrêté");
  }

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
