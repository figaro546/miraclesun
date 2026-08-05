import { handleAgentReady, AGENT_LINK_HEADERS } from "./agent-ready.js";

const SITES = {
  "miraclesun.icu": "miraclesun",
  "www.miraclesun.icu": "miraclesun",
  "theiamproject.miraclesun.icu": "theiamproject",
  "theiamproject.net": "theiamproject",
  "www.theiamproject.net": "theiamproject",
};

const CRM_BASE = "https://services.leadconnectorhq.com";
const CRM_LOCATION_ID = "xIMotGFTTevHkqMW7hCP";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

async function logEvent(env, event) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      "INSERT INTO events (type, host, path, referrer, user_agent, ip, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))"
    ).bind(event.type || "page_view", event.host || "", event.path || "", event.referrer || "", event.userAgent || "", event.ip || "", JSON.stringify(event.metadata || {})).run();
  } catch (e) { console.error("D1 error:", e.message); }
}

async function sendToCRM(env, data) {
  const token = env.GHL_API_KEY;
  if (!token) return { success: false, error: "API key not set" };
  const contact = {
    locationId: CRM_LOCATION_ID,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || "",
    phone: data.phone || "",
    tags: [data.source || "miraclesun", "website-lead"],
    customFields: {},
  };
  for (const [k, v] of Object.entries(data)) {
    if (!["firstName", "lastName", "email", "phone", "source"].includes(k)) contact.customFields[k] = v;
  }
  try {
    const res = await fetch(`${CRM_BASE}/contacts/`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify(contact),
    });
    if (res.ok) {
      const result = await res.json();
      return { success: true, contactId: result.contact?.id || result.id };
    }
    if (res.status === 409 && data.email) {
      const searchRes = await fetch(`${CRM_BASE}/contacts/search?email=${encodeURIComponent(data.email)}`, {
        headers: { Authorization: `Bearer ${token}`, Version: "2021-07-28" },
      });
      if (searchRes.ok) {
        const sr = await searchRes.json();
        const existingId = sr.contacts?.[0]?.id;
        if (existingId) {
          const updateRes = await fetch(`${CRM_BASE}/contacts/${existingId}`, {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
            body: JSON.stringify(contact),
          });
          if (updateRes.ok) return { success: true, contactId: existingId, updated: true };
        }
      }
    }
    return { success: false, error: `CRM returned ${res.status}` };
  } catch (e) { return { success: false, error: e.message }; }
}

async function addNoteToCRM(env, contactId, note) {
  const token = env.GHL_API_KEY;
  if (!token || !contactId) return;
  try {
    await fetch(`${CRM_BASE}/contacts/${contactId}/notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Version: "2021-07-28" },
      body: JSON.stringify({ body: note }),
    });
  } catch (e) {}
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const host = url.hostname;
    const path = url.pathname;
    const method = request.method;
    const accept = request.headers.get("Accept") || "";

    if (method === "OPTIONS") {
      return new Response(null, {
        headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
      });
    }

    if (path === "/api/track" && method === "POST") {
      const body = await request.json();
      ctx.waitUntil(logEvent(env, { type: body.type || "page_view", host, path: body.path || path, referrer: body.referrer || request.headers.get("Referer") || "", userAgent: request.headers.get("User-Agent") || "", ip: request.headers.get("CF-Connecting-IP") || "", metadata: body.metadata || {} }));
      return jsonResponse({ success: true });
    }

    if (path === "/api/submit" && method === "POST") {
      const formData = await request.json();
      const source = SITES[host] || host;
      await logEvent(env, { type: "form_submission", host, path, userAgent: request.headers.get("User-Agent") || "", ip: request.headers.get("CF-Connecting-IP") || "", metadata: { ...formData, source } });
      const crmResult = await sendToCRM(env, { ...formData, source });
      if (crmResult.success && crmResult.contactId) {
        ctx.waitUntil(addNoteToCRM(env, crmResult.contactId, `Form submitted on ${host}${path} at ${new Date().toISOString()}`));
      }
      return jsonResponse({ success: crmResult.success, message: crmResult.success ? "Thank you!" : "Something went wrong." });
    }

    if (path === "/api/admin/stats" && method === "GET") {
      if ((request.headers.get("Authorization") || "") !== `Bearer ${env.ADMIN_PASSWORD}`) return jsonResponse({ error: "Unauthorized" }, 401);
      const [pv, fs, cl] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE type='page_view'").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE type='form_submission'").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM events WHERE type='click'").first(),
      ]);
      const top = await env.DB.prepare("SELECT path, COUNT(*) as c FROM events WHERE type='page_view' GROUP BY path ORDER BY c DESC LIMIT 10").all();
      return jsonResponse({ pageViews: pv?.c || 0, formSubmissions: fs?.c || 0, clicks: cl?.c || 0, topPages: top.results });
    }

    if (path === "/api/admin/events" && method === "GET") {
      if ((request.headers.get("Authorization") || "") !== `Bearer ${env.ADMIN_PASSWORD}`) return jsonResponse({ error: "Unauthorized" }, 401);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
      const offset = parseInt(url.searchParams.get("offset") || "0");
      const results = await env.DB.prepare("SELECT * FROM events ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
      return jsonResponse({ events: results.results });
    }

    const siteFolder = SITES[host];
    if (siteFolder === "theiamproject") {
      const agentResponse = await handleAgentReady(request, env, path, accept, host);
      if (agentResponse) return agentResponse;
    }

    if (path === "/admin" || path === "/admin/") {
      return env.ASSETS.fetch(new Request(new URL("/admin/index.html", request.url), request));
    }

    if (method === "GET" && !path.startsWith("/api/") && !path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map)$/)) {
      ctx.waitUntil(logEvent(env, { type: "page_view", host, path, referrer: request.headers.get("Referer") || "", userAgent: request.headers.get("User-Agent") || "", ip: request.headers.get("CF-Connecting-IP") || "" }));
    }

    if (siteFolder) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = path === "/" ? `/${siteFolder}/index.html` : `/${siteFolder}${path}`;
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (siteFolder === "theiamproject" && path === "/") {
        const h = new Headers(response.headers);
        h.set("Link", AGENT_LINK_HEADERS);
        h.set("Vary", "Accept");
        return new Response(response.body, { status: response.status, headers: h });
      }
      return response;
    }

    return new Response("Site not found. Add this hostname to SITES in src/index.js", { status: 404, headers: { "Content-Type": "text/plain" } });
  },
};

