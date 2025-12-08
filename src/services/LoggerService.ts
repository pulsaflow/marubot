import winston from 'winston';
import path from 'path';

/**
 * Service de logging centralisé avec Winston
 */
export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    );

    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
          // ✅ Simplification maximale : Nettoyer AVANT la sérialisation, puis utiliser JSON.stringify normalement
          // JSON.stringify gère naturellement les références circulaires et lancera une erreur que nous capturons
          try {
            // Nettoyer l'objet meta avant sérialisation
            const cleanMeta: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(meta)) {
              if (value === null || value === undefined) {
                cleanMeta[key] = value;
              } else if (typeof value === 'object') {
                // Détecter les objets Player/Queue/discord-player
                const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
                
                if (
                  constructorName === 'Player' ||
                  constructorName === 'Queue' ||
                  constructorName === 'GuildNodeManager'
                ) {
                  cleanMeta[key] = `[${constructorName}]`;
                } else if (value instanceof Error) {
                  // Extraire seulement message et stack pour les erreurs
                  cleanMeta[key] = {
                    name: value.name,
                    message: value.message,
                    stack: value.stack?.split('\n').slice(0, 3).join('\n'),
                  };
                } else {
                  // Pour les autres objets, essayer de les sérialiser normalement
                  cleanMeta[key] = value;
                }
              } else {
                cleanMeta[key] = value;
              }
            }
            
            // Utiliser JSON.stringify avec un replacer simple (SANS WeakSet)
            // qui remplace seulement les objets Player/Queue qui auraient pu échapper
            const jsonStr = JSON.stringify(cleanMeta, (key, value) => {
              if (value && typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
                if (
                  constructorName === 'Player' ||
                  constructorName === 'Queue' ||
                  constructorName === 'GuildNodeManager'
                ) {
                  return `[${constructorName}]`;
                }
              }
              return value;
            }, 2);
            
            msg += ` ${jsonStr}`;
          } catch (err) {
            // Si la sérialisation échoue (référence circulaire), utiliser une approche simple
            const simpleMeta: Record<string, string> = {};
            for (const [key, value] of Object.entries(meta)) {
              if (value === null || value === undefined) {
                simpleMeta[key] = String(value);
              } else if (typeof value === 'object') {
                const constructorName = (value as { constructor?: { name?: string } }).constructor?.name;
                if (constructorName) {
                  simpleMeta[key] = `[${constructorName}]`;
                } else {
                  simpleMeta[key] = '[Object]';
                }
              } else {
                simpleMeta[key] = String(value);
              }
            }
            msg += ` ${JSON.stringify(simpleMeta)}`;
          }
        }
        return msg;
      })
    );

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { service: 'MaruBot' },
      transports: [
        new winston.transports.Console({
          format: consoleFormat,
        }),
        new winston.transports.File({
          filename: path.join('logs', 'error.log'),
          level: 'error',
        }),
        new winston.transports.File({
          filename: path.join('logs', 'combined.log'),
        }),
      ],
    });
  }

  /**
   * Log un message de niveau debug
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.logger.debug(message, meta);
  }

  /**
   * Log un message de niveau info
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.logger.info(message, meta);
  }

  /**
   * Log un message de niveau warn
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.logger.warn(message, meta);
  }

  /**
   * Log un message de niveau error
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    if (error instanceof Error) {
      this.logger.error(message, { error: error.message, stack: error.stack, ...meta });
    } else {
      this.logger.error(message, { error, ...meta });
    }
  }

  /**
   * Retourne l'instance Winston pour usage avancé
   */
  getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

export const logger = new LoggerService();
