import Redis from 'ioredis';
import { config } from './ConfigService';
import { logger } from './LoggerService';

/**
 * Service de cache utilisant Redis
 */
export class CacheService {
  private client: Redis | null = null;
  private enabled: boolean = false;

  constructor() {
    if (config.redisUrl) {
      try {
        this.client = new Redis(config.redisUrl, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        this.client.on('connect', () => {
          logger.info('Connexion à Redis établie');
          this.enabled = true;
        });

        this.client.on('error', (error) => {
          logger.error('Erreur Redis:', error);
          this.enabled = false;
        });

        this.client.on('ready', () => {
          logger.info('Redis prêt');
          this.enabled = true;
        });
      } catch (error) {
        logger.warn('Redis non disponible, utilisation du cache mémoire uniquement');
        this.enabled = false;
      }
    } else {
      logger.info('Redis non configuré, utilisation du cache mémoire uniquement');
    }
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Erreur lors de la récupération du cache pour la clé ${key}:`, error);
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.client.setex(key, ttl, serialized);
      } else {
        await this.client.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Erreur lors de l'écriture du cache pour la clé ${key}:`, error);
      return false;
    }
  }

  /**
   * Supprime une clé du cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la suppression du cache pour la clé ${key}:`, error);
      return false;
    }
  }

  /**
   * Supprime plusieurs clés du cache
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.enabled || !this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      await this.client.del(...keys);
      return keys.length;
    } catch (error) {
      logger.error(`Erreur lors de la suppression du pattern ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Vérifie si une clé existe
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Erreur lors de la vérification de l'existence de la clé ${key}:`, error);
      return false;
    }
  }

  /**
   * Définit un TTL pour une clé existante
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.enabled || !this.client) {
      return false;
    }

    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error(`Erreur lors de la définition du TTL pour la clé ${key}:`, error);
      return false;
    }
  }

  /**
   * Récupère plusieurs valeurs en une fois
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    if (!this.enabled || !this.client || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const values = await this.client.mget(...keys);
      return values.map((v) => (v ? (JSON.parse(v) as T) : null));
    } catch (error) {
      logger.error('Erreur lors de la récupération multiple du cache:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Ferme la connexion Redis
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.enabled = false;
      logger.info('Connexion Redis fermée');
    }
  }

  /**
   * Vérifie si le cache est activé
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

export const cache = new CacheService();








