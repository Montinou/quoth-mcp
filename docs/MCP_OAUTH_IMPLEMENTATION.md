# MCP OAuth 2.1 Implementation Guide

Technical documentation for implementing MCP (Model Context Protocol) with OAuth 2.1 + PKCE authentication in a Next.js application.

## Overview

This setup enables Claude Code to authenticate via browser login without manual token copying:

```bash
claude mcp add --transport http my-server https://your-domain.com/api/mcp/mcp
# → Browser opens → User logs in → Done!
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude Code   │────▶│   MCP Server     │────▶│   Your App DB   │
│   (CLI Client)  │◀────│   (Next.js API)  │◀────│   (Neon/etc)    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │
        │                        ▼
        │               ┌──────────────────┐
        └──────────────▶│   OAuth Endpoints │
          (browser)     │   + Login Page    │
                        └──────────────────┘
```

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.2",
    "mcp-handler": "^1.0.7",
    "jose": "^5.0.0"
  }
}
```

## File Structure

```
app/
├── .well-known/
│   └── oauth-authorization-server/
│       └── route.ts          # OAuth metadata (RFC 8414)
├── api/
│   └── mcp/
│       ├── [transport]/
│       │   └── route.ts      # Main MCP handler (HTTP Streamable)
│       ├── sse/
│       │   ├── route.ts      # SSE transport (legacy)
│       │   └── message/
│       │       └── route.ts  # SSE message handler
│       └── oauth/
│           ├── authorize/
│           │   └── route.ts  # Authorization endpoint
│           ├── token/
│           │   └── route.ts  # Token exchange
│           └── register/
│               └── route.ts  # Dynamic client registration
├── auth/
│   └── mcp/
│       └── page.tsx          # Login UI for OAuth
lib/
├── mcp/
│   ├── auth.ts               # Token validation
│   └── tools.ts              # MCP tool definitions
```

---

## 1. OAuth Metadata Endpoint

`app/.well-known/oauth-authorization-server/route.ts`

```typescript
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = `${url.protocol}//${url.host}`

  const metadata = {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read", "write"],
  }

  return NextResponse.json(metadata, {
    headers: {
      "Cache-Control": "max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  })
}
```

---

## 2. Authorization Endpoint

`app/api/mcp/oauth/authorize/route.ts`

Key points:
- Stores authorization request in cookie
- Redirects to login page if not authenticated
- Generates self-contained JWT authorization code (no database needed)

```typescript
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getSessionContext } from "@/lib/session-context"
import * as jose from "jose"

const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || "your-secret"

export async function GET(request: Request) {
  const url = new URL(request.url)
  
  // Extract OAuth params
  const clientId = url.searchParams.get("client_id")
  const redirectUri = url.searchParams.get("redirect_uri")
  const codeChallenge = url.searchParams.get("code_challenge")
  const state = url.searchParams.get("state")

  // Validate params
  if (!clientId || !redirectUri || !codeChallenge) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 })
  }

  // Store request in cookie
  const authRequest = { clientId, redirectUri, state, codeChallenge }
  const cookieStore = await cookies()
  cookieStore.set("mcp_oauth_request", JSON.stringify(authRequest), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
  })

  // Check if already logged in
  const context = await getSessionContext()
  if (context) {
    return generateAuthCode(authRequest, context)
  }

  // Redirect to login
  return NextResponse.redirect(new URL("/auth/mcp?oauth=1", url.origin))
}

// POST: Called after login to generate code
export async function POST() {
  const cookieStore = await cookies()
  const authRequest = JSON.parse(cookieStore.get("mcp_oauth_request")?.value || "{}")
  const context = await getSessionContext()
  
  if (!context) {
    return NextResponse.json({ error: "access_denied" }, { status: 401 })
  }

  return generateAuthCode(authRequest, context)
}

async function generateAuthCode(authRequest: any, context: any) {
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)
  
  // Auth code is a signed JWT containing all data
  const code = await new jose.SignJWT({
    sub: context.userId.toString(),
    org_id: context.organizationId,
    email: context.email,
    client_id: authRequest.clientId,
    redirect_uri: authRequest.redirectUri,
    code_challenge: authRequest.codeChallenge,
    type: "auth_code",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("5m")
    .setIssuer("your-app")
    .setAudience("mcp-oauth")
    .sign(secret)

  const cookieStore = await cookies()
  cookieStore.delete("mcp_oauth_request")

  const redirectUrl = new URL(authRequest.redirectUri)
  redirectUrl.searchParams.set("code", code)
  if (authRequest.state) redirectUrl.searchParams.set("state", authRequest.state)

  return NextResponse.redirect(redirectUrl)
}
```

---

## 3. Token Endpoint

`app/api/mcp/oauth/token/route.ts`

Key points:
- Validates PKCE code_verifier
- Auth code is self-contained JWT (no DB lookup)
- Returns access token (also a JWT)

```typescript
import { NextResponse } from "next/server"
import * as jose from "jose"

const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || "your-secret"

export async function POST(request: Request) {
  const body = await parseBody(request)
  const { code, redirect_uri, client_id, code_verifier } = body

  // Verify auth code JWT
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)
  let payload: jose.JWTPayload
  
  try {
    const result = await jose.jwtVerify(code, secret, {
      issuer: "your-app",
      audience: "mcp-oauth",
    })
    payload = result.payload
  } catch {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  // Validate PKCE
  if (!await validatePkce(code_verifier, payload.code_challenge as string)) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  // Validate client_id and redirect_uri match
  if (payload.client_id !== client_id || payload.redirect_uri !== redirect_uri) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 })
  }

  // Generate access token
  const accessToken = await new jose.SignJWT({
    sub: payload.sub,
    org_id: payload.org_id,
    email: payload.email,
    type: "mcp",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .setIssuer("your-app")
    .setAudience("mcp-client")
    .sign(secret)

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 30 * 24 * 60 * 60,
  })
}

async function validatePkce(verifier: string, challenge: string): Promise<boolean> {
  const data = new TextEncoder().encode(verifier)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  return base64url === challenge
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") || ""
  if (contentType.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(await request.formData())
  }
  return request.json()
}
```

---

## 4. Client Registration (Optional)

`app/api/mcp/oauth/register/route.ts`

```typescript
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const body = await request.json()
  const clientId = `mcp_${crypto.randomUUID().replace(/-/g, "")}`

  return NextResponse.json({
    client_id: clientId,
    client_name: body.client_name || "MCP Client",
    redirect_uris: body.redirect_uris || [],
    token_endpoint_auth_method: "none",
  })
}
```

---

## 5. Login Page

`app/auth/mcp/page.tsx`

```tsx
"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

export default function MCPAuthPage() {
  const searchParams = useSearchParams()
  const isOAuthFlow = searchParams.get("oauth") === "1"
  const [status, setStatus] = useState<"loading" | "ready" | "success">("loading")

  useEffect(() => {
    async function checkAuth() {
      const res = await fetch("/api/auth/session")
      if (res.ok) {
        setStatus("ready")
        if (isOAuthFlow) {
          // Auto-complete OAuth flow
          await completeOAuth()
        }
      } else {
        // Redirect to login
        window.location.href = `/auth/sign-in?callbackUrl=${encodeURIComponent(window.location.href)}`
      }
    }
    checkAuth()
  }, [isOAuthFlow])

  async function completeOAuth() {
    const res = await fetch("/api/mcp/oauth/authorize", { method: "POST" })
    if (res.redirected) {
      setStatus("success")
      window.location.href = res.url
    }
  }

  return (
    <div>
      {status === "loading" && <p>Checking authentication...</p>}
      {status === "ready" && !isOAuthFlow && (
        <button onClick={completeOAuth}>Authorize Claude Code</button>
      )}
      {status === "success" && <p>Success! Redirecting...</p>}
    </div>
  )
}
```

---

## 6. MCP Handler

`app/api/mcp/[transport]/route.ts`

```typescript
import { createMcpHandler } from "mcp-handler"
import { validateMCPToken } from "@/lib/mcp/auth"

const handler = createMcpHandler(
  (server) => {
    // Register your tools
    server.registerTool("my_tool", { /* ... */ }, async (args) => {
      // Tool implementation
    })
  },
  {},
  {
    basePath: "/api/mcp",
    authenticate: async (request) => {
      const authHeader = request.headers.get("Authorization")
      const context = await validateMCPToken(authHeader)
      if (!context) throw new Error("Unauthorized")
      return context
    },
  }
)

export { handler as GET, handler as POST }
```

---

## 7. Token Validation

`lib/mcp/auth.ts`

```typescript
import * as jose from "jose"

const MCP_TOKEN_SECRET = process.env.MCP_TOKEN_SECRET || "your-secret"

export interface MCPAuthContext {
  userId: number
  email: string
  organizationId: number
}

export async function validateMCPToken(authHeader: string | null): Promise<MCPAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) return null
  
  const token = authHeader.slice(7)
  const secret = new TextEncoder().encode(MCP_TOKEN_SECRET)

  try {
    const { payload } = await jose.jwtVerify(token, secret, {
      issuer: "your-app",
      audience: "mcp-client",
    })

    if (payload.type !== "mcp") return null

    return {
      userId: parseInt(payload.sub as string, 10),
      email: payload.email as string,
      organizationId: payload.org_id as number,
    }
  } catch {
    return null
  }
}
```

---

## Environment Variables

```bash
# Required
MCP_TOKEN_SECRET=your-256-bit-secret-key

# Optional (for Neon Auth integration)
NEON_AUTH_JWKS_URL=https://auth.neon.tech/.well-known/jwks.json
```

---

## Testing

```bash
# Test OAuth metadata
curl https://your-domain.com/.well-known/oauth-authorization-server

# Test client registration
curl -X POST https://your-domain.com/api/mcp/oauth/register \
  -H "Content-Type: application/json" \
  -d '{"client_name":"Test"}'

# Add to Claude Code
claude mcp add --transport http my-server https://your-domain.com/api/mcp/mcp
```

---

## Key Design Decisions

1. **Self-contained auth codes**: Authorization codes are signed JWTs containing all data, eliminating database storage requirements. Works seamlessly with serverless.

2. **PKCE required**: OAuth 2.1 mandates PKCE (S256) for all authorization code flows. No client secrets for public clients.

3. **Cookie-based request storage**: OAuth request parameters stored in httpOnly cookie during the redirect flow.

4. **30-day token validity**: Access tokens are long-lived but can be revoked by changing `MCP_TOKEN_SECRET`.

5. **No refresh tokens**: Simplified implementation — users re-authenticate after token expiration via the same browser flow.
