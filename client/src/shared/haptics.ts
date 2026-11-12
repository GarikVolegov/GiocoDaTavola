/**
 * Safe haptic feedback utilities using navigator.vibrate.
 * Gracefully no-ops on desktop / unsupported browsers.
 */

export function vibrateTick(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(30);
    } catch {
      // Ignore vibration error
    }
  }
}

export function vibrateWarning(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([60, 40, 60]);
    } catch {
      // Ignore vibration error
    }
  }
}

export function vibrateInfiltrator(): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([120, 60, 120, 60, 250]);
    } catch {
      // Ignore vibration error
    }
  }
}
