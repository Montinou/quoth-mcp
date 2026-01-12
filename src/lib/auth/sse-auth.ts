/**
 * SSE-specific Authentication Middleware
 * Supports both query param and header-based JWT authentication
 * 
 * EventSource API cannot set custom headers, so SSE connections
 * must support token extraction from query parameters.
 */

import { jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';
import type { AuthContext } from './mcp-auth';

/**
 * Extracts JWT token from request
 * Priority: 1. Query param (?token=xxx), 2. Authorization header
 */
function extractToken(req: NextRequest): string | null {
  // 1. Check query param first (for SSE/EventSource compatibility)
  const url = new URL(req.url);
  const queryToken = url.searchParams.get('token');
  if (queryToken) {
    return queryToken;
  }

  // 2. Fall back to Authorization header
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
}

/**
 * Verifies JWT token and returns auth context
 * Handles both MCP API keys and OAuth tokens
 */
export async function verifySseToken(req: NextRequest): Promise<AuthContext | null> {
  const token = extractToken(req);
  
  if (!token) {
    return null;
  }

  // Try JWT_SECRET first, fall back to SUPABASE_JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET or SUPABASE_JWT_SECRET is not configured');
    return null;
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site',
      audience: 'mcp-server',
    });

    // Handle OAuth tokens (type: 'mcp')
    if (payload.type === 'mcp') {
      return {
        project_id: payload.sub as string,
        user_id: payload.user_id as string,
        role: (payload.role as 'admin' | 'editor' | 'viewer') || 'viewer',
        label: payload.email as string | undefined,
      };
    }

    // Handle regular MCP API keys
    const authContext: AuthContext = {
      project_id: payload.sub as string,
      user_id: payload.user_id as string,
      role: payload.role as 'admin' | 'editor' | 'viewer',
      label: payload.label as string | undefined,
    };

    // Validate required fields
    if (!authContext.project_id || !authContext.user_id || !authContext.role) {
      console.error('Invalid token payload: missing required fields');
      return null;
    }

    // Validate role
    if (!['admin', 'editor', 'viewer'].includes(authContext.role)) {
      console.error('Invalid token payload: invalid role');
      return null;
    }

    return authContext;
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('SSE JWT verification failed:', err.message);
    return null;
  }
}

/**
 * Creates an error response for SSE authentication failures
 */
export function createSseAuthErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      error: 'Authentication failed',
      message,
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
