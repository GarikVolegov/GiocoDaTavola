// "Storie" mode: complete narrative tales whose protagonist hits crucial
// crossroads ("bivi") that the group debates with the normal engine. Pure
// planning + content helpers (no game state), mirroring percorso.ts: a Story
// compiles to an ordered list of synthesized Dilemmas (the bivi) plus parallel
// narration/consequence + act arrays. Loaded once from server/data/stories.json.

import { readFileSync } from 'fs';
import { join } from 'path';
import type { Complessita, Dilemma } from './deck';
import type { VoteChoice } from './rooms';

/** The four narrative registers the catalog spans. */
export const STORY_GENRES = ['avventura', 'scifi', 'giallo', 'dramma'] as const;
export type StoryGenre = (typeof STORY_GENRES)[number];

export function isStoryGenre(v: string): v is StoryGenre {
  return (STORY_GENRES as readonly string[]).includes(v);
}

/** The crossroads itself — reuses the Dilemma fields the debate engine needs. */
export interface StoryBivio {
  text: string;
  optionA: string;
  optionB: string;
  /** 2–3 talking points for defending side A / B (fed to spunti + bot defense). */
  spuntiA: string[];
  spuntiB: string[];
  /** Optional debate-complexity tier (drives the existing ◆/◆◆/◆◆◆ badge). */
  complessita?: Complessita;
}

/** One scene: prose that sets up a crossroads + the two branch consequences. */
export interface StoryScene {
  id: string;
  /** Narrative prose leading into the crossroads (shown on host + phone). */
  narration: string;
  bivio: StoryBivio;
  /** What happens if the group's (second-vote) decision is A / B. */
  consequenceA: string;
  consequenceB: string;
}

/** A pacing chapter; acts give natural breaks without being their own phase. */
export interface StoryAct {
  id: string;
  title: string;
  emoji?: string;
  scenes: StoryScene[];
}

/** A variant ending, chosen by how many scenes the group resolved toward A. */
export interface StoryEpilogo {
  /** Inclusive range of A-decisions this ending covers. */
  minA: number;
  maxA: number;
  text: string;
}

/** One complete, hand-authored story. */
export interface Story {
  id: string;
  title: string;
  genre: StoryGenre;
  emoji: string;
  /** Teaser shown in the story picker. */
  hook: string;
  /** The protagonist's name, shown on the intro card. */
  protagonist: string;
  /** Opening prose (the setting), shown at STORY_INTRO. */
  premessa: string;
  acts: StoryAct[];
  /** Variant endings; must collectively cover 0..N (N = number of scenes). */
  epiloghi: StoryEpilogo[];
  /** Rough length estimate (minutes) for the picker. */
  durataStimaMin: number;
}

/**
 * A compiled story plan: the synthesized bivi (engine input) plus parallel
 * scene/act arrays. `dilemmas[i]`, `scenes[i]`, `acts[i]` all describe scene i.
 */
export interface StoriaPlan {
  dilemmas: Dilemma[];
  scenes: StoryScene[];
  /** Parallel to scenes: the 0-based act index of each scene. */
  acts: number[];
}

/** A lightweight catalog entry for the leader's story picker (no prose). */
export interface StoriaCatalogItem {
  id: string;
  title: string;
  genre: StoryGenre;
  emoji: string;
  hook: string;
  durataStimaMin: number;
  /** Number of crossroads (debate rounds) in the story. */
  scene: number;
}

/** Total number of crossroads (scenes) across a story's acts. */
export function totalScenes(story: Story): number {
  return story.acts.reduce((n, a) => n + a.scenes.length, 0);
}

/**
 * Flatten a story's acts into an ordered plan, synthesizing one Dilemma per
 * crossroads so the existing debate engine drives each bivio unchanged. Order is
 * authorial (deterministic, no rng); bots still vote randomly via the engine.
 */
export function buildStoriaPlan(story: Story): StoriaPlan {
  const dilemmas: Dilemma[] = [];
  const scenes: StoryScene[] = [];
  const acts: number[] = [];
  story.acts.forEach((act, actIdx) => {
    for (const scene of act.scenes) {
      dilemmas.push({
        id: `story-${story.id}-${scene.id}`,
        text: scene.bivio.text,
        optionA: scene.bivio.optionA,
        optionB: scene.bivio.optionB,
        register: 'vita',
        ...(scene.bivio.complessita ? { complessita: scene.bivio.complessita } : {}),
        spuntiA: scene.bivio.spuntiA,
        spuntiB: scene.bivio.spuntiB,
      });
      scenes.push(scene);
      acts.push(actIdx);
    }
  });
  return { dilemmas, scenes, acts };
}

/**
 * Resolve the group's decision for a just-closed crossroads from the second-vote
 * tally; break a tie by the first-vote lead, and a total tie by defaulting to A.
 */
export function decisionForRound(
  second: { A: number; B: number },
  first: { A: number; B: number },
): VoteChoice {
  if (second.A !== second.B) return second.A > second.B ? 'A' : 'B';
  if (first.A !== first.B) return first.A > first.B ? 'A' : 'B';
  return 'A';
}

/** How many crossroads the group resolved toward A. */
export function countDecisionsA(decisions: VoteChoice[]): number {
  return decisions.filter((d) => d === 'A').length;
}

/** Pick the ending whose [minA, maxA] contains the A-count (fallback: the last). */
export function pickEpilogo(epiloghi: StoryEpilogo[], decisionsA: number): string {
  const match = epiloghi.find((e) => decisionsA >= e.minA && decisionsA <= e.maxA);
  return (match ?? epiloghi[epiloghi.length - 1])?.text ?? '';
}

/** Project the stories down to the picker catalog (ids + teasers, no prose). */
export function storieCatalog(stories: Story[]): StoriaCatalogItem[] {
  return stories.map((s) => ({
    id: s.id,
    title: s.title,
    genre: s.genre,
    emoji: s.emoji,
    hook: s.hook,
    durataStimaMin: s.durataStimaMin,
    scene: totalScenes(s),
  }));
}

/**
 * Validate a loaded story is well-formed. Returns a list of human-readable
 * problems (empty ⇒ valid). Used by the content-lint test and the loader.
 */
export function validateStory(story: Story): string[] {
  const errors: string[] = [];
  const where = `storia "${story.id || '?'}"`;
  if (!story.id?.trim()) errors.push(`${where}: id mancante`);
  if (!story.title?.trim()) errors.push(`${where}: titolo mancante`);
  if (!isStoryGenre(story.genre)) errors.push(`${where}: genere non valido`);
  if (!story.premessa?.trim()) errors.push(`${where}: premessa mancante`);
  if (!story.protagonist?.trim()) errors.push(`${where}: protagonista mancante`);
  if (!Array.isArray(story.acts) || story.acts.length === 0) {
    errors.push(`${where}: nessun atto`);
  }
  const n = totalScenes(story);
  if (n === 0) errors.push(`${where}: nessun bivio`);
  for (const act of story.acts ?? []) {
    if (!act.title?.trim()) errors.push(`${where}: atto "${act.id}" senza titolo`);
    if (!Array.isArray(act.scenes) || act.scenes.length === 0) {
      errors.push(`${where}: atto "${act.id}" senza scene`);
    }
    for (const s of act.scenes ?? []) {
      const w = `${where} scena "${s.id}"`;
      if (!s.narration?.trim()) errors.push(`${w}: narrazione vuota`);
      if (!s.consequenceA?.trim() || !s.consequenceB?.trim()) {
        errors.push(`${w}: conseguenza A/B vuota`);
      }
      const b = s.bivio;
      if (!b?.text?.trim() || !b.optionA?.trim() || !b.optionB?.trim()) {
        errors.push(`${w}: bivio incompleto`);
      } else if (b.optionA.trim().toLowerCase() === b.optionB.trim().toLowerCase()) {
        errors.push(`${w}: opzioni A/B identiche`);
      }
      if (!Array.isArray(b?.spuntiA) || b.spuntiA.length === 0 || !Array.isArray(b?.spuntiB) || b.spuntiB.length === 0) {
        errors.push(`${w}: spunti A/B mancanti`);
      }
    }
  }
  // Every possible A-count (0..N) must map to exactly one epilogue.
  if (!Array.isArray(story.epiloghi) || story.epiloghi.length === 0) {
    errors.push(`${where}: nessun epilogo`);
  } else {
    for (let a = 0; a <= n; a++) {
      const covering = story.epiloghi.filter((e) => a >= e.minA && a <= e.maxA);
      if (covering.length === 0) errors.push(`${where}: epiloghi non coprono ${a} decisioni-A`);
      if (covering.length > 1) errors.push(`${where}: epiloghi si sovrappongono a ${a} decisioni-A`);
    }
  }
  return errors;
}

/**
 * Load the story catalog from server/data/stories.json. Path resolved from
 * __dirname so it works in dev (server/src/game) and build (server/dist/game).
 */
export function loadStories(): Story[] {
  const file = join(__dirname, '..', '..', 'data', 'stories.json');
  return JSON.parse(readFileSync(file, 'utf-8')) as Story[];
}
