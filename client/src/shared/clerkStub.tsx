import type { ReactNode } from 'react';

// Inert stand-in for @clerk/react, aliased in by vite.config when no Clerk
// publishable key is set (keyless local boot / keyless build). Accounts are simply
// disabled: the app renders fully in its signed-out state instead of crashing on a
// missing key. When a real key IS provided, the real @clerk/react is used instead.

type ShowProps = { when?: 'signed-in' | 'signed-out'; children?: ReactNode };
export function Show({ when, children }: ShowProps) {
  // Keyless = always signed out.
  return when === 'signed-out' ? <>{children}</> : null;
}

export function SignInButton({ children }: { mode?: string; children?: ReactNode }) {
  // Render the trigger so layout stays intact; it just can't open a real modal.
  return <>{children ?? null}</>;
}

export function UserButton() {
  return null;
}

export function ClerkProvider({
  children,
}: {
  children?: ReactNode;
  publishableKey?: string;
  afterSignOutUrl?: string;
}) {
  return <>{children}</>;
}

export function useAuth() {
  return {
    isLoaded: true,
    isSignedIn: false,
    userId: null as string | null,
    getToken: async (): Promise<string | null> => null,
  };
}

export function useUser() {
  return { isLoaded: true, isSignedIn: false, user: null };
}

export function useClerk() {
  return {
    signOut: async (_opts?: { redirectUrl?: string }): Promise<void> => {},
    openSignIn: (): void => {},
    openUserProfile: (): void => {},
  };
}
