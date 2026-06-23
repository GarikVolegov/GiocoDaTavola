// Preset avatars (emoji on a colored disc) — coherent with the game's emoji
// theme and zero image assets to ship. Stored as `preset:<id>`.
// ⚠ Keep these ids in sync with PRESET_AVATAR_IDS in server/src/profile.ts
// (the CJS server and ESM client can't share a module).
export interface PresetAvatar {
  id: string;
  emoji: string;
  label: string;
}

export const PRESET_AVATARS: readonly PresetAvatar[] = [
  { id: 'volpe', emoji: '🦊', label: 'Volpe' },
  { id: 'lupo', emoji: '🐺', label: 'Lupo' },
  { id: 'leone', emoji: '🦁', label: 'Leone' },
  { id: 'panda', emoji: '🐼', label: 'Panda' },
  { id: 'gufo', emoji: '🦉', label: 'Gufo' },
  { id: 'polpo', emoji: '🐙', label: 'Polpo' },
  { id: 'aquila', emoji: '🦅', label: 'Aquila' },
  { id: 'drago', emoji: '🐲', label: 'Drago' },
  { id: 'gatto', emoji: '🐱', label: 'Gatto' },
  { id: 'rana', emoji: '🐸', label: 'Rana' },
];

/** The emoji for a preset id, or null when unknown. */
export function presetEmoji(id: string): string | null {
  return PRESET_AVATARS.find((a) => a.id === id)?.emoji ?? null;
}
