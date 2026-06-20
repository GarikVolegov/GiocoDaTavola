import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

type CardProps = HTMLAttributes<HTMLDivElement> & { glow?: 'a' | 'b' | 'accent' };

const glowClass = { a: 'glowA', b: 'glowB', accent: 'glowAccent' } as const;

export function Card({ glow, className, ...rest }: CardProps) {
  const cls = [styles.card, glow && styles[glowClass[glow]], className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}
