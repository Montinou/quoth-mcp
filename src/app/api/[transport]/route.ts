/**
 * Quoth MCP Server API Route
 * Main entry point for the Model Context Protocol server
 *
 * Endpoint: /api/mcp (Streamable HTTP) or /api/sse (SSE)
 *
 * Features:
 * - OAuth 2.1 authentication via MCP API keys or OAuth tokens
 * - Proper WWW-Authenticate headers for OAuth discovery
 * - 3 Tools: quoth_search_index, quoth_read_doc, quoth_propose_update
 * - 2 Prompts: quoth_architect, quoth_auditor
 *
 * Authentication:
 * - Requires Bearer token in Authorization header
 * - Token can be MCP API key or OAuth-issued token
 * - Returns 401 with resource_metadata URL for OAuth discovery
 */

import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { registerQuothTools } from '@/lib/quoth/tools';
import { getArchitectPrompt, getAuditorPrompt } from '@/lib/quoth/prompts';
import { verifyMcpApiKey, type AuthContext } from '@/lib/auth/mcp-auth';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site';

/**
 * Token verification: handles both MCP API keys and OAuth tokens
 */
async function verifyToken(req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  if (!bearerToken) {
    return undefined;
  }

  // verifyMcpApiKey now handles both MCP API keys and OAuth tokens
  const mcpAuth = await verifyMcpApiKey(bearerToken);
  if (mcpAuth) {
    return {
      token: bearerToken,
      clientId: mcpAuth.user_id,
      scopes: mcpAuth.role === 'admin' ? ['mcp:read', 'mcp:write', 'mcp:admin'] :
              mcpAuth.role === 'editor' ? ['mcp:read', 'mcp:write'] :
              ['mcp:read'],
      extra: {
        project_id: mcpAuth.project_id,
        user_id: mcpAuth.user_id,
        role: mcpAuth.role,
      },
    };
  }

  return undefined;
}

/**
 * Extract AuthContext from AuthInfo
 */
function getAuthContextFromRequest(req: Request): AuthContext {
  const authInfo = (req as Request & { auth?: AuthInfo }).auth;
  if (!authInfo?.extra) {
    // Default for public access (shouldn't happen with required auth)
    return {
      project_id: 'quoth-knowledge-base',
      user_id: 'anonymous',
      role: 'viewer',
    };
  }

  const extra = authInfo.extra as Record<string, unknown>;
  return {
    project_id: (extra.project_id as string) || 'quoth-knowledge-base',
    user_id: (extra.user_id as string) || 'anonymous',
    role: (extra.role as 'admin' | 'editor' | 'viewer') || 'viewer',
  };
}

/**
 * Register tools and prompts on the MCP server
 */
function setupServer(server: McpServer, authContext: AuthContext) {
  // Register all Quoth tools with authentication context
  registerQuothTools(server, authContext);

  // Register Prompts (Personas)
  server.registerPrompt(
    'quoth_architect',
    {
      description:
        "Initialize the session for writing code or tests. Loads the 'Single Source of Truth' enforcement rules. Use this persona when generating new code.",
    },
    async () => getArchitectPrompt()
  );

  server.registerPrompt(
    'quoth_auditor',
    {
      description:
        'Initialize the session for reviewing code and updating documentation. Activates strict contrast rules between code and docs.',
    },
    async () => getAuditorPrompt()
  );
}

/**
 * Create MCP handler for a specific auth context
 */
function createHandlerWithContext(authContext: AuthContext) {
  return createMcpHandler(
    (server) => setupServer(server, authContext),
    {},
    {
      basePath: '/api',
      maxDuration: 60,
      verboseLogs: process.env.NODE_ENV === 'development',
    }
  );
}

/**
 * OAuth-wrapped handler that extracts auth context and creates MCP handler
 */
const oauthHandler = withMcpAuth(
  async (req: Request) => {
    // Extract auth context from the authenticated request
    const authContext = getAuthContextFromRequest(req);
    
    // Create handler with auth context and process request
    const handler = createHandlerWithContext(authContext);
    return handler(req);
  },
  verifyToken,
  {
    required: true,
    resourceMetadataPath: '/.well-known/oauth-protected-resource',
    resourceUrl: APP_URL,
  }
);

// Export handlers for Next.js App Router
export { oauthHandler as GET, oauthHandler as POST };
