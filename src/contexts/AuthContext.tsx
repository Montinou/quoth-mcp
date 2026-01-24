/**
 * Authentication Context
 * Manages user authentication state, session, and profile
 * Uses Supabase Auth with cookie-based sessions
 *
 * Session refresh is handled by middleware - this context only tracks state
 * Visibility-based re-validation syncs client state with server cookies
 */

'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

// Debug flag - set to false in production
const DEBUG_AUTH = process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]) {
  if (DEBUG_AUTH) {
    console.log(...args);
  }
}

// LocalStorage key for caching profile
const PROFILE_CACHE_KEY = 'quoth_profile_cache';

// Helper to read cached profile from localStorage
function getCachedProfile(): Profile | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Validate basic structure
      if (parsed && parsed.id && parsed.email) {
        return parsed as Profile;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

// Helper to cache profile to localStorage
function setCachedProfile(profile: Profile | null) {
  if (typeof window === 'undefined') return;
  try {
    if (profile) {
      localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

interface Profile {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  default_project_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  profileLoading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Initialize from cache to avoid flicker on navigation
  // Use lazy initialization to avoid unnecessary localStorage reads on every render
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => getCachedProfile());
  const [session, setSession] = useState<Session | null>(null);
  // If we have a cached profile, don't show loading state (profile will show instantly)
  const [loading, setLoading] = useState(() => !getCachedProfile());
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastVisibilityCheckRef = useRef<number>(0);

  // Refs to access current state without triggering re-renders
  const userRef = useRef<User | null>(null);
  // Also initialize profileRef from cache
  const profileRef = useRef<Profile | null>(getCachedProfile());
  const profileLoadingRef = useRef(false);
  const profileErrorRef = useRef<string | null>(null);
  const profileRetryCountRef = useRef(0);
  const isRevalidatingRef = useRef(false);

  // Re-validate session with server (uses getUser() which validates JWT)
  // This syncs client state with server-side cookie updates from middleware
  const revalidateSession = useCallback(async () => {
    // Throttle: only check once per 5 seconds
    const now = Date.now();
    if (now - lastVisibilityCheckRef.current < 5000) {
      return;
    }
    lastVisibilityCheckRef.current = now;

    // Deduplicate: if already revalidating, skip
    if (isRevalidatingRef.current) {
      debugLog('[AuthContext] Revalidation already in progress, skipping');
      return;
    }
    isRevalidatingRef.current = true;

    try {
      const { data: { user: serverUser }, error } = await supabase.auth.getUser();

      // Ignore AbortError - it's expected during React StrictMode remounts
      if (error) {
        if (error.message?.includes('AbortError') || error.name === 'AbortError') {
          isRevalidatingRef.current = false;
          return;
        }
      }

      if (error) {
        // Only clear state for definitive auth errors, NOT temporary failures
        const isDefinitiveAuthError = error.message?.includes('session') ||
          error.message?.includes('token') ||
          error.message?.includes('expired') ||
          error.message?.includes('invalid') ||
          error.status === 401 ||
          error.status === 403;

        if (isDefinitiveAuthError && userRef.current) {
          debugLog('[AuthContext] Definitive session error, clearing state:', error.message);
          setUser(null);
          userRef.current = null;
          setProfile(null);
          profileRef.current = null;
          setCachedProfile(null); // Clear localStorage cache
          setSession(null);
          setProfileLoading(false);
          profileLoadingRef.current = false;
          setProfileError(null);
          profileErrorRef.current = null;
        } else {
          debugLog('[AuthContext] Temporary revalidation error, keeping state:', error.message);
        }
        isRevalidatingRef.current = false;
        return;
      }

      if (!serverUser) {
        // No user returned but no error - might be race condition, don't clear immediately
        debugLog('[AuthContext] No user returned during revalidation, will retry');
        isRevalidatingRef.current = false;
        return;
      }

      // Session is valid - update if user changed or was null (use ref for comparison)
      const currentUser = userRef.current;
      if (!currentUser || currentUser.id !== serverUser.id) {
        debugLog('[AuthContext] Syncing user state from server');
        setUser(serverUser);
        userRef.current = serverUser;
        // Fetch fresh session and profile
        const { data: { session: freshSession } } = await supabase.auth.getSession();
        setSession(freshSession);
        if (serverUser.id) {
          // Create new controller only if we're about to fetch
          const controller = new AbortController();
          abortControllerRef.current = controller;
          await fetchProfile(serverUser.id, controller.signal);
        }
      } else if (!profileRef.current && currentUser && !profileLoadingRef.current && !profileErrorRef.current) {
        // Profile missing - retry with exponential backoff
        const retryCount = profileRetryCountRef.current;
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s

        debugLog('[AuthContext] Profile missing, retrying fetch (attempt', retryCount + 1, ') after', backoffDelay, 'ms');

        await new Promise(resolve => setTimeout(resolve, backoffDelay));

        profileRetryCountRef.current += 1;
        const controller = new AbortController();
        abortControllerRef.current = controller;
        await fetchProfile(currentUser.id, controller.signal);
      }

      isRevalidatingRef.current = false;
    } catch (err) {
      // Ignore AbortError - it's expected during React StrictMode unmount/remount
      const isAbortError = err instanceof Error && (
        err.name === 'AbortError' ||
        err.message?.includes('abort') ||
        err.message?.includes('signal')
      );
      if (isAbortError) {
        isRevalidatingRef.current = false;
        return;
      }
      console.error('[AuthContext] Session revalidation error:', err);
      // On unexpected error, clear state to prevent stuck UI
      // User will need to re-authenticate
      setUser(null);
      userRef.current = null;
      setProfile(null);
      profileRef.current = null;
      setCachedProfile(null); // Clear localStorage cache
      setSession(null);
      setProfileLoading(false);
      profileLoadingRef.current = false;
      isRevalidatingRef.current = false;
    }
  }, [supabase]); // ✅ ONLY depends on supabase (stable)

  useEffect(() => {
    let mounted = true;

    // Initialize auth state - optimized for fast anonymous experience
    const initAuth = async () => {
      try {
        // Step 1: Quick local check (no network request)
        // getSession() reads from cookies/storage - instant
        const { data: { session: localSession } } = await supabase.auth.getSession();

        if (!mounted) return;

        // No local session = definitely not logged in, done instantly
        if (!localSession) {
          setLoading(false);
          return;
        }

        // Step 2: We have a local session, validate it with server
        // This also handles token refresh automatically
        const { data: { user }, error } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error) {
          // Only sign out for definitive auth errors
          const isDefinitiveAuthError = error.message?.includes('session') ||
            error.message?.includes('token') ||
            error.message?.includes('expired') ||
            error.message?.includes('invalid') ||
            error.status === 401 ||
            error.status === 403;

          if (isDefinitiveAuthError) {
            debugLog('[AuthContext] Definitive auth error on init, signing out:', error.message);
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              console.warn('[AuthContext] signOut failed:', signOutErr);
            }
          } else {
            // For temporary errors, try to use local session anyway
            debugLog('[AuthContext] Temporary auth error on init, using local session:', error.message);
            // Use the user from local session if available
            if (localSession?.user) {
              setUser(localSession.user);
              userRef.current = localSession.user;
              setSession(localSession);
              // Try to fetch profile anyway
              abortControllerRef.current = new AbortController();
              await fetchProfile(localSession.user.id, abortControllerRef.current.signal);
            }
          }
          setLoading(false);
          return;
        }

        if (!user) {
          // No user and no error - session might be invalid
          debugLog('[AuthContext] No user returned on init');
          setLoading(false);
          return;
        }

        // Valid session - set user and fetch profile
        setUser(user);
        userRef.current = user;
        setSession(localSession);

        // Create abort controller for initial fetch
        abortControllerRef.current = new AbortController();
        await fetchProfile(user.id, abortControllerRef.current.signal);

        if (mounted) {
          setLoading(false);
        }
      } catch (err) {
        // Ignore AbortError - it's expected during unmount (React 18 strict mode)
        const isAbortError = err instanceof Error && (
          err.name === 'AbortError' ||
          err.message?.includes('abort') ||
          err.message?.includes('signal')
        );
        if (isAbortError) {
          return;
        }
        console.error('[AuthContext] Auth init error:', err);
        // On error, assume no session and continue
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        // Abort any in-flight profile fetch (safely)
        try {
          abortControllerRef.current?.abort();
        } catch {
          // Ignore abort errors
        }

        setSession(session);
        setUser(session?.user ?? null);
        userRef.current = session?.user ?? null;

        if (session?.user) {
          // Create new abort controller for this fetch
          const controller = new AbortController();
          abortControllerRef.current = controller;
          try {
            await fetchProfile(session.user.id, controller.signal);
          } catch (err) {
            // Ignore AbortError - expected when auth state changes rapidly
            const isAbortError = err instanceof Error && (
              err.name === 'AbortError' ||
              err.message?.includes('abort') ||
              err.message?.includes('signal')
            );
            if (isAbortError) {
              return;
            }
            console.error('[AuthContext] Profile fetch error in onAuthStateChange:', err);
          }
        } else {
          setProfile(null);
          profileRef.current = null;
          setCachedProfile(null); // Clear localStorage cache on logout
          setProfileLoading(false);
          profileLoadingRef.current = false;
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // Abort any in-flight requests on cleanup (safely)
      try {
        abortControllerRef.current?.abort();
      } catch {
        // Ignore abort errors during cleanup
      }
      abortControllerRef.current = null;
    };
  }, [supabase]);

  // Visibility-based re-validation: sync with server when tab regains focus
  // This catches cases where middleware refreshed tokens while tab was hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        revalidateSession();
      }
    };

    // Also revalidate on window focus (covers more browser scenarios)
    const handleFocus = () => {
      revalidateSession();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [revalidateSession]);

  async function fetchProfile(userId: string, abortSignal?: AbortSignal) {
    try {
      setProfileLoading(true);
      profileLoadingRef.current = true;
      setProfileError(null);
      profileErrorRef.current = null;

      // Check if aborted before fetching
      if (abortSignal?.aborted) return;

      // Verify session is still valid with SERVER (not local cookies)
      // getUser() validates JWT with Supabase Auth server
      const { data: { user: validatedUser }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        // Only clear state for definitive auth errors, NOT temporary failures
        // Errors like "session_not_found" or "invalid_token" are definitive
        const isDefinitiveAuthError = authError.message?.includes('session') ||
          authError.message?.includes('token') ||
          authError.message?.includes('expired') ||
          authError.message?.includes('invalid') ||
          authError.status === 401 ||
          authError.status === 403;

        if (isDefinitiveAuthError) {
          debugLog('[AuthContext] Definitive auth error, clearing state:', authError.message);
          setUser(null);
          userRef.current = null;
          setSession(null);
          setProfile(null);
          profileRef.current = null;
          setCachedProfile(null); // Clear localStorage cache
        } else {
          // For temporary errors (network issues, etc), just log and don't clear state
          // The profile might load on next retry
          debugLog('[AuthContext] Temporary auth error, keeping state:', authError.message);
        }
        return;
      }

      if (!validatedUser || validatedUser.id !== userId) {
        debugLog('[AuthContext] User mismatch or missing, aborting profile fetch');
        return;
      }

      if (abortSignal?.aborted) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Check if aborted after fetching
      if (abortSignal?.aborted) return;

      if (error) {
        console.error('[AuthContext] Profile fetch error:', error);
        setProfileError(error.message);
        profileErrorRef.current = error.message;
        return;
      }

      if (data) {
        const profileData = data as Profile;
        setProfile(profileData);
        profileRef.current = profileData;
        setCachedProfile(profileData); // ✅ Cache to localStorage
        profileRetryCountRef.current = 0; // ✅ Reset retry count on success
      }
    } catch (err) {
      // Ignore AbortError - it's expected when auth state changes
      // Check multiple conditions since AbortError can manifest differently
      const isAbortError = err instanceof Error && (
        err.name === 'AbortError' ||
        err.message?.includes('abort') ||
        err.message?.includes('signal')
      );
      if (isAbortError || abortSignal?.aborted) {
        return;
      }
      // For network errors, DON'T clear auth state - just log and let retry handle it
      console.error('[AuthContext] Failed to load profile (will retry):', err);
      setProfileError('Failed to load profile');
      profileErrorRef.current = 'Failed to load profile';
    } finally {
      if (!abortSignal?.aborted) {
        setProfileLoading(false);
        profileLoadingRef.current = false;
      }
    }
  }

  async function signUp(email: string, password: string, username: string) {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
          // Full URL where user should land after callback verification
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('[AuthContext] SignUp error:', error);
        return { error };
      }
      
      return { error: null };
    } catch (err) {
       console.error('[AuthContext] Unexpected SignUp error:', err);
       return { error: err as Error };
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
         console.error('[AuthContext] Main signIn error:', error);
      }
      return { error: error as Error | null };
    } catch (err) {
      return { error: err as Error };
    }
  }

  async function signOut() {
    try {
      // Abort any in-flight profile fetch
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      await supabase.auth.signOut();
      setUser(null);
      userRef.current = null;
      setProfile(null);
      profileRef.current = null;
      setCachedProfile(null); // ✅ Clear localStorage cache
      setSession(null);
      setProfileLoading(false);
      profileLoadingRef.current = false;
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  const value = {
    user,
    profile,
    session,
    loading,
    profileLoading,
    profileError,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
