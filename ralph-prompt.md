# Ralph Agent Instructions — Dibattiti tra amici

You are an autonomous coding agent working on this project (a Jackbox-style web game).
Work on ONE user story per iteration. Fresh context each time — git history,
`progress.txt`, and `prd.json` are your only memory.

## Your Task

1. Read the PRD at `prd.json` (same directory as this file).
2. Read `progress.txt` — read the `## Codebase Patterns` section FIRST.
3. Ensure you're on branch `ralph/skeleton-dilemma` (PRD `branchName`). If not, check it out (create from `main` if missing).
4. Pick the **highest priority** user story where `passes: false`.
5. Implement that single user story, TDD where there's logic (write/extend tests first).
6. Run the project quality checks (see below). Fix until green.
7. Update nearby `CLAUDE.md` files if you discovered reusable patterns.
8. If checks pass, commit ALL changes: `feat: [Story ID] - [Story Title]`.
9. Set `passes: true` for that story in `prd.json`.
10. Append a report to `progress.txt`.

## Project Quality Checks

Run from the repo root:

```
npm run typecheck   # tsc --noEmit across server + client
npm run lint        # eslint
npm test            # vitest (server game logic)
npm run build       # ensures client + server build
```

Do NOT commit if any check fails. Keep changes focused and minimal; follow existing patterns.

## Stack & Conventions

- Monorepo: `server/` (Node + Express + Socket.IO, TypeScript) and `client/` (React + Vite, TypeScript).
- Server is the authoritative game state machine; state is in-memory (no DB, no accounts).
- Timers are computed server-side (expiry timestamp) and broadcast; clients only render countdowns.
- Votes are SECRET: never broadcast individual votes to host or other players — only aggregate counts.
- Shared Socket.IO event types live in a shared module reused by host and player views.

## Browser Verification (UI stories)

For any story changing the UI, verify in a browser before marking it done:
1. Run `npm run dev`.
2. Open `/host` in one tab and `/` (player) in 2–3 other tabs; simulate a room.
3. Confirm the acceptance criteria visually.
If no browser tooling is available, note in `progress.txt` that manual browser verification is still needed.

## Progress Report Format (APPEND, never replace)

```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

Add genuinely reusable, general patterns to a `## Codebase Patterns` section at the TOP of `progress.txt` (create it if missing). Not story-specific details.

## Stop Condition

After completing a story, check `prd.json`. If ALL stories have `passes: true`, reply with exactly:
<promise>COMPLETE</promise>

Otherwise end normally — the next iteration picks up the next story.

## Important

- ONE story per iteration. Commit frequently. Keep CI/quality green (broken code compounds).
- Never weaken or skip tests to make checks pass.
