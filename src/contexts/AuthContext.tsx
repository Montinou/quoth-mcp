/**
 * Authentication Context
 * Manages user authentication state, session, and profile
 * Uses Supabase Auth with cookie-based sessions
 */

'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

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
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Initialize auth state
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Session initialized:', {
          hasSession: !!session,
          hasUser: !!session?.user
        });
      }

      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes (with cleanup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AuthContext] Auth state changed:', {
            event,
            hasSession: !!session,
            hasUser: !!session?.user
          });
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    // CRITICAL: Cleanup subscription
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Refresh session when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AuthContext] Window focused, refreshing session');
      }
      supabase.auth.getSession();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [supabase]);

  async function fetchProfile(userId: string) {
    try {
      setProfileError(null);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Profile fetch error:', error);
        setProfileError(error.message);
        // Don't set profile to null - keep existing if any
        return;
      }

      if (data) {
        setProfile(data as Profile);

        if (process.env.NODE_ENV === 'development') {
          console.log('[AuthContext] Profile loaded:', {
            username: data.username,
            email: data.email,
            has_default_project: !!data.default_project_id
          });
        }
      }
    } catch (err) {
      console.error('[AuthContext] Profile fetch exception:', err);
      setProfileError('Failed to load profile');
    }
  }

  async function signUp(email: string, password: string, username: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    return { error: error as Error | null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  }

  async function signOut() {
    await supabase.auth.signOut();
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
