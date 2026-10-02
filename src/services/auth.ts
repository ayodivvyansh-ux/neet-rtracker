import { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

let currentSession: Session | null = null;
let initAuthPromise: Promise<Session | null> | null = null;

/**
 * Initializes anonymous authentication silently on startup without any login UI.
 */
export async function initializeAnonymousSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (initAuthPromise) {
    return initAuthPromise;
  }

  initAuthPromise = (async () => {
    try {
      // 1. Check if a valid session already exists in storage
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('[Auth] Error checking existing session:', sessionError.message);
      }

      if (sessionData?.session) {
        currentSession = sessionData.session;
        console.info('[Supabase Auth Debug] Existing User ID:', currentSession.user.id);
        return currentSession;
      }

      // 2. Sign in anonymously if no active session
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
      if (anonError) {
        console.error(
          '[Auth] Anonymous sign-in failed. Please ensure "Allow anonymous sign-ins" is enabled in your Supabase Auth Settings.',
          anonError.message
        );
        throw new Error(
          `Supabase anonymous authentication failed: ${anonError.message}. Please enable Anonymous Sign-in in your Supabase project settings.`
        );
      }

      currentSession = anonData?.session || null;
      if (currentSession?.user) {
        console.info('[Supabase Auth Debug] New Anonymous User ID:', currentSession.user.id);
      }
      return currentSession;
    } catch (err) {
      console.error('[Auth] Failed to initialize anonymous session:', err);
      return null;
    }
  })();

  return initAuthPromise;
}

/**
 * Returns current authenticated user ID, or a stable local ID if running offline/unconfigured.
 */
export async function getCurrentUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    return 'local-user';
  }

  if (currentSession?.user?.id) {
    return currentSession.user.id;
  }

  const session = await initializeAnonymousSession();
  if (session?.user?.id) {
    return session.user.id;
  }

  // Fallback to user check
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || 'local-user';
}

/**
 * Returns the current active session object if available.
 */
export function getCurrentSession(): Session | null {
  return currentSession;
}
