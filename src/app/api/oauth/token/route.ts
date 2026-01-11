/**
 * OAuth Token Endpoint
 * 
 * Exchanges authorization code for access token.
 * Auth code is a self-contained JWT (no DB lookup needed).
 */

import { NextResponse } from 'next/server';
import * as jose from 'jose';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET or SUPABASE_JWT_SECRET not configured');
  }
  return new TextEncoder().encode(secret);
}

export async function POST(request: Request) {
  try {
    const body = await parseBody(request);
    const { code, redirect_uri, client_id, code_verifier } = body;

    if (!code || !code_verifier) {
      return errorResponse('invalid_request', 'code and code_verifier required');
    }

    // Verify auth code JWT
    const secret = getJwtSecret();
    let payload: jose.JWTPayload;
    
    try {
      const result = await jose.jwtVerify(code, secret, {
        issuer: APP_URL,
        audience: 'mcp-oauth',
      });
      payload = result.payload;
    } catch {
      return errorResponse('invalid_grant', 'Invalid authorization code');
    }

    // Validate type
    if (payload.type !== 'auth_code') {
      return errorResponse('invalid_grant', 'Invalid token type');
    }

    // Validate PKCE
    if (!await validatePkce(code_verifier, payload.code_challenge as string)) {
      return errorResponse('invalid_grant', 'Invalid code_verifier');
    }

    // Validate client_id and redirect_uri match
    if (client_id && payload.client_id !== client_id) {
      return errorResponse('invalid_grant', 'client_id mismatch');
    }
    if (redirect_uri && payload.redirect_uri !== redirect_uri) {
      return errorResponse('invalid_grant', 'redirect_uri mismatch');
    }

    // Generate access token
    const accessToken = await new jose.SignJWT({
      user_id: payload.user_id,
      email: payload.email,
      role: payload.role,
      type: 'mcp',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub as string)
      .setExpirationTime('90d')
      .setIssuer(APP_URL)
      .setAudience('mcp-server')
      .sign(secret);

    return NextResponse.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 90 * 24 * 60 * 60,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });

  } catch (error) {
    console.error('Token endpoint error:', error);
    return errorResponse('server_error', 'Internal error');
  }
}

async function validatePkce(verifier: string, challenge: string): Promise<boolean> {
  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
  const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64url === challenge;
}

async function parseBody(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formData = await request.formData();
    return Object.fromEntries(formData) as Record<string, string>;
  }
  return request.json();
}

function errorResponse(error: string, description: string) {
  return NextResponse.json(
    { error, error_description: description },
    { status: 400, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
