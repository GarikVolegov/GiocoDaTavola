import { useState } from 'react';
import { Button } from './Button';
import styles from './ShareInviteButton.module.css';

interface ShareInviteButtonProps {
  /** room code to build the join link from — same prop JoinQr takes */
  code: string;
}

const SHARE_TEXT = 'Unisciti alla mia partita su Schierati!';
const COPIED_FEEDBACK_MS = 2000;

function buildJoinUrl(code: string): string {
  return `${window.location.origin}/join?room=${code}`;
}

export function ShareInviteButton({ code }: ShareInviteButtonProps) {
  const [copied, setCopied] = useState(false);
  const [showRawLink, setShowRawLink] = useState(false);
  const url = buildJoinUrl(code);

  async function copyToClipboard() {
    if (typeof navigator.clipboard?.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(`${SHARE_TEXT}\n${url}`);
        setCopied(true);
        setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
        return;
      } catch {
        // permission denied or unsupported context — fall through
      }
    }
    setShowRawLink(true);
  }

  async function handleClick() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Schierati', text: SHARE_TEXT, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    await copyToClipboard();
  }

  return (
    <div className={styles.wrap}>
      <Button type="button" variant="ghost" onClick={handleClick}>
        Inoltra invito
      </Button>
      {copied && <p className={styles.feedback}>✓ Link copiato</p>}
      {showRawLink && <p className={styles.rawLink}>{url}</p>}
    </div>
  );
}
