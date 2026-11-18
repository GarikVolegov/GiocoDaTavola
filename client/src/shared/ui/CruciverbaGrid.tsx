import type { CruciverbaStatePayload } from '../events';

interface CruciverbaGridProps {
  state: Pick<CruciverbaStatePayload, 'rows' | 'cols' | 'words' | 'cells' | 'activeWordId'> & {
    theme?: string;
  };
  selectedWordId?: string;
  onSelectWord?: (wordId: string) => void;
  size?: 'sm' | 'md' | 'tv';
}

export function CruciverbaGrid({
  state,
  selectedWordId,
  onSelectWord,
  size = 'md',
}: CruciverbaGridProps) {
  const activeId = selectedWordId ?? state.activeWordId;
  const activeWord = state.words.find((w) => w.id === activeId);

  const cellHighlight = new Map<string, { inActiveWord: boolean; wordId?: string; solved: boolean }>();
  for (const w of state.words) {
    for (let i = 0; i < w.length; i++) {
      const r = w.direction === 'V' ? w.row + i : w.row;
      const c = w.direction === 'H' ? w.col + i : w.col;
      const key = `${r},${c}`;
      const prev = cellHighlight.get(key);
      const isSolved = w.status === 'solved';
      const isActive = w.id === activeId;
      cellHighlight.set(key, {
        inActiveWord: Boolean(prev?.inActiveWord || isActive),
        wordId: isActive ? w.id : prev?.wordId ?? w.id,
        solved: Boolean(prev?.solved || isSolved),
      });
    }
  }

  const cellDim =
    size === 'tv'
      ? 'clamp(2.6rem, 4.4vw, 3.6rem)'
      : size === 'sm'
        ? 'clamp(1.85rem, 7.5vw, 2.3rem)'
        : 'clamp(2.1rem, 8.8vw, 2.7rem)';
  const fontSize =
    size === 'tv' ? '1.35rem' : size === 'sm' ? '0.95rem' : '1.1rem';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${state.cols}, ${cellDim})`,
        gap: size === 'tv' ? '5px' : '4px',
        justifyContent: 'center',
        marginInline: 'auto',
        padding: size === 'tv' ? '0.6rem' : '0.45rem',
        borderRadius: '14px',
        background: 'rgba(8, 12, 26, 0.72)',
        border: '1px solid rgba(148, 163, 184, 0.22)',
      }}
      role="grid"
      aria-label={`Cruciverba ${state.theme ?? ''}`}
    >
      {state.cells.flatMap((row, r) =>
        row.map((cell, c) => {
          const key = `${r},${c}`;
          if (!cell) {
            return (
              <div
                key={key}
                style={{
                  width: cellDim,
                  height: cellDim,
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.025)',
                }}
              />
            );
          }

          const meta = cellHighlight.get(key);
          const isHighlighted = Boolean(meta?.inActiveWord);
          const hasLetter = cell.letter.length > 0;
          const isSolvedCell = Boolean(meta?.solved && hasLetter);

          return (
            <button
              key={key}
              type="button"
              disabled={!onSelectWord || !meta?.wordId}
              onClick={() => meta?.wordId && onSelectWord?.(meta.wordId)}
              style={{
                position: 'relative',
                width: cellDim,
                height: cellDim,
                borderRadius: '7px',
                border: isHighlighted
                  ? '2px solid #fbbf24'
                  : isSolvedCell
                    ? '1.5px solid rgba(52, 211, 153, 0.65)'
                    : '1.5px solid rgba(255, 255, 255, 0.25)',
                background: isSolvedCell
                  ? 'rgba(16, 185, 129, 0.2)'
                  : isHighlighted
                    ? 'rgba(251, 191, 36, 0.16)'
                    : 'rgba(30, 41, 59, 0.85)',
                color: isSolvedCell ? '#6ee7b7' : '#f8fafc',
                fontWeight: 800,
                fontSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: onSelectWord ? 'pointer' : 'default',
                padding: 0,
                fontFamily: 'var(--font-display, inherit)',
              }}
              aria-label={
                activeWord
                  ? `Cella ${r + 1},${c + 1}${hasLetter ? ` lettera ${cell.letter}` : ' vuota'}`
                  : undefined
              }
            >
              {cell.wordNumbers.length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '2px',
                    left: '3px',
                    fontSize: size === 'tv' ? '0.68rem' : '0.56rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: isHighlighted ? '#fcd34d' : 'rgba(226, 232, 240, 0.75)',
                  }}
                >
                  {cell.wordNumbers.join('/')}
                </span>
              )}
              <span>{cell.letter}</span>
            </button>
          );
        }),
      )}
    </div>
  );
}
