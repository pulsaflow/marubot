/**
 * Track - Représente une piste audio
 */

import type { TrackData } from './types';

export class Track {
  public readonly title: string;
  public readonly url: string;
  public readonly duration: number;
  public readonly thumbnail?: string;
  public readonly author?: string;
  public readonly requestedBy: string;

  constructor(data: TrackData) {
    this.title = data.title;
    this.url = data.url;
    this.duration = data.duration;
    this.thumbnail = data.thumbnail;
    this.author = data.author;
    this.requestedBy = data.requestedBy;
  }

  get durationFormatted(): string {
    const minutes = Math.floor(this.duration / 60);
    const seconds = this.duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}
