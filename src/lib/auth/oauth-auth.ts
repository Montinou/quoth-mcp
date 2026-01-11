/**
 * OAuth Token Verification for MCP
 * 
 * Verifies Supabase JWT tokens for MCP authentication.
 * Works with mcp-handler's withMcpAuth wrapper.
 */

import { createClient } from '@supabase/supabase-js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Verify a Supabase JWT token and return AuthInfo
 * Compatible with mcp-handler's withMcpAuth verifyToken signature
 */
export async function verifySupabaseToken(
  req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }

  try {
    // Verify the JWT with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(bearerToken);

    if (error || !user) {
      console.error('Supabase token verification failed:', error?.message);
      return undefined;
    }

    // Extract project info from user metadata or token claims
    // The token should have project_id in app_metadata (set during login/signup)
    const projectId = (user.app_metadata?.project_id as string) || 
                      (user.user_metadata?.default_project_id as string);
    
    // Build scopes based on user role
    const role = (user.app_metadata?.role as string) || 'viewer';
    const scopes = buildScopes(role);

    const authInfo: AuthInfo = {
      token: bearerToken,
      clientId: user.id,
      scopes,
      // Include custom claims for MCP tools
      extra: {
        user_id: user.id,
        email: user.email,
        project_id: projectId,
        role: role,
      },
    };

    return authInfo;
  } catch (error) {
    console.error('Unexpected error verifying Supabase token:', error);
    return undefined;
  }
}

/**
 * Build OAuth scopes based on user role
 */
function buildScopes(role: string): string[] {
  const baseScopes = ['mcp:read'];
  
  switch (role) {
    case 'admin':
      return [...baseScopes, 'mcp:write', 'mcp:admin'];
    case 'editor':
      return [...baseScopes, 'mcp:write'];
    case 'viewer':
    default:
      return baseScopes;
  }
}

/**
 * Extract AuthContext from AuthInfo for MCP tools
 * This bridges the gap between mcp-handler's AuthInfo and our AuthContext
 */
export function authInfoToContext(authInfo: AuthInfo): {
  project_id: string;
  user_id: string;
  role: 'admin' | 'editor' | 'viewer';
} | null {
  const extra = authInfo.extra as Record<string, unknown> | undefined;
  
  if (!extra?.project_id || !extra?.user_id) {
    return null;
  }

  return {
    project_id: extra.project_id as string,
    user_id: extra.user_id as string,
    role: (extra.role as 'admin' | 'editor' | 'viewer') || 'viewer',
  };
}
