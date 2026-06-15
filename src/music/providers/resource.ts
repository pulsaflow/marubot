import * as playdl from "play-dl";
import {
  createAudioResource,
  demuxProbe,
  StreamType,
  type AudioResource,
} from "@discordjs/voice";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Track } from "../Track.js";

const DEBUG_AUDIO = true;

function isYouTubeUrl(url: string): boolean {
  return /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
}

function spawnYtDlpAudioPipe(youtubeUrl: string): ChildProcessWithoutNullStreams {
  /**
   * Objectif:
   * - éviter HLS (m3u8) qui te donne 403 fragments
   * - forcer audio direct (m4a/webm) quand possible
   * - utiliser des clients alternatifs qui cassent moins (android/ios)
   */
  const args = [
    "--no-playlist",
    "--newline",
    "--no-progress",

    // ⚠️ Forcer un format audio NON m3u8
    "-f",
    "ba[protocol^=https][ext=m4a]/ba[protocol^=https][ext=webm]/bestaudio[protocol^=https]",

    // Aide YouTube en 2025 (clients alternatifs)
    "--extractor-args",
    "youtube:player_client=android,ios,web",

    // Sortie stdout
    "-o",
    "-",
    youtubeUrl,
  ];

  const proc = spawn("yt-dlp", args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (DEBUG_AUDIO) {
    proc.stderr.on("data", (chunk) => console.log("[yt-dlp:stderr]", String(chunk).slice(0, 600)));
    proc.on("close", (code) => console.log("[yt-dlp] exited with code:", code));
  }

  return proc;
}

function spawnFfmpegFromStdin(): ChildProcessWithoutNullStreams {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    "pipe:0",
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "pipe:1",
  ];

  const ffmpeg = spawn("ffmpeg", args, {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (DEBUG_AUDIO) {
    ffmpeg.stderr.on("data", (chunk) => console.log("[ffmpeg:stderr]", String(chunk).slice(0, 600)));
    ffmpeg.on("close", (code) => console.log("[ffmpeg] exited with code:", code));

    let bytes = 0;
    ffmpeg.stdout.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 200_000) {
        console.log("[ffmpeg] audio flowing (bytes):", bytes);
        ffmpeg.stdout.removeAllListeners("data");
      }
    });
  }

  return ffmpeg;
}

export async function createAudioResourceFromTrack(track: Track): Promise<AudioResource<Track>> {
  const url = track.url;

  // ✅ YouTube : yt-dlp -> ffmpeg -> PCM RAW
  if (isYouTubeUrl(url) || track.source === "youtube") {
    if (DEBUG_AUDIO) console.log("[Music] Provider: YouTube -> yt-dlp(pipe) -> ffmpeg(stdin) -> RAW");

    const ytdlp = spawnYtDlpAudioPipe(url);
    const ffmpeg = spawnFfmpegFromStdin();

    ytdlp.stdout.pipe(ffmpeg.stdin);

    ytdlp.on("close", () => {
      try { ffmpeg.stdin.end(); } catch {}
    });

    const resource = createAudioResource(ffmpeg.stdout, {
      inputType: StreamType.Raw,
      inlineVolume: true,
      metadata: track,
    });

    resource.playStream.on("close", () => {
      try { ytdlp.kill("SIGKILL"); } catch {}
      try { ffmpeg.kill("SIGKILL"); } catch {}
    });

    return resource;
  }

  // ✅ Non-YouTube : play-dl normal
  const { stream, type } = await playdl.stream(url);

  if (!type || type === "arbitrary") {
    const probed = await demuxProbe(stream);
    return createAudioResource(probed.stream, {
      inputType: probed.type,
      inlineVolume: true,
      metadata: track,
    });
  }

  const inputType =
    type === "opus"
      ? StreamType.Opus
      : type === "ogg/opus"
      ? StreamType.OggOpus
      : type === "webm/opus"
      ? StreamType.WebmOpus
      : StreamType.Arbitrary;

  return createAudioResource(stream, {
    inputType,
    inlineVolume: true,
    metadata: track,
  });
}
