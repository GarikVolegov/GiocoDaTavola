#!/usr/bin/env python3
"""
generate_story_audio.py

Generates high-fidelity neural Italian speech files (MP3) for all stories
in server/data/stories.json using Microsoft's it-IT-DiegoNeural voice.
Saves audio assets directly into client/public/audio/stories/{storyId}/.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
import edge_tts

ROOT_DIR = Path(__file__).resolve().parent.parent
STORIES_FILE = ROOT_DIR / "server" / "data" / "stories.json"
OUTPUT_BASE = ROOT_DIR / "client" / "public" / "audio" / "stories"

VOICE = "it-IT-DiegoNeural"
RATE = "-2%"

# Concurrency limit to be polite to the TTS endpoint
semaphore: asyncio.Semaphore = None


async def synthesize_file(text: str, dest_path: Path):
    if dest_path.exists() and dest_path.stat().st_size > 1024:
        print(f"  [skip] {dest_path.name} already exists")
        return

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    async with semaphore:
        for attempt in range(3):
            try:
                communicate = edge_tts.Communicate(text, VOICE, rate=RATE)
                await communicate.save(str(dest_path))
                print(f"  [ok] {dest_path.name} ({dest_path.stat().st_size // 1024} KB)")
                return
            except Exception as e:
                if attempt == 2:
                    print(f"  [ERROR] {dest_path.name}: {e}", file=sys.stderr)
                    raise
                await asyncio.sleep(1.0)


async def process_story(story: dict):
    story_id = story["id"]
    story_dir = OUTPUT_BASE / story_id
    print(f"\nProcessing Story: {story['title']} ({story_id})")

    tasks = []

    # 1. Intro
    intro_text = f"{story['title']}… Con {story['protagonist']}. — {story['premessa']}"
    tasks.append(synthesize_file(intro_text, story_dir / "intro.mp3"))

    # 2. Scenes & Bivi & Consequences
    scene_idx = 0
    for act in story.get("acts", []):
        act_title = act.get("title", "")
        for scene in act.get("scenes", []):
            # Scene narration
            prefix = f"{act_title}… " if act_title else ""
            scene_text = f"{prefix}{scene['narration']}"
            tasks.append(synthesize_file(scene_text, story_dir / f"scene_{scene_idx}.mp3"))

            # Bivio (dilemma + options)
            bivio = scene["bivio"]
            bivio_text = (
                f"Al bivio… {bivio['text']} — "
                f"Opzione A: {bivio['optionA']}. — "
                f"Opzione B: {bivio['optionB']}."
            )
            tasks.append(synthesize_file(bivio_text, story_dir / f"bivio_{scene_idx}.mp3"))

            # Consequence A
            consequence_a_text = f"Il gruppo ha scelto: {bivio['optionA']}. — {scene['consequenceA']}"
            tasks.append(synthesize_file(consequence_a_text, story_dir / f"consequence_{scene_idx}_A.mp3"))

            # Consequence B
            consequence_b_text = f"Il gruppo ha scelto: {bivio['optionB']}. — {scene['consequenceB']}"
            tasks.append(synthesize_file(consequence_b_text, story_dir / f"consequence_{scene_idx}_B.mp3"))

            scene_idx += 1

    # 3. Epilogues
    epiloghi = story.get("epiloghi", [])
    for e_idx, epilogo in enumerate(epiloghi):
        epilogue_text = f"{story['title']}: Epilogo… {epilogo['text']}"
        tasks.append(synthesize_file(epilogue_text, story_dir / f"epilogue_{e_idx}.mp3"))

    await asyncio.gather(*tasks)


async def main():
    global semaphore
    semaphore = asyncio.Semaphore(4)
    if not STORIES_FILE.exists():
        print(f"Stories file not found: {STORIES_FILE}", file=sys.stderr)
        sys.exit(1)

    with open(STORIES_FILE, "r", encoding="utf-8") as f:
        stories = json.load(f)

    # Optional filter passed as cli arg (e.g. python3 generate_story_audio.py torta-reale)
    target_id = sys.argv[1] if len(sys.argv) > 1 else None

    for story in stories:
        if target_id and story["id"] != target_id:
            continue
        await process_story(story)

    print("\nAll story audio generation completed successfully!")


if __name__ == "__main__":
    asyncio.run(main())
