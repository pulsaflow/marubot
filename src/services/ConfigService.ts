import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';
import { logger } from './LoggerService';

dotenvConfig();

/**
 * Schéma de validation pour les variables d'environnement
 */
const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN est requis'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID est requis'),
  DISCORD_CLIENT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().url('DATABASE_URL doit être une URL valide'),
  REDIS_URL: z.string().url().optional(),
  WEB_PORT: z.coerce.number().default(3000),
  WEB_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SHARDS: z.union([z.coerce.number(), z.literal('auto')]).default('auto'),
  CACHE_TTL: z.coerce.number().default(3600),
  MAX_QUEUE_SIZE: z.coerce.number().default(100),
  SPOTIFY_CLIENT_ID: z.string().optional(),
  SPOTIFY_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_API_KEY: z.string().optional(),
  BLAGUES_API_TOKEN: z.string().optional(),
  LAVALINK_HOST: z.string().optional(),
  LAVALINK_PORT: z.coerce.number().optional(),
  LAVALINK_PASSWORD: z.string().optional(),
});

/**
 * Service de configuration centralisé
 */
export class ConfigService {
  private readonly config: z.infer<typeof envSchema>;

  constructor() {
    try {
      this.config = envSchema.parse(process.env);
      logger.info('Configuration validée avec succès');
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.error('Erreur de validation de la configuration:', error);
        throw new Error(
          `Configuration invalide: ${error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }
      throw error;
    }
  }

  get discordToken(): string {
    return this.config.DISCORD_TOKEN;
  }

  get discordClientId(): string {
    return this.config.DISCORD_CLIENT_ID;
  }

  get discordClientSecret(): string | undefined {
    return this.config.DISCORD_CLIENT_SECRET;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get redisUrl(): string | undefined {
    return this.config.REDIS_URL;
  }

  get webPort(): number {
    return this.config.WEB_PORT;
  }

  get webUrl(): string | undefined {
    return this.config.WEB_URL;
  }

  get logLevel(): 'debug' | 'info' | 'warn' | 'error' {
    return this.config.LOG_LEVEL;
  }

  get shards(): number | 'auto' {
    return this.config.SHARDS;
  }

  get cacheTtl(): number {
    return this.config.CACHE_TTL;
  }

  get maxQueueSize(): number {
    return this.config.MAX_QUEUE_SIZE;
  }

  get spotifyClientId(): string | undefined {
    return this.config.SPOTIFY_CLIENT_ID;
  }

  get spotifyClientSecret(): string | undefined {
    return this.config.SPOTIFY_CLIENT_SECRET;
  }

  get youtubeApiKey(): string | undefined {
    return this.config.YOUTUBE_API_KEY;
  }

  get blaguesApiToken(): string | undefined {
    return this.config.BLAGUES_API_TOKEN;
  }

  get lavalinkHost(): string | undefined {
    return this.config.LAVALINK_HOST;
  }

  get lavalinkPort(): number | undefined {
    return this.config.LAVALINK_PORT;
  }

  get lavalinkPassword(): string | undefined {
    return this.config.LAVALINK_PASSWORD;
  }

  /**
   * Retourne toute la configuration (pour usage avancé)
   */
  getAll(): z.infer<typeof envSchema> {
    return { ...this.config };
  }
}

export const config = new ConfigService();


