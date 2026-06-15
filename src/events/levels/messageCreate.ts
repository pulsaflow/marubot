import { Message } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';
import { ensureGuildExists } from '@/utils/guild';

/**
 * Calcule le niveau à partir de l'XP
 */
function calculateLevel(xp: number): number {
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Gère l'attribution d'XP lors de l'envoi d'un message
 */
export async function handleMessageXP(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  try {
    // S'assurer que le Guild existe dans la base de données
    await ensureGuildExists(message.guild);

    // Récupérer ou créer la configuration
    let levelConfig = await prisma.levelConfig.findUnique({
      where: { guildId: message.guild.id },
    });

    if (!levelConfig) {
      levelConfig = await prisma.levelConfig.create({
        data: { guildId: message.guild.id },
      });
    }

    if (!levelConfig.enabled) return;

    // Vérifier les salons ignorés
    if (levelConfig.ignoredChannels.includes(message.channel.id)) return;

    // Vérifier les rôles ignorés
    if (message.member) {
      const hasIgnoredRole = message.member.roles.cache.some((role) =>
        levelConfig.ignoredRoles.includes(role.id)
      );
      if (hasIgnoredRole) return;
    }

    // Récupérer ou créer le niveau de l'utilisateur
    let userLevel = await prisma.userLevel.findUnique({
      where: {
        guildId_userId: {
          guildId: message.guild.id,
          userId: message.author.id,
        },
      },
    });

    if (!userLevel) {
      userLevel = await prisma.userLevel.create({
        data: {
          guildId: message.guild.id,
          userId: message.author.id,
          xp: 0,
          level: 0,
          messages: 0,
        },
      });
    }

    // Vérifier le cooldown
    const now = new Date();
    if (userLevel.lastXP) {
      const timeSinceLastXP = (now.getTime() - userLevel.lastXP.getTime()) / 1000;
      if (timeSinceLastXP < levelConfig.cooldown) return;
    }

    // Générer l'XP aléatoire
    const xpGain = Math.floor(
      Math.random() * (levelConfig.xpMax - levelConfig.xpMin + 1) + levelConfig.xpMin
    );

    const oldLevel = calculateLevel(userLevel.xp);
    const newXP = userLevel.xp + xpGain;
    const newLevel = calculateLevel(newXP);

    // Mettre à jour l'XP
    await prisma.userLevel.update({
      where: {
        guildId_userId: {
          guildId: message.guild.id,
          userId: message.author.id,
        },
      },
      data: {
        xp: newXP,
        level: newLevel,
        messages: userLevel.messages + 1,
        lastXP: now,
      },
    });

    // Si niveau up, donner les récompenses
    if (newLevel > oldLevel) {
      const rewards = await prisma.levelReward.findMany({
        where: {
          guildId: message.guild.id,
          level: newLevel,
        },
      });

      if (rewards.length > 0 && message.member) {
        for (const reward of rewards) {
          try {
            await message.member.roles.add(reward.roleId);
          } catch (error) {
            logger.error(`Erreur lors de l'attribution du rôle ${reward.roleId}:`, error);
          }
        }
      }

      // Envoyer le message de niveau up si configuré
      if (levelConfig.levelUpMessage && message.member) {
        const levelUpChannel = levelConfig.levelUpChannel
          ? message.guild.channels.cache.get(levelConfig.levelUpChannel)
          : message.channel;

        if (levelUpChannel && levelUpChannel.isTextBased()) {
          const messageText = levelConfig.levelUpMessage
            .replace('{user}', `<@${message.author.id}>`)
            .replace('{level}', newLevel.toString());

          try {
            await levelUpChannel.send(messageText);
          } catch (error) {
            logger.error('Erreur lors de l\'envoi du message de niveau up:', error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Erreur lors de l\'attribution d\'XP:', error);
  }
}








