/**
 * Valide un ID Discord (18 chiffres)
 */
export function isValidDiscordId(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

/**
 * Valide une URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valide un nombre dans une plage
 */
export function isNumberInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Valide une durée (format: 1h, 30m, 2d, etc.)
 */
export function parseDuration(duration: string): number | null {
  const regex = /^(\d+)([smhd])$/i;
  const match = duration.match(regex);

  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 1);
}

/**
 * Formate une durée en secondes en texte lisible
 */
export function formatDurationShort(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Valide un emoji (unicode ou custom)
 */
export function isValidEmoji(emoji: string): boolean {
  // Emoji unicode
  const unicodeEmojiRegex =
    /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/;
  // Emoji custom Discord <:name:id>
  const customEmojiRegex = /^<a?:\w+:\d+>$/;

  return unicodeEmojiRegex.test(emoji) || customEmojiRegex.test(emoji);
}

/**
 * Sanitise un texte pour éviter les injections
 */
export function sanitizeText(text: string, maxLength = 2000): string {
  return text.slice(0, maxLength).replace(/[<>@#&!]/g, '');
}
