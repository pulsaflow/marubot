import { EmbedBuilder, Guild, ColorResolvable } from 'discord.js';

/**
 * Options pour créer un embed standardisé
 */
export interface CreateEmbedOptions {
  title?: string;
  description?: string;
  color?: ColorResolvable;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  thumbnail?: string;
  image?: string;
  footer?: { text?: string; iconURL?: string };
  timestamp?: boolean;
  guild?: Guild;
}

/**
 * Couleur par défaut du bot (bleu Discord)
 */
const DEFAULT_COLOR: ColorResolvable = '#5865F2';

/**
 * Crée un embed standardisé avec le style du bot
 */
export function createEmbed(options: CreateEmbedOptions = {}): EmbedBuilder {
  const embed = new EmbedBuilder();

  if (options.title) embed.setTitle(options.title);
  if (options.description) embed.setDescription(options.description);
  embed.setColor(options.color || DEFAULT_COLOR);

  if (options.fields) {
    embed.addFields(options.fields);
  }

  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  if (options.image) embed.setImage(options.image);

  // Footer par défaut avec infos serveur
  const footerText = options.footer?.text || '';
  const footerIcon = options.footer?.iconURL || options.guild?.iconURL() || undefined;

  if (options.guild) {
    embed.setFooter({
      text: footerText ? `${options.guild.name} • ${footerText}` : options.guild.name,
      iconURL: footerIcon,
    });
  } else if (footerText || footerIcon) {
    embed.setFooter({
      text: footerText,
      iconURL: footerIcon,
    });
  }

  if (options.timestamp !== false) {
    embed.setTimestamp();
  }

  return embed;
}

/**
 * Crée un embed de succès (vert)
 */
export function createSuccessEmbed(options: Omit<CreateEmbedOptions, 'color'> = {}): EmbedBuilder {
  return createEmbed({
    ...options,
    color: '#57F287', // Vert Discord
  });
}

/**
 * Crée un embed d'erreur (rouge)
 */
export function createErrorEmbed(options: Omit<CreateEmbedOptions, 'color'> = {}): EmbedBuilder {
  return createEmbed({
    ...options,
    color: '#ED4245', // Rouge Discord
  });
}

/**
 * Crée un embed d'avertissement (jaune)
 */
export function createWarningEmbed(options: Omit<CreateEmbedOptions, 'color'> = {}): EmbedBuilder {
  return createEmbed({
    ...options,
    color: '#FEE75C', // Jaune Discord
  });
}

/**
 * Crée un embed d'information (bleu)
 */
export function createInfoEmbed(options: Omit<CreateEmbedOptions, 'color'> = {}): EmbedBuilder {
  return createEmbed({
    ...options,
    color: '#5865F2', // Bleu Discord
  });
}








