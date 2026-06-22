import { QRCodeSVG } from 'qrcode.react';
import styles from './JoinQr.module.css';

// The bivio emblem (the dilemma mark) baked as a data-URI SVG so it can be
// excavated into the QR centre. Colours are hard-coded hex (not CSS vars): the
// data URI renders in isolation, and the QR sits on a WHITE panel — so the stem
// uses dark ink instead of the theme's light --text, which would vanish on white.
const EMBLEM = `data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>" +
    "<rect width='200' height='200' rx='44' fill='#ffffff'/>" +
    "<g transform='translate(38,28.4) scale(0.62)'>" +
    "<path d='M100,205 L100,120' fill='none' stroke='#0B0E1A' stroke-width='22' stroke-linecap='round'/>" +
    "<path d='M100,120 L42,26' fill='none' stroke='#5486C4' stroke-width='22' stroke-linecap='round'/>" +
    "<path d='M100,120 L158,26' fill='none' stroke='#C77A45' stroke-width='22' stroke-linecap='round'/>" +
    "<circle cx='100' cy='120' r='12' fill='#0B0E1A'/>" +
    '</g></svg>',
)}`;

interface JoinQrProps {
  /** room code to encode into the join link */
  code: string;
  /** QR module area size in px (default 168) */
  size?: number;
}

// Branded join QR: encodes `<origin>/join?room=CODE` so a friend's camera lands
// straight in the room with the code prefilled. Rendered dark-on-white inside an
// A/B-bordered frame for reliable scanning, with the bivio emblem excavated into
// the centre and level "H" error correction so the logo doesn't break the scan.
export function JoinQr({ code, size = 168 }: JoinQrProps) {
  const url = `${window.location.origin}/join?room=${code}`;
  const img = Math.round(size * 0.28);
  return (
    <div className={styles.frame}>
      <span className={styles.label}>Schierati</span>
      <QRCodeSVG
        value={url}
        size={size}
        level="H"
        bgColor="#ffffff"
        fgColor="#0B0E1A"
        marginSize={1}
        title={`Inquadra per entrare nella stanza ${code}`}
        imageSettings={{ src: EMBLEM, height: img, width: img, excavate: true }}
      />
      <span className={styles.caption}>Inquadra per entrare</span>
    </div>
  );
}
