import { useState, type CSSProperties } from 'react';

// A deliberately hard-to-reach exit for use DURING a game: a small, low-opacity ⋮
// fixed top-right that opens a sheet, behind a two-tap confirm. Three deliberate
// actions (open menu → tap exit → confirm) so a stray tap never drops a player out.
// The actual leave is the parent's job (`onLeave`); this only gates it behind intent.
export default function LeaveGameMenu({ onLeave }: { onLeave: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const close = () => {
    setOpen(false);
    setConfirming(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Menu della partita"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        style={triggerStyle}
      >
        ⋮
      </button>

      {open && (
        <>
          {/* tap-outside backdrop: closes the sheet without leaving */}
          <div aria-hidden="true" onClick={close} style={backdropStyle} />
          <div role="menu" style={sheetStyle}>
            {confirming ? (
              <button
                type="button"
                onClick={() => {
                  onLeave();
                  close();
                }}
                style={exitStyle}
              >
                Esci davvero
              </button>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} style={exitStyle}>
                Esci dalla partita
              </button>
            )}
            <button type="button" onClick={close} style={cancelStyle}>
              Annulla
            </button>
          </div>
        </>
      )}
    </>
  );
}

const triggerStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + var(--space-2))',
  right: 'calc(env(safe-area-inset-right, 0px) + var(--space-2))',
  zIndex: 50,
  width: '2.25rem',
  height: '2.25rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'transparent',
  border: 'none',
  color: 'var(--text)',
  opacity: 0.4,
  fontSize: '1.4rem',
  lineHeight: 1,
  cursor: 'pointer',
};

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 49,
  background: 'transparent',
};

const sheetStyle: CSSProperties = {
  position: 'fixed',
  top: 'calc(env(safe-area-inset-top, 0px) + var(--space-7))',
  right: 'calc(env(safe-area-inset-right, 0px) + var(--space-2))',
  zIndex: 51,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
  padding: 'var(--space-3)',
  minWidth: '11rem',
  background: 'var(--surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
};

const exitStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--terracotta, inherit)',
  fontSize: '0.95rem',
  fontWeight: 700,
  textAlign: 'left',
  padding: 'var(--space-1) 0',
  cursor: 'pointer',
};

const cancelStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  fontSize: '0.9rem',
  textAlign: 'left',
  padding: 'var(--space-1) 0',
  cursor: 'pointer',
};
