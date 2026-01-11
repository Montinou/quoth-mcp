/**
 * RFC 9728 Protected Resource Metadata Endpoint
 * 
 * Advertises OAuth 2.0 requirements for the MCP resource server.
 * MCP clients use this to discover the authorization server.
 * 
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 * @see https://modelcontextprotocol.io/specification/draft/basic/authorization
 */

import { protectedResourceHandler, metadataCorsOptionsRequestHandler } from 'mcp-handler';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://quoth.ai-innovation.site';

// Authorization server URL (Supabase Auth)
const AUTH_SERVER_URL = `${SUPABASE_URL}/auth/v1`;

// Create handler using mcp-handler's built-in function
const handler = protectedResourceHandler({
  authServerUrls: [AUTH_SERVER_URL],
  resourceUrl: `${APP_URL}/api/mcp`,
});

const optionsHandler = metadataCorsOptionsRequestHandler();

export async function GET(req: Request) {
  return handler(req);
}

export async function OPTIONS() {
  return optionsHandler();
}
