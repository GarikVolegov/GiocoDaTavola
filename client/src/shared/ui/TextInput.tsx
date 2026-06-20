import type { InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { mono?: boolean };

export function TextInput({ mono, className, ...rest }: TextInputProps) {
  const cls = [styles.input, mono && styles.mono, className].filter(Boolean).join(' ');
  return <input className={cls} {...rest} />;
}
