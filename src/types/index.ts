import type {
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

/**
 * Interface de base pour une commande slash
 */
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | SlashCommandSubcommandsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;
  cooldown?: number;
  permissions?: bigint[];
  guildOnly?: boolean;
}

/**
 * Configuration d'un module
 */
export interface ModuleConfig {
  name: string;
  description: string;
  enabled: boolean;
  dependencies?: string[];
}

/**
 * Interface de base pour un module
 */
export interface Module {
  config: ModuleConfig;
  onLoad(): Promise<void> | void;
  onUnload(): Promise<void> | void;
}

/**
 * Options de configuration du bot
 */
export interface BotConfig {
  token: string;
  clientId: string;
  shards?: number | 'auto';
  cacheEnabled?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Embed options standardisées
 */
export interface EmbedOptions {
  title?: string;
  description?: string;
  color?: number | string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: string;
  image?: string;
  footer?: { text: string; iconURL?: string };
  timestamp?: boolean;
}

/**
 * Configuration de serveur Discord
 */
export interface GuildConfig {
  id: string;
  name: string;
  prefix: string;
  language: string;
  premium: boolean;
  premiumUntil?: Date;
}
