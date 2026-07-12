import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Button } from '../shared/ui';
import { parseRoomFromQr } from './qrScan';

// A camera QR reader for joining a room: opens the rear camera, decodes frames with jsQR
// and reports the first scanned room code. getUserMedia needs a secure context (HTTPS or
// localhost); on plain-http LAN IPs the browser blocks the camera and we fall back to manual
// entry with a clear message. Self-contained overlay; stops the stream on close/unmount.
export function QrScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Keep the latest onScan without restarting the camera when the parent re-renders.
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const w = video?.videoWidth ?? 0;
      const h = video?.videoHeight ?? 0;
      if (video && ctx && w > 0 && h > 0 && video.readyState >= video.HAVE_CURRENT_DATA) {
        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(video, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        const found = jsQR(data, w, h, { inversionAttempts: 'dontInvert' });
        const code = found ? parseRoomFromQr(found.data) : null;
        if (code) {
          cancelled = true;
          onScanRef.current(code);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          raf = requestAnimationFrame(tick);
        }
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        setError(
          denied
            ? 'Permesso fotocamera negato. Inserisci il codice a mano.'
            : 'Fotocamera non disponibile qui. Inserisci il codice a mano.',
        );
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Scansiona il QR della stanza"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
      }}
    >
      {error ? (
        <p style={{ margin: 0, textAlign: 'center', color: '#fff', maxWidth: '20rem' }}>{error}</p>
      ) : (
        <>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width: 'min(82vw, 22rem)',
              aspectRatio: '1 / 1',
              objectFit: 'cover',
              borderRadius: 'var(--radius-lg)',
              border: '3px solid var(--gold)',
              background: '#000',
            }}
          />
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff', opacity: 0.85, textAlign: 'center' }}>
            Inquadra il QR mostrato dal leader
          </p>
        </>
      )}
      <Button onClick={onClose} variant="ghost">
        Chiudi
      </Button>
    </div>
  );
}
