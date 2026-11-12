import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const CACHE_DIR = path.resolve(__dirname, '../../data/audio-cache');
const VOICE = 'it-IT-DiegoNeural';

function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Returns the path to a cached neural MP3 for the given text,
 * generating it via pure Node.js MsEdgeTTS (Diego voice) if it does not yet exist.
 */
export async function getOrGenerateTts(text: string): Promise<string> {
  const clean = text.trim();
  if (!clean) throw new Error('Empty text');

  ensureCacheDir();

  const hash = crypto.createHash('sha256').update(`${VOICE}:${clean}`).digest('hex').slice(0, 32);
  const destPath = path.join(CACHE_DIR, `${hash}.mp3`);

  if (fs.existsSync(destPath)) {
    const stat = fs.statSync(destPath);
    if (stat.size > 512) return destPath;
  }

  const tempPath = path.join(CACHE_DIR, `${hash}.tmp.${Date.now()}.${Math.random().toString(36).slice(2)}.mp3`);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(clean, { rate: -0.02 });
    const out = fs.createWriteStream(tempPath);
    audioStream.pipe(out);

    await new Promise<void>((resolve, reject) => {
      out.on('finish', () => resolve());
      audioStream.on('error', (err) => reject(err));
      out.on('error', (err) => reject(err));
    });

    if (fs.existsSync(tempPath) && fs.statSync(tempPath).size > 512) {
      fs.renameSync(tempPath, destPath);
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
  }

  return destPath;
}

export function getAudioCacheDir(): string {
  ensureCacheDir();
  return CACHE_DIR;
}
