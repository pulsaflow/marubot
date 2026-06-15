import { Client, TextChannel } from 'discord.js';
import { prisma } from '@/database/client';
import { logger } from '@/services/LoggerService';
import { createSuccessEmbed } from '@/utils/embeds';

/**
 * Service de gestion des giveaways
 */
export class GiveawayService {
  private client: Client;
  private interval: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
    this.startInterval();
  }

  /**
   * Démarre l'intervalle de vérification des giveaways
   */
  private startInterval(): void {
    // Vérifier toutes les minutes
    this.interval = setInterval(() => {
      this.checkGiveaways().catch((error) => {
        logger.error('Erreur lors de la vérification des giveaways:', error);
      });
    }, 60 * 1000);

    // Vérifier immédiatement au démarrage
    this.checkGiveaways().catch((error) => {
      logger.error('Erreur lors de la vérification initiale des giveaways:', error);
    });
  }

  /**
   * Vérifie et termine les giveaways expirés
   */
  async checkGiveaways(): Promise<void> {
    try {
      const now = new Date();
      const expiredGiveaways = await prisma.giveaway.findMany({
        where: {
          ended: false,
          endAt: {
            lte: now,
          },
        },
      });

      for (const giveaway of expiredGiveaways) {
        await this.endGiveaway(giveaway.id);
      }
    } catch (error) {
      logger.error('Erreur lors de la vérification des giveaways:', error);
    }
  }

  /**
   * Termine un giveaway et sélectionne les gagnants
   */
  async endGiveaway(giveawayId: string): Promise<void> {
    try {
      const giveaway = await prisma.giveaway.findUnique({
        where: { id: giveawayId },
      });

      if (!giveaway || giveaway.ended) return;

      const channel = (await this.client.channels.fetch(giveaway.channelId).catch(
        () => null
      )) as TextChannel | null;

      if (!channel) {
        logger.warn(`Canal ${giveaway.channelId} introuvable pour le giveaway ${giveawayId}`);
        await prisma.giveaway.update({
          where: { id: giveawayId },
          data: { ended: true },
        });
        return;
      }

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) {
        logger.warn(`Message ${giveaway.messageId} introuvable pour le giveaway ${giveawayId}`);
        await prisma.giveaway.update({
          where: { id: giveawayId },
          data: { ended: true },
        });
        return;
      }

      // Récupérer les participants depuis les réactions
      const reaction = message.reactions.cache.find((r) => r.emoji.name === '🎉');
      let participants: string[] = [];

      if (reaction) {
        const users = await reaction.users.fetch();
        participants = users
          .filter((user) => !user.bot)
          .map((user) => user.id);
      }

      // Utiliser les participants de la base de données si disponibles
      if (giveaway.participants.length > 0) {
        participants = [...new Set([...participants, ...giveaway.participants])];
      }

      // Sélectionner les gagnants
      const winners: string[] = [];
      const winnersCount = Math.min(giveaway.winners, participants.length);

      if (participants.length > 0) {
        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        winners.push(...shuffled.slice(0, winnersCount));
      }

      // Mettre à jour le giveaway
      await prisma.giveaway.update({
        where: { id: giveawayId },
        data: {
          ended: true,
          winnersList: winners,
        },
      });

      // Créer le message de fin
      const winnersMention = winners.length > 0
        ? winners.map((id) => `<@${id}>`).join(', ')
        : 'Aucun participant';

      const winnersText =
        winners.length > 0
          ? `🎉 **Gagnant(s):** ${winnersMention}`
          : '❌ Aucun gagnant (pas de participants)';

      const endEmbed = createSuccessEmbed({
        title: '🎉 Giveaway terminé !',
        description: `**Prix:** ${giveaway.prize}\n\n${winnersText}\n\n**Participants:** ${participants.length}`,
        guild: channel.guild,
      });

      await channel.send({ embeds: [endEmbed] });

      // Mentionner les gagnants
      if (winners.length > 0) {
        await channel.send({
          content: `Félicitations ${winnersMention} ! Vous avez gagné **${giveaway.prize}** !`,
        });
      }
    } catch (error) {
      logger.error(`Erreur lors de la fin du giveaway ${giveawayId}:`, error);
    }
  }

  /**
   * Arrête le service
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}








