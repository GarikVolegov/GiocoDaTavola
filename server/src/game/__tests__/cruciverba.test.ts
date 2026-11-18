import { describe, it, expect } from 'vitest';
import {
  CRUCIVERBA_BOARDS,
  getWordCells,
  initCruciverbaRound,
  submitCruciverbaAttempt,
  passOrTimeoutCruciverbaTurn,
  serializeCruciverbaState,
  getCurrentCruciverbaPlayerId,
  revealRemainingCruciverbaWords,
} from '../cruciverba';

describe('Cruciverba Show 2D grid invariants & turn engine', () => {
  it('validates all 10 boards for bounds, exact letter intersections, and zero unintended touching', () => {
    expect(CRUCIVERBA_BOARDS.length).toBeGreaterThanOrEqual(10);
    const seenIds = new Set<string>();

    for (const board of CRUCIVERBA_BOARDS) {
      expect(seenIds.has(board.id)).toBe(false);
      seenIds.add(board.id);
      expect(board.words.length).toBeGreaterThanOrEqual(4);

      const grid: Array<Array<{ letter: string; wordIds: Set<string>; dirs: Set<'H' | 'V'> } | null>> =
        Array.from({ length: board.rows }, () => Array.from({ length: board.cols }, () => null));

      for (const word of board.words) {
        expect(word.word).toMatch(/^[A-Z]{3,}$/);
        for (const c of getWordCells(word)) {
          expect(c.row).toBeGreaterThanOrEqual(0);
          expect(c.row).toBeLessThan(board.rows);
          expect(c.col).toBeGreaterThanOrEqual(0);
          expect(c.col).toBeLessThan(board.cols);

          const cell = grid[c.row][c.col];
          if (!cell) {
            grid[c.row][c.col] = {
              letter: c.letter,
              wordIds: new Set([word.id]),
              dirs: new Set([word.direction]),
            };
          } else {
            // Intersections must share exact same letter and never run in the same direction
            expect(cell.letter).toBe(c.letter);
            expect(cell.dirs.has(word.direction)).toBe(false);
            cell.wordIds.add(word.id);
            cell.dirs.add(word.direction);
          }
        }
      }

      // Check every filled horizontal run & vertical run matches an actual declared word
      for (let r = 0; r < board.rows; r++) {
        let runStart = -1;
        for (let c = 0; c <= board.cols; c++) {
          const filled = c < board.cols && grid[r][c] !== null;
          if (filled && runStart === -1) runStart = c;
          if (!filled && runStart !== -1) {
            const len = c - runStart;
            if (len >= 2) {
              const runText = Array.from({ length: len }, (_, k) => grid[r][runStart + k]!.letter).join('');
              const declared = board.words.find(
                (w) => w.direction === 'H' && w.row === r && w.col === runStart && w.word === runText,
              );
              expect(declared, `Unexpected horizontal run "${runText}" in ${board.id} at (${r},${runStart})`).toBeDefined();
            }
            runStart = -1;
          }
        }
      }

      for (let c = 0; c < board.cols; c++) {
        let runStart = -1;
        for (let r = 0; r <= board.rows; r++) {
          const filled = r < board.rows && grid[r][c] !== null;
          if (filled && runStart === -1) runStart = r;
          if (!filled && runStart !== -1) {
            const len = r - runStart;
            if (len >= 2) {
              const runText = Array.from({ length: len }, (_, k) => grid[runStart + k][c]!.letter).join('');
              const declared = board.words.find(
                (w) => w.direction === 'V' && w.row === runStart && w.col === c && w.word === runText,
              );
              expect(declared, `Unexpected vertical run "${runText}" in ${board.id} at (${runStart},${c})`).toBeDefined();
            }
            runStart = -1;
          }
        }
      }
    }
  });

  it('runs explicit player turns, reveals crossing letters, scores cleanly, and prevents secret leaks before solve', () => {
    const board = CRUCIVERBA_BOARDS[0]; // SPRITZ / PIZZA / NOTTE / AMARO
    const state = initCruciverbaRound(board, ['p1', 'p2', 'p3'], () => 0.1);
    const active1 = getCurrentCruciverbaPlayerId(state)!;
    const other = ['p1', 'p2', 'p3'].find((p) => p !== active1)!;

    // Non-active player cannot submit
    const badTurn = submitCruciverbaAttempt(state, other, 'SPRITZ');
    expect(badTurn.ok).toBe(false);
    expect(badTurn.error).toBe('NOT_YOUR_TURN');

    // Secret answers must NOT leak in serialized state before reveal
    const publicBefore = serializeCruciverbaState(state, (id) => id, false);
    expect(publicBefore.words.every((w) => w.answer === undefined)).toBe(true);

    // Wrong guess does not advance turn and awards 0
    const wrong = submitCruciverbaAttempt(state, active1, 'SBAGLIATO');
    expect(wrong.ok).toBe(true);
    expect(wrong.correct).toBe(false);
    expect(getCurrentCruciverbaPlayerId(state)).toBe(active1);

    // Correct guess solves SPRITZ (0 hints -> 120 pt), advances turn, and unlocks P in PIZZA & T in NOTTE
    const ok1 = submitCruciverbaAttempt(state, active1, 'sprìtz ');
    expect(ok1.ok).toBe(true);
    expect(ok1.correct).toBe(true);
    expect(ok1.pointsAwarded).toBe(120);
    expect(getCurrentCruciverbaPlayerId(state)).not.toBe(active1);

    const publicMid = serializeCruciverbaState(state, (id) => id, false);
    expect(publicMid.cells[2][1]?.letter).toBe('P'); // crossing cell into PIZZA!
    expect(publicMid.cells[2][4]?.letter).toBe('T'); // crossing cell into NOTTE!

    // Timeout reveals 1 letter of current pending word and advances turn
    const active2 = getCurrentCruciverbaPlayerId(state)!;
    const timeoutRes = passOrTimeoutCruciverbaTurn(state, 'timeout', undefined, () => 0);
    expect(timeoutRes.ok).toBe(true);
    expect(timeoutRes.revealedLetter).toBeDefined();
    expect(getCurrentCruciverbaPlayerId(state)).not.toBe(active2);

    revealRemainingCruciverbaWords(state);
    const publicFinal = serializeCruciverbaState(state, (id) => id, true);
    expect(publicFinal.words.every((w) => typeof w.answer === 'string')).toBe(true);
  });
});
