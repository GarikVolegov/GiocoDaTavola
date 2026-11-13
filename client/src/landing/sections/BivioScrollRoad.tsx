import { useEffect, useState } from 'react';
import styles from '../Landing.module.css';

interface BoltBranch {
  id: string;
  d: string;
  threshold: number;
  side: 'a' | 'b';
  width: number;
  spark?: { cx: number; cy: number };
}

// Main jagged lightning trunks running strictly in the outer left/right gutters
// (x <= 85 on left, x >= 1355 on right in a 1440px viewBox) so they never touch content cards.
const MAIN_BOLT_A =
  'M 54 0 L 42 78 L 64 148 L 36 232 L 62 315 L 34 410 L 58 498 L 30 592 L 60 685 L 38 780 L 66 875 L 34 975 L 60 1070 L 36 1165 L 62 1265 L 40 1370 L 58 1475 L 44 1590';

const MAIN_BOLT_B =
  'M 1386 0 L 1398 78 L 1376 148 L 1404 232 L 1378 315 L 1406 410 L 1382 498 L 1410 592 L 1380 685 L 1402 780 L 1374 875 L 1406 975 L 1380 1070 L 1404 1165 L 1378 1265 L 1400 1370 L 1382 1475 L 1396 1590';

// Realistic secondary & tertiary branching forks that ignite as you scroll
const BRANCHES: BoltBranch[] = [
  // Left (Blue A) branches
  { id: 'a1', side: 'a', threshold: 0.08, width: 1.8, d: 'M 64 148 L 82 192 L 74 238 L 88 274', spark: { cx: 64, cy: 148 } },
  { id: 'a2', side: 'a', threshold: 0.14, width: 1.4, d: 'M 36 232 L 18 278 L 28 320 L 12 356' },
  { id: 'a3', side: 'a', threshold: 0.25, width: 1.8, d: 'M 58 498 L 84 548 L 72 595 L 90 638', spark: { cx: 58, cy: 498 } },
  { id: 'a4', side: 'a', threshold: 0.34, width: 1.3, d: 'M 30 592 L 14 635 L 24 676' },
  { id: 'a5', side: 'a', threshold: 0.48, width: 1.9, d: 'M 66 875 L 92 925 L 78 972 L 96 1018', spark: { cx: 66, cy: 875 } },
  { id: 'a6', side: 'a', threshold: 0.62, width: 1.5, d: 'M 34 975 L 16 1028 L 28 1072 L 14 1110' },
  { id: 'a7', side: 'a', threshold: 0.76, width: 1.8, d: 'M 62 1265 L 88 1318 L 76 1368 L 94 1412', spark: { cx: 62, cy: 1265 } },

  // Right (Orange B) branches
  { id: 'b1', side: 'b', threshold: 0.08, width: 1.8, d: 'M 1376 148 L 1358 192 L 1366 238 L 1352 274', spark: { cx: 1376, cy: 148 } },
  { id: 'b2', side: 'b', threshold: 0.14, width: 1.4, d: 'M 1404 232 L 1422 278 L 1412 320 L 1428 356' },
  { id: 'b3', side: 'b', threshold: 0.25, width: 1.8, d: 'M 1382 498 L 1356 548 L 1368 595 L 1350 638', spark: { cx: 1382, cy: 498 } },
  { id: 'b4', side: 'b', threshold: 0.34, width: 1.3, d: 'M 1410 592 L 1426 635 L 1416 676' },
  { id: 'b5', side: 'b', threshold: 0.48, width: 1.9, d: 'M 1374 875 L 1348 925 L 1362 972 L 1344 1018', spark: { cx: 1374, cy: 875 } },
  { id: 'b6', side: 'b', threshold: 0.62, width: 1.5, d: 'M 1406 975 L 1424 1028 L 1412 1072 L 1426 1110' },
  { id: 'b7', side: 'b', threshold: 0.76, width: 1.8, d: 'M 1378 1265 L 1352 1318 L 1364 1368 L 1346 1412', spark: { cx: 1378, cy: 1265 } },
];

/**
 * Scroll-driven branching lightning layer: realistic dual-faction electric arcs
 * (Sapphire Blue A on the left, Solar Amber B on the right) with plasma glow,
 * white-hot cores, and flickering secondary branches that propagate on scroll.
 */
export default function BivioScrollRoad() {
  const [progress, setProgress] = useState(0.14);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setProgress(1);
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
      const raw = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      setProgress(Math.min(1, 0.14 + raw * 0.92));
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  const dashOffset = Math.max(0, 1 - progress);

  return (
    <div className={styles.scrollRoadLayer} aria-hidden="true">
      <svg
        className={styles.scrollRoadSvg}
        viewBox="0 0 1440 1600"
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="lightningAuraA" x="-60%" y="-20%" width="220%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="lightningAuraB" x="-60%" y="-20%" width="220%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur1" />
            <feGaussianBlur stdDeviation="12" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Faint ionized guide paths */}
        <path d={MAIN_BOLT_A} fill="none" stroke="rgba(62, 130, 252, 0.12)" strokeWidth="2" />
        <path d={MAIN_BOLT_B} fill="none" stroke="rgba(245, 108, 56, 0.12)" strokeWidth="2" />

        {/* Main Bolt A: outer plasma + white-hot core */}
        <g className={styles.lightningBoltA} filter="url(#lightningAuraA)">
          <path
            d={MAIN_BOLT_A}
            fill="none"
            stroke="#3E82FC"
            strokeWidth="4.5"
            strokeLinejoin="miter"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={dashOffset}
          />
          <path
            d={MAIN_BOLT_A}
            fill="none"
            stroke="#EBF4FF"
            strokeWidth="1.6"
            strokeLinejoin="miter"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={dashOffset}
          />
        </g>

        {/* Main Bolt B: outer plasma + white-hot core */}
        <g className={styles.lightningBoltB} filter="url(#lightningAuraB)">
          <path
            d={MAIN_BOLT_B}
            fill="none"
            stroke="#F56C38"
            strokeWidth="4.5"
            strokeLinejoin="miter"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={dashOffset}
          />
          <path
            d={MAIN_BOLT_B}
            fill="none"
            stroke="#FFF2EB"
            strokeWidth="1.6"
            strokeLinejoin="miter"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={dashOffset}
          />
        </g>

        {/* Branching forks + electric junction sparks */}
        {BRANCHES.map((b, i) => {
          const active = progress >= b.threshold;
          const color = b.side === 'a' ? '#3E82FC' : '#F56C38';
          const core = b.side === 'a' ? '#EBF4FF' : '#FFF2EB';
          return (
            <g
              key={b.id}
              className={i % 2 === 0 ? styles.branchFlickerFast : styles.branchFlickerSlow}
              style={{ opacity: active ? 0.95 : 0 }}
            >
              <path
                d={b.d}
                fill="none"
                stroke={color}
                strokeWidth={b.width * 2}
                strokeLinecap="round"
                opacity="0.7"
              />
              <path
                d={b.d}
                fill="none"
                stroke={core}
                strokeWidth={b.width * 0.75}
                strokeLinecap="round"
              />
              {b.spark && active && (
                <>
                  <circle cx={b.spark.cx} cy={b.spark.cy} r="7" fill={color} opacity="0.35" />
                  <circle cx={b.spark.cx} cy={b.spark.cy} r="2.8" fill="#ffffff" />
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
