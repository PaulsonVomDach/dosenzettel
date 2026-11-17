/**
 * Dosenzettel API (Cloudflare Worker)
 *
 * GET /data  ->  { colors, brands, tiers, canImages, piece }
 *
 * - colors, brands, tiers kommen aus dem Google Sheet (Tabs „Farben“, „Marken“, „Staffelpreise“).
 *   Zugriff über einen Google-Service-Account, dem das Sheet (nur Lesen) freigegeben ist.
 * - canImages und piece (Dosenfotos, Beispiel-Piece) liegen im KV-Speicher „ASSETS“.
 *
 * Secrets:   GOOGLE_SERVICE_ACCOUNT (JSON-Schlüssel), SHEET_ID
 * Variablen: ALLOWED_ORIGINS (kommagetrennt), CACHE_SECONDS
 */

const RANGES = ["Farben!A2:J", "Marken!A2:E", "Staffelpreise!A2:C"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/data") return json({ error: "not found" }, 404, cors);
    if (request.method !== "GET") return json({ error: "method not allowed" }, 405, cors);
    if (!cors["Access-Control-Allow-Origin"] && request.headers.get("Origin")) return json({ error: "origin not allowed" }, 403, {});

    const maxAge = Number(env.CACHE_SECONDS || 600);
    const cache = caches.default;
    const cacheKey = new Request(url.origin + "/data", { method: "GET" });
    let res = await cache.match(cacheKey);
    if (!res) {
      try {
        const data = await buildData(env);
        res = new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + maxAge },
        });
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      } catch (e) {
        return json({ error: "data unavailable", detail: String(e && e.message || e).slice(0, 200) }, 502, cors);
      }
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};

export async function buildData(env) {
  const [sheet, canImages, piece] = await Promise.all([
    readSheet(env),
    env.ASSETS ? env.ASSETS.get("canImages", "json") : null,
    env.ASSETS ? env.ASSETS.get("piece", "json") : null,
  ]);
  return { colors: sheet[0], brands: sheet[1], tiers: sheet[2], canImages: canImages || {}, piece: piece || null };
}

async function readSheet(env) {
  if (!env.SHEET_ID) throw new Error("SHEET_ID fehlt");
  const token = await googleToken(env);
  const q = RANGES.map(r => "ranges=" + encodeURIComponent(r)).join("&");
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values:batchGet?${q}`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!r.ok) throw new Error("Sheets " + r.status);
  const body = await r.json();
  return (body.valueRanges || []).map(v => v.values || []);
}

/* OAuth-Token für den Service-Account (JWT mit RS256, WebCrypto) */
export async function googleToken(env) {
  const sa = typeof env.GOOGLE_SERVICE_ACCOUNT === "string" ? JSON.parse(env.GOOGLE_SERVICE_ACCOUNT) : env.GOOGLE_SERVICE_ACCOUNT;
  if (!sa || !sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT fehlt oder ist unvollständig");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    { alg: "RS256", typ: "JWT" },
    { iss: sa.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 },
    sa.private_key,
  );
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt,
  });
  if (!r.ok) throw new Error("Google-Token " + r.status);
  return (await r.json()).access_token;
}

export async function signJwt(header, payload, pem) {
  const enc = o => b64url(new TextEncoder().encode(JSON.stringify(o)));
  const data = enc(header) + "." + enc(payload);
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
  return data + "." + b64url(new Uint8Array(sig));
}

function b64url(bytes) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes("*") || allowed.includes(origin);
  return ok && origin
    ? { "Access-Control-Allow-Origin": allowed.includes("*") ? "*" : origin, "Access-Control-Allow-Methods": "GET, OPTIONS", "Vary": "Origin" }
    : {};
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...headers } });
}
