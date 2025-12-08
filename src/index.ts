import { Bot } from './core/Bot';
import { logger } from './services/LoggerService';

/**
 * Point d'entrée principal du bot
 */
async function main(): Promise<void> {
  // Supprimer les logs console de YouTube.js (warnings du parser, non critiques)
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  console.error = (...args: unknown[]) => {
    const message = args.join(' ');
    // Ignorer les logs YouTube.js
    if (
      message.includes('[YOUTUBEJS]') ||
      message.includes('InnertubeError') ||
      message.includes('ListView not found') ||
      message.includes('ListItemView not found') ||
      message.includes('GridShelfView not found') ||
      message.includes('SectionHeaderView not found') ||
      message.includes('ParsingError') ||
      message.includes('Unable to find matching run')
    ) {
      return; // Ignorer silencieusement
    }
    originalConsoleError(...args);
  };
  
  console.warn = (...args: unknown[]) => {
    const message = args.join(' ');
    // Ignorer les warnings YouTube.js
    if (
      message.includes('[YOUTUBEJS]') ||
      message.includes('InnertubeError') ||
      message.includes('uses scraping-based')
    ) {
      return; // Ignorer silencieusement
    }
    originalConsoleWarn(...args);
  };

  const bot = new Bot();

  // Gestion propre de l'arrêt
  process.once('SIGINT', async () => {
    logger.info('Signal SIGINT reçu, arrêt du bot...');
    await bot.stop();
    process.exit(0);
  });

  process.once('SIGTERM', async () => {
    logger.info('Signal SIGTERM reçu, arrêt du bot...');
    await bot.stop();
    process.exit(0);
  });

  // Gestion des erreurs non capturées
  process.on('unhandledRejection', (reason, promise) => {
    // Filtrer les erreurs communes qui ne sont pas critiques
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorString = String(reason);
    
    // Améliorer le logging des erreurs vides ou mal sérialisées
    let errorDetails: unknown = reason;
    if (reason instanceof Error) {
      errorDetails = {
        message: reason.message,
        stack: reason.stack,
        name: reason.name,
      };
    } else if (typeof reason === 'object' && reason !== null) {
      try {
        errorDetails = JSON.stringify(reason, null, 2);
      } catch {
        errorDetails = String(reason);
      }
    }

    // Ignorer certaines erreurs communes de discord-player et YouTube.js
    if (
      errorMessage.includes('Unknown interaction') ||
      errorMessage.includes('already been acknowledged') ||
      errorMessage.includes('Could not extract stream') ||
      errorString.includes('[YOUTUBEJS]') || // Toutes les erreurs YouTube.js (warnings du parser)
      errorString.includes('InnertubeError') ||
      errorString.includes('ListView not found') ||
      errorString.includes('ListItemView not found') ||
      errorString.includes('GridShelfView not found') ||
      errorString.includes('SectionHeaderView not found') ||
      errorString.includes('ParsingError') ||
      errorMessage.includes('Maximum call stack size exceeded') // On log cette erreur mais on ne crash pas
    ) {
      // Pour Maximum call stack, logger mais ne pas crasher (essayer de continuer)
      if (errorMessage.includes('Maximum call stack size exceeded')) {
        logger.error('⚠️ Maximum call stack size exceeded détecté - possible récursion infinie:', {
          error: errorMessage.substring(0, 200),
        });
        // Ne pas return, continuer pour logger
      } else {
        return; // Ignorer silencieusement les autres
      }
    }

    // Logger avec plus de détails
    logger.error('Rejection non gérée:', {
      reason: errorDetails,
      reasonType: typeof reason,
      reasonConstructor: reason instanceof Error ? reason.constructor.name : 'N/A',
      promise: promise ? 'Promise object' : 'No promise',
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Exception non capturée:', error);
    process.exit(1);
  });

  // Démarrage du bot
  await bot.start();
}

// Lancement
main().catch((error) => {
  logger.error('Erreur fatale:', error);
  process.exit(1);
});
