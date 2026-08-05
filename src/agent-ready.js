export const AGENT_LINK_HEADERS = [
  '<https://theiamproject.net/.well-known/api-catalog>; rel="api-catalog"',
  '<https://theiamproject.net/.well-known/oauth-authorization-server>; rel="oauth-authorization-server"',
  '<https://theiamproject.net/.well-known/oauth-protected-resource>; rel="oauth-protected-resource"',
  '<https://theiamproject.net/.well-known/openid-configuration>; rel="openid-configuration"',
  '<https://theiamproject.net/.well-known/mcp/server-card.json>; rel="mcp-server-card"',
  '<https://theiamproject.net/.well-known/agent-skills/index.json>; rel="agent-skills"',
  '<https://theiamproject.net/auth.md>; rel="auth-md"',
  '<https://theiamproject.net/sitemap.xml>; rel="sitemap"',
  '<https://theiamproject.net/robots.txt>; rel="robots"',
].join(', ');

const BASE_URL = 'https://theiamproject.net';

const ROBOTS_TXT = `# robots.txt for theiamproject.net
Content-Signal: ai-train=no, search=yes, ai-input=no
User-agent: *
Allow: /
Disallow: /admin/
User-agent: GPTBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Googlebot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Bytespider
Disallow: /
User-agent: CCBot
Disallow: /
Sitemap: ${BASE_URL}/sitemap.xml
`;

const SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${BASE_URL}/</loc><lastmod>2026-08-04</lastmod><priority>1.0</priority></url>
  <url><loc>${BASE_URL}/auth.md</loc><lastmod>2026-08-04</lastmod><priority>0.8</priority></url>
</urlset>
`;

const API_CATALOG = JSON.stringify({ linkset: [{ anchor: `${BASE_URL}/api`, "service-desc": [{ href: `${BASE_URL}/api/openapi.json` }], status: [{ href: `${BASE_URL}/api/health` }] }] }, null, 2);
const OAUTH_AUTH_SERVER = JSON.stringify({ issuer: BASE_URL, authorization_endpoint: `${BASE_URL}/oauth/authorize`, token_endpoint: `${BASE_URL}/oauth/token`, jwks_uri: `${BASE_URL}/.well-known/jwks.json`, registration_endpoint: `${BASE_URL}/oauth/register`, grant_types_supported: ["authorization_code", "refresh_token", "client_credentials"], scopes_supported: ["read", "write", "admin"] }, null, 2);
const OAUTH_PROTECTED_RESOURCE = JSON.stringify({ resource: BASE_URL, authorization_servers: [BASE_URL], scopes_supported: ["read", "write", "admin"] }, null, 2);
const OPENID_CONFIG = JSON.stringify({ issuer: BASE_URL, authorization_endpoint: `${BASE_URL}/oauth/authorize`, token_endpoint: `${BASE_URL}/oauth/token`, userinfo_endpoint: `${BASE_URL}/oauth/userinfo`, jwks_uri: `${BASE_URL}/.well-known/jwks.json`, grant_types_supported: ["authorization_code", "refresh_token"], response_types_supported: ["code"], subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"], scopes_supported: ["openid", "read", "write", "admin"] }, null, 2);

const AUTH_MD = `# Agent Authentication

Register at: ${BASE_URL}/oauth/register

## Supported Identity Types
- api_key
- oauth_token
- did

## Authentication Flow
1. Discover OAuth metadata at /.well-known/oauth-authorization-server
2. Register at /oauth/register
3. Request token from /oauth/token
4. Include Bearer token in Authorization header
`;

const MCP_SERVER_CARD = JSON.stringify({ serverInfo: { name: "theiamproject", version: "1.0.0" }, transport: { type: "http", endpoint: `${BASE_URL}/mcp` }, capabilities: { tools: true, resources: true }, authentication: { type: "oauth", authorizationServer: BASE_URL } }, null, 2);
const AGENT_SKILLS_INDEX = JSON.stringify({ version: "0.2.0", updated: "2026-08-04", skills: [
  { name: "robots-txt", type: "well-known", description: "Publish /robots.txt" },
  { name: "sitemap", type: "well-known", description: "Publish a sitemap" },
  { name: "link-headers", type: "well-known", description: "Include Link headers (RFC 8288)" },
  { name: "markdown-negotiation", type: "well-known", description: "Return markdown to agents" },
  { name: "content-signals", type: "well-known", description: "Declare AI content usage preferences" },
  { name: "api-catalog", type: "well-known", description: "Publish API catalog (RFC 9727)" },
  { name: "oauth-discovery", type: "well-known", description: "Publish OAuth/OIDC discovery" },
  { name: "auth-md", type: "well-known", description: "Publish auth.md" },
  { name: "mcp-server-card", type: "well-known", description: "Publish MCP Server Card" },
  { name: "agent-skills", type: "well-known", description: "Publish agent skills index" },
  { name: "webmcp", type: "well-known", description: "Support WebMCP" },
] }, null, 2);
const JWKS = JSON.stringify({ keys: [] }, null, 2);
const API_HEALTH = JSON.stringify({ status: "ok", timestamp: new Date().toISOString() });
const OPENAPI_SPEC = JSON.stringify({ openapi: "3.0.3", info: { title: "The IAM Project API", version: "1.0.0" }, servers: [{ url: `${BASE_URL}/api` }], paths: { "/health": { get: { summary: "Health check", responses: { "200": { description: "OK" } } } } } }, null, 2);

function j(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
function t(body, ct, status = 200) {
  return new Response(body, { status, headers: { "Content-Type": ct, "Access-Control-Allow-Origin": "*" } });
}

export async function handleAgentReady(request, env, path, accept, host) {
  if (path === "/.well-known/api-catalog") return j(API_CATALOG);
  if (path === "/.well-known/oauth-authorization-server") return j(OAUTH_AUTH_SERVER);
  if (path === "/.well-known/oauth-protected-resource") return j(OAUTH_PROTECTED_RESOURCE);
  if (path === "/.well-known/openid-configuration") return j(OPENID_CONFIG);
  if (path === "/.well-known/jwks.json") return j(JWKS);
  if (path === "/.well-known/mcp/server-card.json") return j(MCP_SERVER_CARD);
  if (path === "/.well-known/agent-skills/index.json") return j(AGENT_SKILLS_INDEX);
  if (path === "/robots.txt") return t(ROBOTS_TXT, "text/plain; charset=utf-8");
  if (path === "/sitemap.xml") return t(SITEMAP_XML, "application/xml; charset=utf-8");
  if (path === "/auth.md") return t(AUTH_MD, "text/markdown; charset=utf-8");
  if (path === "/api/health") return j(API_HEALTH);
  if (path === "/api/openapi.json") return j(OPENAPI_SPEC);
  return null;
}
