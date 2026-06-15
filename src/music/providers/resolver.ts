/**
 * Resolver - Résout les URLs et recherches en métadonnées
 * Base: play-dl
 */

import playdl from 'play-dl';
import type { TrackData } from '../types';
import { logger } from '../../services/LoggerService';

export async function resolveQuery(query: string, requestedBy: string): Promise<TrackData[]> {
  try {
    // Vérifier si c'est une URL valide
    const urlTypes = playdl.yt_validate(query);
    
    if (urlTypes === 'video') {
      // URL YouTube directe
      const info = await playdl.video_info(query);
      const video = info.video_details;
      
      logger.info(`[Music] Résolu URL directe: ${video.id}`);
      
      return [{
        title: video.title || 'Titre inconnu',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.durationInSec,
        thumbnail: video.thumbnails[0]?.url,
        author: video.channel?.name,
        requestedBy,
      }];
    } else if (urlTypes === 'playlist') {
      // Playlist YouTube
      const playlist = await playdl.playlist_info(query);
      const videos = await playlist.all_videos();
      
      return videos.map(video => ({
        title: video.title || 'Titre inconnu',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.durationInSec,
        thumbnail: video.thumbnails[0]?.url,
        author: video.channel?.name,
        requestedBy,
      }));
    } else {
      // Recherche YouTube
      const searchResults = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
      
      if (searchResults.length === 0) {
        throw new Error('Aucun résultat trouvé');
      }
      
      const video = searchResults[0];
      
      logger.info(`[Music] Recherche trouvée: ${video.title}, ID: ${video.id}`);
      
      return [{
        title: video.title || 'Titre inconnu',
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: video.durationInSec,
        thumbnail: video.thumbnails[0]?.url,
        author: video.channel?.name,
        requestedBy,
      }];
    }
  } catch (error) {
    logger.error('[Music] Erreur lors de la résolution de la requête:', error);
    throw new Error('Impossible de résoudre cette requête');
  }
}
