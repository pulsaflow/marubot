import { REST, Routes } from 'discord.js';
import { config } from '../src/services/ConfigService';
import { logger } from '../src/services/LoggerService';
import { readdirSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

/**
 * Script pour déployer les commandes slash sur Discord
 */
async function deployCommands(): Promise<void> {
  const commands: unknown[] = [];
  const commandsPath = join(process.cwd(), 'src', 'commands');

  // Chargement des commandes
  const loadCommands = async (dir: string): Promise<void> => {
    const files = readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = join(dir, file.name);
      if (file.isDirectory()) {
        await loadCommands(filePath);
      } else if (file.name.endsWith('.ts') || file.name.endsWith('.js')) {
        try {
          // Convertir le chemin en URL pour l'import ESM
          const fileUrl = pathToFileURL(filePath).href;
          const commandModule = await import(fileUrl);
          const cmd = commandModule.default || commandModule[Object.keys(commandModule)[0]];
          if (cmd?.data) {
            const data = typeof cmd.data.toJSON === 'function' 
              ? cmd.data.toJSON() 
              : cmd.data;
            commands.push(data);
          }
        } catch (error) {
          logger.warn(`Erreur lors du chargement de ${filePath}:`, error);
        }
      }
    }
  };

  await loadCommands(commandsPath);

  logger.info(`Chargement de ${commands.length} commande(s)...`);

  // Déploiement
  const rest = new REST().setToken(config.discordToken);

  try {
    logger.info('Déploiement des commandes...');

    const args = process.argv.slice(2);
    const guildId = args.find(arg => arg.startsWith('--guild='))?.split('=')[1];

    if (guildId) {
      // Déploiement sur un serveur spécifique
      await rest.put(
        Routes.applicationGuildCommands(config.discordClientId, guildId),
        { body: commands }
      );
      logger.info(`${commands.length} commande(s) déployée(s) sur le serveur ${guildId}`);
    } else {
      // Déploiement global
      await rest.put(
        Routes.applicationCommands(config.discordClientId),
        { body: commands }
      );
      logger.info(`${commands.length} commande(s) déployée(s) globalement`);
    }
  } catch (error) {
    logger.error('Erreur lors du déploiement:', error);
    process.exit(1);
  }
}

deployCommands();

