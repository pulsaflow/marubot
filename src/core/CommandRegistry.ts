import { Collection, ChatInputCommandInteraction } from 'discord.js';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../services/LoggerService';
import type { Command } from '../types';

/**
 * Registre des commandes du bot
 */
export class CommandRegistry {
  private commands: Collection<string, Command> = new Collection();
  private cooldowns: Collection<string, Collection<string, number>> = new Collection();

  /**
   * Charge toutes les commandes depuis le dossier commands/
   */
  async loadCommands(): Promise<void> {
    const commandsPath = join(process.cwd(), 'src', 'commands');

    if (!existsSync(commandsPath)) {
      logger.warn('Dossier commands/ introuvable, aucune commande ne sera chargée');
      return;
    }

    try {
      const commandFiles = this.getAllCommandFiles(commandsPath);

      if (commandFiles.length === 0) {
        logger.info('Aucune commande trouvée');
        return;
      }

      logger.info(`Chargement de ${commandFiles.length} commande(s)...`);

      for (const file of commandFiles) {
        try {
          const commandPath = join(commandsPath, file);
          const commandModule = await import(`file://${commandPath}`);
          const command: Command =
            commandModule.default || commandModule[Object.keys(commandModule)[0]];

          if (!command?.data || !command?.execute) {
            logger.warn(`Commande invalide dans ${file}, ignorée`);
            continue;
          }

          const commandName =
            typeof command.data.name === 'string' ? command.data.name : command.data.toJSON().name;

          this.commands.set(commandName, command);
          logger.debug(`Commande chargée: ${commandName}`);
        } catch (error) {
          logger.error(`Erreur lors du chargement de la commande ${file}:`, error);
        }
      }

      logger.info(`Toutes les commandes ont été chargées (${this.commands.size} au total)`);
    } catch (error) {
      logger.error('Erreur lors du chargement des commandes:', error);
    }
  }

  /**
   * Récupère tous les fichiers de commandes récursivement
   */
  private getAllCommandFiles(dir: string, fileList: string[] = []): string[] {
    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = join(dir, file.name);
      if (file.isDirectory()) {
        this.getAllCommandFiles(filePath, fileList);
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
        fileList.push(filePath.replace(join(process.cwd(), 'src', 'commands'), '').slice(1));
      }
    }

    return fileList;
  }

  /**
   * Récupère une commande par son nom
   */
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Récupère toutes les commandes
   */
  getAll(): Collection<string, Command> {
    return this.commands;
  }

  /**
   * Vérifie si une commande est en cooldown pour un utilisateur
   */
  isOnCooldown(userId: string, commandName: string): boolean {
    const command = this.get(commandName);
    if (!command?.cooldown) return false;

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const now = Date.now();
    const timestamps = this.cooldowns.get(commandName)!;
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(userId)) {
      const expirationTime = timestamps.get(userId)! + cooldownAmount;

      if (now < expirationTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Obtient le temps restant avant la fin du cooldown (en secondes)
   */
  getCooldownRemaining(userId: string, commandName: string): number {
    const command = this.get(commandName);
    if (!command?.cooldown) return 0;

    const timestamps = this.cooldowns.get(commandName);
    if (!timestamps?.has(userId)) return 0;

    const now = Date.now();
    const expirationTime = timestamps.get(userId)! + command.cooldown * 1000;
    return Math.ceil((expirationTime - now) / 1000);
  }

  /**
   * Définit un cooldown pour un utilisateur et une commande
   */
  setCooldown(userId: string, commandName: string): void {
    const command = this.get(commandName);
    if (!command?.cooldown) return;

    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const timestamps = this.cooldowns.get(commandName)!;
    timestamps.set(userId, Date.now());

    // Nettoyer après expiration
    setTimeout(() => {
      timestamps.delete(userId);
    }, command.cooldown * 1000);
  }

  /**
   * Vérifie les permissions d'une commande
   */
  async checkPermissions(
    interaction: ChatInputCommandInteraction,
    command: Command
  ): Promise<boolean> {
    if (!command.permissions || command.permissions.length === 0) {
      return true;
    }

    if (!interaction.member || typeof interaction.member.permissions === 'string') {
      return false;
    }

    const memberPermissions = interaction.member.permissions;
    return command.permissions.every((permission) => memberPermissions.has(permission));
  }

  /**
   * Réinitialise tous les cooldowns
   */
  clearCooldowns(): void {
    this.cooldowns.clear();
  }
}
