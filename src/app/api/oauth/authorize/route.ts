/**
 * OAuth Authorization Endpoint
 * 
 * GET: Stores request in cookie, redirects to login if needed
 * POST: Called after login to generate auth code
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import * as jose from 'jose';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET or SUPABASE_JWT_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

interface AuthRequest {
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  state?: string;
}

interface UserContext {
  user_id: string;
  project_id: string;
  role: string;
  email?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  
  // Extract OAuth params
  const clientId = url.searchParams.get('client_id');
  const redirectUri = url.searchParams.get('redirect_uri');
  const codeChallenge = url.searchParams.get('code_challenge');
  const state = url.searchParams.get('state');
  const responseType = url.searchParams.get('response_type');

  // Validate required params
  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 });
  }

  // Store request in cookie
  const authRequest: AuthRequest = { 
    client_id: clientId, 
    redirect_uri: redirectUri, 
    code_challenge: codeChallenge,
    state: state || undefined,
  };
  
  const cookieStore = await cookies();
  cookieStore.set('mcp_oauth_request', JSON.stringify(authRequest), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  // Check if already logged in
  const context = await getSessionContext();
  if (context) {
    return generateAuthCode(authRequest, context);
  }

  // Redirect to login
  return NextResponse.redirect(new URL('/auth/mcp-login?oauth=1', APP_URL));
}

// POST: Called after login to generate code
export async function POST() {
  try {
    const cookieStore = await cookies();
    const authRequestCookie = cookieStore.get('mcp_oauth_request')?.value;
    
    if (!authRequestCookie) {
      return NextResponse.json({ error: 'invalid_request', message: 'No OAuth request found' }, { status: 400 });
    }

    const authRequest: AuthRequest = JSON.parse(authRequestCookie);
    const context = await getSessionContext();
    
    if (!context) {
      return NextResponse.json({ error: 'access_denied' }, { status: 401 });
    }

    return generateAuthCode(authRequest, context);
  } catch (error) {
    console.error('OAuth authorize POST error:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}

async function getSessionContext(): Promise<UserContext | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  // Get user's default project
  const { data: profile } = await supabase
    .from('profiles')
    .select('default_project_id')
    .eq('id', user.id)
    .single();

  const projectId = profile?.default_project_id || `${user.email?.split('@')[0]}-knowledge-base`;

  // Get user's role
  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', user.id)
    .single();

  // Auto-create missing membership if user owns this project
  let userRole = membership?.role;
  if (!membership && profile?.default_project_id) {
    console.log(`[OAuth] Creating missing membership for user ${user.id} in project ${projectId}`);

    // Create membership as admin (user owns their default project)
    const { data: newMembership, error: membershipError } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: user.id,
        role: 'admin'
      })
      .select('role')
      .single();

    if (membershipError) {
      console.error('[OAuth] Failed to create membership:', membershipError);
      // Fall back to viewer if creation fails
      userRole = 'viewer';
    } else {
      userRole = newMembership?.role || 'admin';
      console.log(`[OAuth] Successfully created admin membership for user ${user.id}`);
    }
  } else if (!membership) {
    // No membership and no default project - default to viewer
    userRole = 'viewer';
  }

  return {
    user_id: user.id,
    project_id: projectId,
    role: userRole,
    email: user.email,
  };
}

async function generateAuthCode(authRequest: AuthRequest, context: UserContext) {
  const secret = getJwtSecret();
  
  // Auth code is a signed JWT containing all data (self-contained, no DB needed)
  const code = await new jose.SignJWT({
    sub: context.project_id,
    user_id: context.user_id,
    email: context.email,
    role: context.role,
    client_id: authRequest.client_id,
    redirect_uri: authRequest.redirect_uri,
    code_challenge: authRequest.code_challenge,
    type: 'auth_code',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('5m')
    .setIssuer(APP_URL)
    .setAudience('mcp-oauth')
    .sign(secret);

  // Clear the cookie
  const cookieStore = await cookies();
  cookieStore.delete('mcp_oauth_request');

  // Redirect back to client with code
  const redirectUrl = new URL(authRequest.redirect_uri);
  redirectUrl.searchParams.set('code', code);
  if (authRequest.state) {
    redirectUrl.searchParams.set('state', authRequest.state);
  }

  return NextResponse.redirect(redirectUrl.toString());
}
