import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const CACHE_DIR = path.resolve(__dirname, '../../data/audio-cache');
const VOICE = 'it-IT-DiegoNeural';
export const MAX_TTS_TEXT_LENGTH = 500;
const MAX_CACHE_FILES = 1500;
const TTS_TIMEOUT_MS = 12_000;
const inFlight = new Map<string, Promise<string>>();

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/** Evict oldest cached MP3s if the cache directory exceeds MAX_CACHE_FILES. */
function pruneCacheIfNeeded(): void {
  try {
    const entries = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.mp3') && !f.includes('.tmp.'));
    if (entries.length <= MAX_CACHE_FILES) return;
    const withTime = entries.map((name) => {
      const full = path.join(CACHE_DIR, name);
      try {
        return { full, mtimeMs: fs.statSync(full).mtimeMs };
      } catch {
        return { full, mtimeMs: 0 };
      }
    });
    withTime.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const toRemove = withTime.length - MAX_CACHE_FILES;
    for (let i = 0; i < toRemove; i++) {
      try {
        fs.unlinkSync(withTime[i].full);
      } catch {
        /* ignore eviction errors */
      }
    }
  } catch {
    /* ignore cache scan errors */
  }
}

/**
 * Returns the path to a cached neural MP3 for the given text,
 * generating it via pure Node.js MsEdgeTTS (Diego voice) if it does not yet exist.
 */
export async function getOrGenerateTts(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) throw new Error('Empty text');
  if (clean.length > MAX_TTS_TEXT_LENGTH) throw new Error('Text too long');

  ensureCacheDir();

  const hash = crypto.createHash('sha256').update(`${VOICE}:${clean}`).digest('hex').slice(0, 32);
  const destPath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size > 512) return destPath;
  }

  const pending = inFlight.get(hash);
  if (pending) return pending;

  const job = (async (): Promise<string> => {
    const tempPath = path.join(CACHE_DIR, `${hash}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.mp3`);
    let timer: NodeJS.Timeout | undefined;

    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(clean, { rate: -0.02 });
      const out = fs.createWriteStream(tempPath);
      audioStream.pipe(out);

      await new Promise<void>((resolve, reject) => {
        timer = setTimeout(() => {
          audioStream.destroy();
          out.destroy();
          reject(new Error('TTS generation timed out'));
        }, TTS_TIMEOUT_MS);
        timer.unref();
        out.on('finish', () => resolve());
        audioStream.on('error', (err) => reject(err));
        out.on('error', (err) => reject(err));
      });

      if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 512) {
        fs.renameSync(tempPath, destPath);
        pruneCacheIfNeeded();
      } else {
        throw new Error('Generated audio file is too small or missing');
      }
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          /* ignore cleanup error */
        }
      }
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      inFlight.delete(hash);
    }

    return destPath;
  })();

  inFlight.set(hash, job);
  return job;
}

export function getAudioCacheDir(): string {
  ensureCacheDir();
  return CACHE_DIR;
}
