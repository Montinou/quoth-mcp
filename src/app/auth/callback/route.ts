/**
 * Auth Callback Route
 * Handles email confirmation and OAuth callbacks from Supabase
 *
 * Supports two flows:
 * 1. PKCE/OAuth: code parameter → exchangeCodeForSession
 * 2. Email verification: token_hash + type → verifyOtp
 */

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/dashboard';

  const supabase = await createServerSupabaseClient();

  // Flow 1: PKCE/OAuth code exchange
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[Auth Callback] Code exchange failed:', error);
  }

  // Flow 2: Email verification via token_hash
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      // Email verified successfully - redirect to dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[Auth Callback] OTP verification failed:', error);
  }

  // Auth failed - redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_error`);
}
