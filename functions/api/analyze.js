// Cloudflare Pages Function: /api/analyze
// Proxies requests from the static site to the Anthropic Messages API.
// The ANTHROPIC_API_KEY must be set as a secret in the Cloudflare Pages dashboard
// (Settings -> Environment variables -> Add variable -> Encrypt). NEVER commit the key to this file.

const ALLOWED_ORIGINS = [
  // Add any origins you expect to call this endpoint. Leaving "*" is fine for a
  // public demo; tighten it to your own domain(s) for production.
  "*"
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes("*") ? "*" : (ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("Origin") || ""),
  });
}

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin") || "";
  const cors = corsHeaders(origin);

  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Server misconfigured: ANTHROPIC_API_KEY secret is not set in Cloudflare Pages environment variables." }),
      { status: 500, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  // Optional: enforce a default model / clamp max_tokens / strip client-provided
  // keys so a misbehaving frontend can't swap in a different model.
  const payload = {
    model: body.model || "claude-sonnet-4-20250514",
    max_tokens: Math.min(body.max_tokens || 4096, 8192),
    messages: body.messages || [],
    ...(body.system ? { system: body.system } : {}),
  };

  let upstream;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed: " + String(e) }),
      { status: 502, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      ...cors,
    },
  });
}

// Reject other HTTP methods explicitly so you don't get a generic 405 with no CORS headers.
export async function onRequest({ request }) {
  return new Response(
    JSON.stringify({ error: `Method ${request.method} not allowed. Use POST.` }),
    { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders(request.headers.get("Origin") || "") } }
  );
}
