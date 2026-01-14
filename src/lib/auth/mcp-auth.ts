/**
 * MCP Authentication Middleware
 * Supports both Supabase OAuth tokens and manual API keys
 */

import { createMcpHandler } from 'mcp-handler';
import { jwtVerify, decodeJwt } from 'jose';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Authentication context passed to MCP tools
 * Contains user and project information extracted from JWT
 */
export interface AuthContext {
  project_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
  label?: string; // Optional token label for logging
}

/**
 * Verify a Supabase OAuth token
 * Claims are in app_metadata (injected by Custom Access Token Hook)
 */
async function verifySupabaseToken(token: string): Promise<AuthContext | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Supabase configuration missing');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    // Extract claims injected by Custom Access Token Hook
    const projectId = user.app_metadata?.project_id;
    const role = user.app_metadata?.mcp_role;

    if (!projectId) {
      console.warn('Supabase token missing project_id in app_metadata');
      return null;
    }

    return {
      project_id: projectId,
      user_id: user.id,
      role: (role as 'admin' | 'editor' | 'viewer') || 'viewer',
      label: user.email,
    };
  } catch (error) {
    console.error('Supabase token verification failed:', error);
    return null;
  }
}

/**
 * Verify a custom JWT token (manual API keys)
 */
async function verifyCustomJwt(token: string): Promise<AuthContext | null> {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      issuer: process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site',
      audience: 'mcp-server',
    });

    const authContext: AuthContext = {
      project_id: payload.sub as string,
      user_id: payload.user_id as string,
      role: (payload.role as 'admin' | 'editor' | 'viewer') || 'viewer',
      label: (payload.label as string) || (payload.email as string),
    };

    if (!authContext.project_id || !authContext.user_id) {
      return null;
    }

    if (!['admin', 'editor', 'viewer'].includes(authContext.role)) {
      return null;
    }

    return authContext;
  } catch {
    return null;
  }
}

/**
 * Verify an MCP token (supports both Supabase OAuth and custom JWT)
 * Returns AuthContext if valid, null otherwise
 */
export async function verifyMcpApiKey(token: string): Promise<AuthContext | null> {
  // Try to determine token type by decoding without verification
  try {
    const decoded = decodeJwt(token);

    // Check if it's a custom JWT (has our specific issuer/audience)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site';
    if (decoded.iss === appUrl && decoded.aud === 'mcp-server') {
      return verifyCustomJwt(token);
    }

    // Check if it's a Supabase token (issuer matches Supabase URL pattern)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && decoded.iss?.includes('supabase')) {
      return verifySupabaseToken(token);
    }
  } catch {
    // Token couldn't be decoded, try both methods
  }

  // Try custom JWT first (faster, no network call)
  const customAuth = await verifyCustomJwt(token);
  if (customAuth) {
    return customAuth;
  }

  // Fall back to Supabase verification
  return verifySupabaseToken(token);
}

/**
 * Creates an authenticated MCP handler
 * Extracts and verifies JWT token before allowing access to MCP tools
 */
export function createAuthenticatedMcpHandler(
  setupFn: (server: McpServer, authContext: AuthContext) => void,
  options?: Record<string, unknown>
) {
  return async (req: NextRequest) => {
    try {
      // 1. Extract Authorization header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({
            error: 'Missing or invalid Authorization header',
            message: 'Please provide a valid Bearer token',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // 2. Verify token (supports both Supabase OAuth and custom JWT)
      const authContext = await verifyMcpApiKey(token);

      if (!authContext) {
        return new Response(
          JSON.stringify({
            error: 'Authentication failed',
            message: 'Invalid or expired token. Please re-authenticate.',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // 3. Create MCP handler with authenticated context
      const handler = createMcpHandler(
        (server) => setupFn(server, authContext),
        {},
        options
      );

      // 4. Call the handler with the request
      return handler(req);
    } catch (error) {
      console.error('MCP auth middleware error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: 'An unexpected error occurred',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}
