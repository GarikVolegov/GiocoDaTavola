import { presetEmoji } from '../avatars';
import styles from './Avatar.module.css';

type AvatarProps = {
  /** A custom avatar: `preset:<id>` or a raster data-URL. Wins over imageUrl. */
  avatar?: string | null;
  /** Fallback image (e.g. Clerk's user.imageUrl) when no custom avatar is set. */
  imageUrl?: string | null;
  /** Used for the initial fallback when there's no image at all. */
  name?: string | null;
  /** Pixel size of the (square) disc. */
  size?: number;
  /** When provided the avatar renders as a button (clickable). */
  onClick?: () => void;
  ariaLabel?: string;
  className?: string;
};

/** Round avatar: preset emoji, uploaded/Clerk image, or a name initial. */
export function Avatar({ avatar, imageUrl, name, size = 40, onClick, ariaLabel, className }: AvatarProps) {
  const preset = avatar?.startsWith('preset:') ? presetEmoji(avatar.slice('preset:'.length)) : null;
  const imgSrc = avatar?.startsWith('data:') ? avatar : !avatar ? imageUrl ?? null : null;
  const initial = (name?.trim().charAt(0) || '?').toUpperCase();

  const inner = preset ? (
    <span className={styles.emoji} style={{ fontSize: size * 0.55 }}>
      {preset}
    </span>
  ) : imgSrc ? (
    <img className={styles.img} src={imgSrc} alt="" />
  ) : (
    <span className={styles.initial} style={{ fontSize: size * 0.42 }}>
      {initial}
    </span>
  );

  const style = { width: size, height: size };
  const cls = [styles.avatar, className].filter(Boolean).join(' ');

  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} aria-label={ariaLabel}>
        {inner}
      </button>
    );
  }
  return (
    <span className={cls} style={style} role="img" aria-label={ariaLabel}>
      {inner}
    </span>
  );
}
