import type { GuildMember, APIInteractionGuildMember, APIInteractionDataResolvedGuildMember } from 'discord.js';

/**
 * Type guard pour vérifier qu'un membre est un GuildMember complet
 */
export function isGuildMember(
  member: GuildMember | APIInteractionGuildMember | APIInteractionDataResolvedGuildMember | null
): member is GuildMember {
  return member !== null && 'voice' in member && typeof (member as any).voice !== 'undefined';
}

/**
 * Type guard pour vérifier qu'un membre de modération est un GuildMember complet
 */
export function isGuildMemberForModeration(
  member: GuildMember | APIInteractionDataResolvedGuildMember | null
): member is GuildMember {
  return member !== null && 'user' in member && 'kickable' in member;
}









